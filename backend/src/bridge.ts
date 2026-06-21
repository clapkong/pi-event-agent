// bridge.ts — 통역사. rpc ↔ contract 변환만(순수, I/O 없음 → 단위테스트 쉬움).
// 통신·프로세스는 모름. 들어온 거 → 바꿔서 반환. 매핑 근거: memory pi-rpc-protocol.
import type { AgentEvent, ClientCommand, ElementType } from "./contract.ts";
import type { PendingUi, RpcCommand, RpcEvent } from "./rpc.ts";

// ── 도구 이름 → ElementType (5요소 카운트용) ──
export function classifyElement(tool = ""): ElementType {
  if (/^(web_search|fetch_content|gmail|send_email)/.test(tool)) return "MCP";
  if (/^(rag_query|rag_index|estimate_budget|build_checklist|update_state|simulate_budget)/.test(tool))
    return "Extension";
  return "Tool";
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

    case "tool_execution_start":
      return {
        type: "tool_start",
        label: ev.toolName ?? "tool",
        tool: ev.toolName ?? "tool",
        element: classifyElement(ev.toolName),
      };

    case "tool_execution_end":
      return { type: "tool_end", result: short(toolResultText(ev.result)) };

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
      return { type: "prompt", message: msg.text };

    case "answer":
      if (!pending) return null; // 대기 중인 ask/gate 없으면 버림
      if (pending.method === "confirm")
        return { type: "extension_ui_response", id: pending.id, confirmed: msg.choice === "승인" };
      return { type: "extension_ui_response", id: pending.id, value: msg.choice };

    case "abort":
      return { type: "abort" };
  }
}
