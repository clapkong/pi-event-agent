// 서버↔프런트 계약 (frontend/src/agent/contract.ts 와 동일해야 함 — 둘 다 수정 시 동기화).
// B2에서 Pi 이벤트를 이 AgentEvent 형태로 변환해 WS로 흘린다.

export type ElementType = "MCP" | "Extension" | "Skill";

export type AgentEvent =
  | { type: "text_delta"; delta: string }
  | { type: "tool_start"; label: string; tool: string; element: ElementType }
  | { type: "tool_end"; result: string; citation?: number }
  | { type: "ask"; question: string; options: string[] }
  | { type: "gate"; question: string }
  | { type: "model_switch"; from?: string; to: string; reason: string }
  | { type: "model_current"; name: string }
  | { type: "done" }
  | { type: "error"; message: string; retry?: number };

// 프런트→서버 메시지 (WS).
export type ClientMessage =
  | { kind: "prompt"; text: string }
  | { kind: "answer"; choice: string }
  | { kind: "abort" };
