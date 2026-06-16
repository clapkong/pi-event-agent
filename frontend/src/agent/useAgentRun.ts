// useAgentRun — AgentClient(계약) 이벤트를 S3 화면 상태로 누적하는 훅 (F2).
// mock이든 실제든 contract.ts 만 의존한다. 백엔드 생기면 makeClient만 교체.

import { useEffect, useRef, useState } from "react";
import type {
  AgentClient,
  AgentEvent,
  ElementType,
} from "./contract.ts";
import { createMockClient } from "./mockClient.ts";
import { createRealClient } from "./realClient.ts";

// 기본은 mock(프런트 개발 규칙). 실제 백엔드는 env로만 켠다 — 검증/실사용 때:
//   frontend/.env.local 에 VITE_USE_REAL_AGENT=1  (+ backend 실행)
const USE_REAL = import.meta.env.VITE_USE_REAL_AGENT === "1";
const defaultClient: () => AgentClient = USE_REAL
  ? () => createRealClient()
  : createMockClient;

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
export type TimelineEntry = ToolEntry | TextEntry | AskEntry | GateEntry;

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
  counts: Record<ElementType, number>;
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

export function useAgentRun(makeClient: () => AgentClient = defaultClient) {
  const [state, setState] = useState<RunState>(initialState);
  const clientRef = useRef<AgentClient | null>(null);
  const idRef = useRef(0);
  const nextId = () => (idRef.current += 1);

  if (!clientRef.current) clientRef.current = makeClient();

  useEffect(() => {
    const client = clientRef.current!;
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
            counts: { ...s.counts, [e.element]: s.counts[e.element] + 1 },
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
    return unsubscribe;
  }, []);

  const start = (text = "") => {
    idRef.current = 0;
    setState(initialState);
    setState((s) => ({ ...s, running: true }));
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
