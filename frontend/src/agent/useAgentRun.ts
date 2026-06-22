// useAgentRun — AgentClient(계약) 이벤트를 S3 화면 상태로 누적하는 훅 (F2).
// mock이든 실제든 contract.ts 만 의존한다. 백엔드 생기면 makeClient만 교체.

import { useEffect, useRef, useState } from "react";
import type {
  AgentClient,
  AgentEvent,
  ElementType,
} from "./contract.ts";
import { createRealClient } from "./realClient.ts";

// 에이전트는 실제 백엔드(WS)에 붙는다. mock 제거됨 — backend(`backend/`) 실행 필요.
//   ws://127.0.0.1:8787 (realClient 기본). 행사별 세션은 wsId로 분리.

export type NodeStatus = "active" | "done" | "error" | "stopped";

export interface ToolEntry {
  kind: "tool";
  id: number;
  label: string;
  tool: string;
  element: ElementType;
  ts: string;
  status: NodeStatus;
  result?: string;
  citation?: number;
}
export interface TextEntry {
  kind: "text";
  id: number;
  text: string;
  streaming: boolean;
}
export interface AskEntry {
  kind: "ask";
  id: number;
  question: string;
  options: string[];
  answer?: string;
}
export interface GateEntry {
  kind: "gate";
  id: number;
  question: string;
  decision?: "approved" | "rejected";
}
export interface UserEntry {
  kind: "user";
  id: number;
  text: string;
}
export type TimelineEntry = ToolEntry | TextEntry | AskEntry | GateEntry | UserEntry;

export interface ModelToast {
  from?: string;
  to: string;
  reason: string;
}

export interface RunState {
  entries: TimelineEntry[];
  model: string | null;
  running: boolean;
  finished: boolean;
  pending: "ask" | "gate" | null;
  toast: ModelToast | null;
  error: string | null;
  counts: Record<Exclude<ElementType, "Tool">, number>; // 5요소만 집계(Tool 제외)
}

const initialState: RunState = {
  entries: [],
  model: null,
  running: false,
  finished: false,
  pending: null,
  toast: null,
  error: null,
  counts: { MCP: 0, Extension: 0, Skill: 0 },
};

const now = () => new Date().toLocaleTimeString("ko-KR", { hour12: false });

// 마지막 스트리밍 텍스트의 커서를 끈다(새 스텝이 시작될 때).
function settle(entries: TimelineEntry[]): TimelineEntry[] {
  const last = entries[entries.length - 1];
  if (last?.kind === "text" && last.streaming) {
    return entries.map((e, i) =>
      i === entries.length - 1 ? { ...(e as TextEntry), streaming: false } : e
    );
  }
  return entries;
}

// ── 타임라인 영속(워크스페이스별) ─────────────────────────────────
// 백엔드 pi 세션은 --session-id 로 resume(에이전트 기억 유지)되지만, 프런트 타임라인은
// 라이브 이벤트로만 그려서 재방문 시 빈 화면이 된다. 그래서 화면용으로 localStorage 에 캐시한다.
// (보여주던 것을 복원하는 용도 — 끊긴 동안 백엔드에서 일어난 이벤트까지 복원하진 않음. 그건 후속.)
const STORE_KEY = (wsId: string) => `agentRun:${wsId}`;

function loadPersisted(wsId: string): RunState {
  try {
    const raw = localStorage.getItem(STORE_KEY(wsId));
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Pick<RunState, "entries" | "model" | "counts">>;
      if (Array.isArray(saved.entries) && saved.entries.length > 0) {
        // 스트리밍 커서는 끄고, 진행/대기 상태는 새 연결 기준으로 리셋.
        const entries = saved.entries.map((e) =>
          e.kind === "text" && e.streaming ? { ...e, streaming: false } : e
        );
        return { ...initialState, entries, model: saved.model ?? null, counts: saved.counts ?? initialState.counts, finished: true };
      }
    }
  } catch {
    /* 파싱 실패 → 빈 상태 */
  }
  return initialState;
}

