// rpc.ts — pi --mode rpc 프로토콜 타입 (실측, memory: pi-rpc-protocol).
// 우리가 쓰는 것만. 프레이밍: stdout JSONL, LF로만 split (readline 금지).

/** 백엔드 → pi (stdin, 한 줄씩) */
export type RpcCommand =
  | { type: "prompt"; message: string }
  | { type: "abort" }
  | { type: "extension_ui_response"; id: string; value?: string; confirmed?: boolean; cancelled?: boolean };

/** pi → 백엔드 (stdout JSONL). 우리가 매핑하는 것 위주, 나머지는 무시. */
export type RpcEvent =
  | { type: "response"; command: string; success: boolean; error?: string }
  | { type: "agent_start" }
  | { type: "agent_end"; messages?: unknown[] }
  | { type: "message_start"; message?: { role?: string; model?: string; provider?: string } }
  | { type: "message_update"; assistantMessageEvent?: AssistantMessageEvent }
  | { type: "tool_execution_start"; toolName?: string; args?: Record<string, unknown> }
  | { type: "tool_execution_end"; result?: unknown }
  | { type: "extension_ui_request"; id: string; method: string; title?: string; message?: string; options?: string[] };
// 그 외(turn_start/end·message_end·thinking_start/end·text_start/end …)는 bridge default에서 무시.
// pi-session이 JSON.parse 결과를 RpcEvent로 캐스팅(경계). 모르는 type은 런타임에 default로 떨어짐.

/** message_update 안의 스트리밍 델타. */
export type AssistantMessageEvent =
  | { type: "text_delta"; delta: string; contentIndex?: number }
  | { type: "thinking_delta"; delta: string; contentIndex?: number };

/** 되묻기/게이트 응답 상관용 — bridge가 들고 있는 대기 상태. */
export type PendingUi = { id: string; method: string };
