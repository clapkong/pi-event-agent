# TODO

> 아직 안 만든 것 / 마저 해야 할 것 (2026-06-21 기준).
> 아키텍처는 `AGENTS_DETAILS.md`·`docs/AGENTS_DETAILS.md`, 진행 정본은 `plans/`(로컬), 작업 규칙은 `CLAUDE.md`.

## 자작 Pi Extension (미구현 — `AGENTS.md`가 참조만 함)
- [ ] **`case_search`** — 과거 사례 DB(pgvector RAG) 조회. Planner가 직접 호출해 외부 조사와 종합. (`extensions/` 비어 있음)
- [ ] **`update_state`** — 보드 상태 쓰기 통로. **hook으로 잠금(confirmed🔒)·집행(spent) 가드 + 발송/적립 승인 게이트** 내장. 모든 상태 변경은 이 통로로만.
  - 프런트 상태 모델 참고: `frontend/src/data/boardState.ts`(3겹·예산 3상태·업체 4단계·stale).

## Skill (미작성 — `skills/` 비어 있음)
- [ ] **meeting-notes** — 슬랙 날것 메시지 뭉치 → 회의록 정리 (secretary/Planner가 호출).
- [ ] 제안서 작성·리스크 점검 등 절차 Skill 후보 (추후 정리).

## MCP (`.mcp.json` = `{"mcpServers":{}}` — 비어 있음)
- [ ] **Gmail** — secretary 통신 읽기 / Planner 발송. (없으면 secretary가 읽을 통신이 없음)
- [ ] Slack(회의록 원천)·지도. *검색·날씨는 `pi-web-access`로 일부 대체 가능.*

## 백엔드 (Pi부터 새로 작성 예정 — `backend/` 없음)
- [ ] `createAgentSession` + WebSocket 스트리밍. **행사별 cwd + 공유 agentDir(SYSTEM/agents/extensions)** 구조.
- [ ] **메인 세션 도구 제한 주의** — `tools` 허용목록을 좁히면 `ask_user_question`·`Agent`·`web_search` 등이 빠질 수 있음. 메인엔 제한을 걸지 않거나 명시 포함.
- [ ] `ask_user_question`/승인 게이트의 RPC `extension_ui_request` 이벤트 → 프런트 `ask`/`gate` 타임라인 매핑 (PI_INTEGRATION §8).
- [ ] 프런트 mock→실제 교체 지점: `frontend/src/agent/mockClient.ts`, `data/workspaces.ts` (CLAUDE.md 참조).

## 검증
- [ ] 실제 `pi` 세션에서 위임·**선택 게이트(ask_user_question)**·writer↔critic 루프 동작 실측.
- [ ] **fuzzy 모델**(`sonnet`/`haiku`)이 OpenRouter 경유로 실제 해석되는지 확인 (안 잡히면 조용히 폴백).

## 문서 정리
- [ ] **이름 충돌**: 루트 `AGENTS_DETAILS.md`(아키텍처)와 `docs/AGENTS_DETAILS.md`(역할 요약)가 **같은 파일명**. 하나로 통합하거나 이름을 구분(예: docs/는 `AGENT_ROLES.md`).