// wsId: 행사별 백엔드 세션·cwd 분리 (행사 1개 = 세션 1개 = cwd 1개).
export function useAgentRun(wsId = "demo") {
  const [state, setState] = useState<RunState>(() => loadPersisted(wsId));
  const clientRef = useRef<AgentClient | null>(null);
  // 복원된 타임라인의 마지막 id 부터 이어서 부여(키 충돌 방지) — 마운트당 1회 시드.
  const idRef = useRef(0);
  const seeded = useRef(false);
  if (!seeded.current) {
    idRef.current = state.entries.reduce((m, e) => Math.max(m, e.id), 0);
    seeded.current = true;
  }
  const nextId = () => (idRef.current += 1);

  // 타임라인 변화 시 localStorage 에 캐시(화면 복원용).
  useEffect(() => {
    try {
      localStorage.setItem(
        STORE_KEY(wsId),
        JSON.stringify({ entries: state.entries, model: state.model, counts: state.counts })
      );
    } catch {
      /* 용량 초과 등 무시 */
    }
  }, [wsId, state.entries, state.model, state.counts]);

  // ⚠️ client(=WS 연결)는 반드시 effect 안에서 생성·정리한다. render 본문에서 만들면
  // StrictMode(개발) 이중 마운트로 WS가 2개 열려 pi 프로세스도 2배가 된다.
  useEffect(() => {
    const client = createRealClient(wsId);
    clientRef.current = client;
    const reduce = (s: RunState, e: AgentEvent): RunState => {
      switch (e.type) {
        case "model_current":
          return { ...s, model: e.name };
        case "text_delta": {
          const entries = [...s.entries];
          const last = entries[entries.length - 1];
          if (last?.kind === "text" && last.streaming) {
            entries[entries.length - 1] = { ...last, text: last.text + e.delta };
          } else {
            entries.push({
              kind: "text",
              id: nextId(),
              text: e.delta,
              streaming: true,
            });
          }
          return { ...s, entries };
        }
        case "tool_start":
          return {
            ...s,
            entries: [
              ...settle(s.entries),
              {
                kind: "tool",
                id: nextId(),
                label: e.label,
                tool: e.tool,
                element: e.element,
                ts: now(),
                status: "active",
              },
            ],
            counts:
              e.element === "Tool"
                ? s.counts
                : { ...s.counts, [e.element]: s.counts[e.element] + 1 },
          };
        case "tool_end":
          return {
            ...s,
            entries: s.entries.map((en) =>
              en.kind === "tool" && en.status === "active"
                ? { ...en, status: "done", result: e.result, citation: e.citation }
                : en
            ),
          };
        case "ask":
          return {
            ...s,
            pending: "ask",
            entries: [
              ...settle(s.entries),
              { kind: "ask", id: nextId(), question: e.question, options: e.options },
            ],
          };
        case "gate":
          return {
            ...s,
            pending: "gate",
            entries: [
              ...settle(s.entries),
              { kind: "gate", id: nextId(), question: e.question },
            ],
          };
        case "done":
          return {
            ...s,
            entries: settle(s.entries),
            running: false,
            finished: true,
            pending: null,
          };
        case "error":
          return {
            ...s,
            entries: settle(s.entries).map((en) =>
              en.kind === "tool" && en.status === "active"
                ? { ...en, status: "error" }
                : en
            ),
            running: false,
            finished: true,
            pending: null,
            error: e.message,
          };
        default:
          return s;
      }
    };

    const unsubscribe = client.subscribe((e) => {
      // model_switch 는 일시적 토스트 — 타임라인엔 안 쌓고 따로 띄웠다 거둔다.
      if (e.type === "model_switch") {
        setState((s) => ({ ...s, toast: { from: e.from, to: e.to, reason: e.reason } }));
        window.setTimeout(
          () => setState((s) => (s.toast?.to === e.to ? { ...s, toast: null } : s)),
          4200
        );
        return;
      }
      setState((s) => reduce(s, e));
    });
    return () => {
      unsubscribe();
      client.close();
      clientRef.current = null;
    };
  }, [wsId]);

  // 첫 실행이면 새로 시작, 이미 대화가 있으면 이어붙인다(이전 메시지 유지).
  const start = (text = "") => {
    setState((s) => {
      const fresh = s.entries.length === 0;
      if (fresh) idRef.current = 0;
      const base = fresh ? initialState : s;
      const entries = text.trim()
        ? [...base.entries, { kind: "user" as const, id: nextId(), text }]
        : base.entries;
      return { ...base, entries, running: true, finished: false, error: null };
    });
    clientRef.current!.prompt(text);
  };

  const answerAsk = (choice: string) => {
    setState((s) => ({
      ...s,
      pending: null,
      entries: s.entries.map((en) =>
        en.kind === "ask" && en.answer === undefined ? { ...en, answer: choice } : en
      ),
    }));
    clientRef.current!.answer(choice);
  };

  const approveGate = () => {
    setState((s) => ({
      ...s,
      pending: null,
      entries: s.entries.map((en) =>
        en.kind === "gate" && en.decision === undefined
          ? { ...en, decision: "approved" }
          : en
      ),
    }));
    clientRef.current!.answer("승인");
  };

  const rejectGate = () => {
    // 수정 요청 = 진행 중단(사람이 다시 손봄). mock 런을 멈춘다.
    clientRef.current!.abort();
    setState((s) => ({
      ...s,
      pending: null,
      running: false,
      finished: true,
      entries: settle(s.entries).map((en) =>
        en.kind === "gate" && en.decision === undefined
          ? { ...en, decision: "rejected" }
          : en
      ),
    }));
  };

  const stop = () => {
    clientRef.current!.abort();
    setState((s) => ({
      ...s,
      running: false,
      finished: true,
      pending: null,
      entries: settle(s.entries).map((en) =>
        en.kind === "tool" && en.status === "active"
          ? { ...en, status: "stopped", result: "중지됨" }
          : en
      ),
    }));
  };

  return { state, start, answerAsk, approveGate, rejectGate, stop };
}
