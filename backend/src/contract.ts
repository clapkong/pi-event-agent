// contract.ts — 백엔드가 소유하는 WS API 명세 (정본).
// 백엔드가 브라우저로 내보내는 이벤트(AgentEvent) + 브라우저가 보내는 명령(ClientCommand).
// 런타임 값 없음(순수 타입) → 프런트는 `import type`로 이 파일을 참조(사본 X).
// pi rpc 와는 무관 — bridge.ts 가 rpc ↔ 이 형식을 변환한다.

/** 타임라인 스텝의 종류. MCP/Extension/Skill = Pi 5요소, Tool = 평범한 커스텀 도구. */
export type ElementType = "MCP" | "Extension" | "Skill" | "Tool";

/** 백엔드 → 브라우저 이벤트 (type 합집합). */
export type AgentEvent =
  | { type: "text_delta"; delta: string }
  | { type: "thinking_delta"; delta: string } // 추론 스트림. S3 접힘 패널은 나중(TODO).
  | { type: "tool_start"; label: string; tool: string; element: ElementType }
  | { type: "tool_end"; result: string; citation?: number }
  | { type: "ask"; question: string; options: string[] }
  | { type: "gate"; question: string }
  | { type: "model_switch"; from?: string; to: string; reason: string }
  | { type: "model_current"; name: string }
  | { type: "done" }
  | { type: "error"; message: string; retry?: number };

export type AgentEventOf<T extends AgentEvent["type"]> = Extract<AgentEvent, { type: T }>;

/** 브라우저 → 백엔드 명령. realClient 가 보내는 형식. */
export type ClientCommand =
  | { kind: "prompt"; text: string }
  | { kind: "answer"; choice: string } // 되묻기 응답 / 게이트 승인("승인")
  | { kind: "abort" };
