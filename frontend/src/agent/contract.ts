// agent/contract.ts — 서버→프런트 이벤트 + 프런트→서버 메서드 계약 (TASKS F1.1·F1.2).
//
// 이건 *우리가 정의하는 추상화 레이어*다. 백엔드(B2)가 Pi `session.subscribe`
// 이벤트를 이 형태로 변환하고, 프런트는 mock이든 실제든 이 계약만 본다.
//
// ✅ V0 검증 완료(PI_INTEGRATION.md §8): 계약 그대로 유효. Pi 매핑 —
//    ask → ExtensionUIContext `ui.select`, gate → `ui.confirm`,
//    abort → `session.abort()`, model_switch → `session.setModel()`+modelFallbackMessage.

/** 타임라인 스텝의 종류 (DESIGN §2.4 taxonomy A). MCP/Extension/Skill = Pi 5요소,
 *  Tool = 평범한 커스텀 도구(5요소 아님 — 요약 카운트 제외). */
export type ElementType = "MCP" | "Extension" | "Skill" | "Tool";

/** 서버→프런트로 흐르는 단일 이벤트 (type 으로 구분되는 합집합). */
export type AgentEvent =
  /** 답변 텍스트가 글자 단위로 흐른다 (Pi text_delta 매핑). */
  | { type: "text_delta"; delta: string }
  /** 도구 실행 시작 — 타임라인 노드 생성. */
  | { type: "tool_start"; label: string; tool: string; element: ElementType }
  /** 도구 실행 끝 — 결과 + 출처 번호(#N, 인용 드로어용). */
  | { type: "tool_end"; result: string; citation?: number }
  /** 되묻기 — 사용자 선택 대기. Pi: ExtensionUIContext `ui.select`. */
  | { type: "ask"; question: string; options: string[] }
  /** 승인 게이트 — 통과 전 다음 스텝 차단. */
  | { type: "gate"; question: string }
  /** 모델 전환 토스트. Pi: `session.setModel()` / modelFallbackMessage. */
  | { type: "model_switch"; from?: string; to: string; reason: string }
  /** 현재 모델명 — 뱃지 표시. */
  | { type: "model_current"; name: string }
  /** 런 정상 종료. */
  | { type: "done" }
  /** 오류 — 메시지 + 재시도 횟수(있으면). */
  | { type: "error"; message: string; retry?: number };

/** AgentEvent 중 특정 type 만 좁혀 쓰기 위한 헬퍼. */
export type AgentEventOf<T extends AgentEvent["type"]> = Extract<
  AgentEvent,
  { type: T }
>;

export type AgentEventHandler = (event: AgentEvent) => void;

/**
 * 프런트→서버 메서드 (TASKS F1.2).
 * **프런트에서 백엔드와 닿는 유일한 접점.** 다른 모듈은 이 인터페이스만 의존하고
 * fetch/WebSocket 을 직접 부르지 않는다 (mock ↔ 실제 교체 가능하게).
 */
export interface AgentClient {
  /** 이벤트 구독. 해제 함수를 반환한다. */
  subscribe(handler: AgentEventHandler): () => void;
  /** 새 요청 전송 → 런 시작. */
  prompt(text: string): void;
  /** 대기 중인 되묻기(ask) 또는 승인 게이트(gate)에 응답. */
  answer(choice: string): void;
  /** 진행 중인 런 중지. Pi: `session.abort()`. */
  abort(): void;
  /** 연결 종료(정리). 컴포넌트 언마운트 시 호출 — WS 닫고 자원 해제. */
  close(): void;
}
