// bridge.ts — 통역사. rpc ↔ contract 변환만(순수, I/O 없음 → 단위테스트 쉬움).
// 통신·프로세스는 모름. 들어온 거 → 바꿔서 반환. 매핑 근거: memory pi-rpc-protocol.
import type { AgentEvent, ClientCommand, ElementType } from "./contract.ts";
import type { PendingUi, RpcCommand, RpcEvent } from "./rpc.ts";

// ── 도구 이름 → ElementType (5요소 카운트용) ──
export function classifyElement(tool = ""): ElementType {
  // 서브에이전트 스폰(pi-subagents) — researcher/writer/critic… 은 "Agent" 요소로(get_subagent_result·steer 는 Tool).
  if (tool === "Agent") return "Agent";
  // MCP: 외부 도구 — 검색·메일(gmail)·캘린더(calendar_*)·지도(maps_*). 접두사로 식별.
  if (/^(web_search|fetch_content|gmail|send_email|calendar|maps|google)/.test(tool)) return "MCP";
  // Extension: 자작 event-tools + 사례 RAG.
  if (
    /^(rag_query|rag_index|estimate_budget|build_checklist|update_state|save_report|get_weather|save_comms|save_case|simulate_budget|ask_user_question)/.test(
      tool,
    )
  )
    return "Extension";
  return "Tool";
}

// 스킬 사용 신호: 에이전트는 task가 매칭되면 `read` 로 SKILL.md 를 로드한다(progressive disclosure,
// 공식 문서). 그래서 read 의 경로가 `.pi/skills/<name>/SKILL.md` 면 그 스킬을 쓴 것으로 본다.
export function detectSkill(tool = "", args: unknown): string | null {
  if (!/^read$/i.test(tool)) return null;
  const s = typeof args === "string" ? args : JSON.stringify(args ?? "");
  const m = s.match(/skills[/\\]([^/\\"]+)[/\\]SKILL\.md/i) ?? s.match(/[.]pi[/\\]skills[/\\]([^/\\"]+)/i);
  return m ? m[1] : null;
}

// 서브에이전트 스폰을 사람이 알아볼 라벨로 (Agent 도구의 subagent_type → 역할).
const SUBAGENT_ROLE: Record<string, string> = {
  researcher: "조사",
  writer: "초안 작성",
  critic: "검토",
  monitor: "변화 점검",
  secretary: "통신 정리",
};
export function subagentLabel(sub: string): string {
  const role = SUBAGENT_ROLE[sub];
  return role ? `${sub} · ${role}` : sub;
}

function short(v: unknown, max = 400): string {
  const s = typeof v === "string" ? v : JSON.stringify(v ?? "");
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

// pi 도구 결과는 보통 { content: [{type:"text", text}] } → 텍스트만 뽑는다.
function toolResultText(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "content" in v) {
    const content = (v as { content: unknown }).content;
    if (Array.isArray(content)) {
      const txt = content
        .map((c) => (c && typeof c === "object" && "text" in c ? String((c as { text: unknown }).text) : ""))
        .filter(Boolean)
        .join(" ");
      if (txt) return txt;
    }
  }
  return JSON.stringify(v ?? "");
}

// ── pi 이벤트 → contract 이벤트 (매핑 없으면 null = 무시) ──
// ask/gate면 setPending으로 대기상태를 ws-handler에 알려, answer 응답을 상관시킨다.
export function rpcToContract(ev: RpcEvent, setPending: (p: PendingUi | null) => void): AgentEvent | null {
  switch (ev.type) {
    case "response":
      return ev.success === false ? { type: "error", message: ev.error ?? `${ev.command} 실패` } : null;

    case "message_start":
      if (ev.message?.role === "assistant" && ev.message.model)
        return { type: "model_current", name: ev.message.model };
      return null;

    case "message_update": {
      const a = ev.assistantMessageEvent;
      if (a?.type === "text_delta") return { type: "text_delta", delta: a.delta };
      if (a?.type === "thinking_delta") return { type: "thinking_delta", delta: a.delta };
      return null;
    }

    case "tool_execution_start": {
      const tool = ev.toolName ?? "tool";
      // 스킬 로드(read SKILL.md)는 Skill 요소로 — "Skill ×0" 해소.
      const skill = detectSkill(tool, ev.args);
      if (skill) return { type: "tool_start", callId: ev.toolCallId, label: `스킬: ${skill}`, tool, element: "Skill" };
      // 서브에이전트 스폰(Agent 도구)은 어떤 서브인지(researcher/writer/critic…) 라벨에 드러낸다.
      const sub = tool === "Agent" ? (ev.args?.subagent_type as string | undefined) : undefined;
      return {
        type: "tool_start",
        callId: ev.toolCallId,
        label: sub ? subagentLabel(sub) : tool,
        tool,
        element: classifyElement(tool),
      };
    }

    case "tool_execution_end":
      // 프런트에서 접기/펼치기 하도록 넉넉히 보낸다(과거 400자 → 4000자). 그래도 거대한 덤프는 cap.
      return { type: "tool_end", callId: ev.toolCallId, result: short(toolResultText(ev.result), 4000) };

    case "extension_ui_request":
      // 응답이 필요한 다이얼로그만 ask/gate로. setStatus·notify·setWidget 등 표시용은 무시.
      if (ev.method === "confirm") {
        setPending({ id: ev.id, method: "confirm" });
        return { type: "gate", question: ev.title ?? ev.message ?? "승인하시겠습니까?" };
      }
      if (ev.method === "select" || ev.method === "input" || ev.method === "editor") {
        setPending({ id: ev.id, method: ev.method });
        return { type: "ask", question: ev.title ?? ev.message ?? "선택", options: ev.options ?? [] };
      }
      return null; // setStatus·notify·setWidget·set_editor_text 등 = 응답 불필요

    case "agent_end":
      return { type: "done" };

    default:
      return null; // agent_start·turn_*·message_end·*_start/end 등은 무시
  }
}

// ── 브라우저 명령 → pi 명령 (pendingUi 참고해 ui 응답 형태 결정) ──
export function contractToRpc(msg: ClientCommand, pending: PendingUi | null): RpcCommand | null {
  switch (msg.kind) {
    case "prompt":
      // 처리 중 메시지면 streamingBehavior 동반(없으면 pi 가 "already processing" 거부).
      return msg.streamingBehavior
        ? { type: "prompt", message: msg.text, streamingBehavior: msg.streamingBehavior }
        : { type: "prompt", message: msg.text };

    case "answer":
      if (!pending) return null; // 대기 중인 ask/gate 없으면 버림
      if (pending.method === "confirm")
        return { type: "extension_ui_response", id: pending.id, confirmed: msg.choice === "승인" };
      return { type: "extension_ui_response", id: pending.id, value: msg.choice };

    case "abort":
      return { type: "abort" };
  }
}
