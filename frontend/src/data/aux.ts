// S7 보조: 연결 상태 + 회의록 (F5.3) — mock. SCREENS S7, DESIGN §9.27·9.28.
// ⚠️ mock — 연결 상태는 실제 MCP/모델 상태로, 회의록은 Slack MCP(P3)로 교체.

export type ConnStatus = "connected" | "off" | "reconnect";
export type ConnKind = "LLM" | "MCP";
export interface Connection {
  name: string;
  kind: ConnKind;
  sub: string; // 모델/서비스
  status: ConnStatus;
}

// 사이드바 "연결됨 4/5"의 출처.
export const CONNECTIONS: Connection[] = [
  { name: "LLM", kind: "LLM", sub: "현재 모델: gpt-4o-mini", status: "connected" },
  { name: "검색", kind: "MCP", sub: "Brave Search", status: "connected" },
  { name: "지도/날씨", kind: "MCP", sub: "Google Maps", status: "connected" },
  { name: "이메일", kind: "MCP", sub: "Gmail", status: "connected" },
  { name: "캘린더", kind: "MCP", sub: "Google Calendar", status: "off" },
];

export type Actor = "human" | "ai";
export interface Meeting {
  id: string;
  actor: Actor;
  title: string;
  at: string;
  insight: string;
}
export const MEETINGS: Meeting[] = [
  {
    id: "m1",
    actor: "human",
    title: "킥오프 — 행사 방향 회의",
    at: "09-10",
    insight: "야외 선호, 단 우천 대비 필수 (작년 교훈 반영 요청)",
  },
  {
    id: "m2",
    actor: "ai",
    title: "에이전트 노트 — 사례 검색 결과 요약",
    at: "09-12",
    insight: "유사 사례 2건. 케이터링 비중↑·기념품↓ 배분이 만족도에 유리",
  },
  {
    id: "m3",
    actor: "human",
    title: "예산 검토 회의",
    at: "09-14",
    insight: "인원·장소 확정. 연사 사례비는 견적 후 재논의",
  },
];
