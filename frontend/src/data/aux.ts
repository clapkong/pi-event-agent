// 연결 상태 타입 — 백엔드 /api/connections(실제 .pi/settings.json·mcp.json 파생).
// ⚠️ "구성됨"은 설정에 등록됐다는 뜻이지 실시간 연결 확인이 아니다(프로세스 liveness 미점검).
export type ConnStatus = "configured" | "off";
export type ConnKind = "LLM" | "MCP" | "Extension";
export interface Connection {
  name: string;
  kind: ConnKind;
  sub: string; // 모델/서비스
  status: ConnStatus;
}
