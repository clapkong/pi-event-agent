# TODO

> 아직 안 만든 것 / 마저 해야 할 것 (2026-06-21 기준).
> 아키텍처는 `AGENTS_DETAILS.md`·`docs/AGENTS_DETAILS.md`, 진행 정본은 `plans/`(로컬), 작업 규칙은 `CLAUDE.md`.

## 자작 Pi Extension (미구현 — `AGENTS.md`가 참조만 함)
- [x] **사례 RAG** — 직접 안 만들고 **`pi-local-rag` 익스텐션 채택**(설치·현재 Pi 0.79.8 로드 검증 완료). 도구 `rag_query`(조회)·`rag_index`(적립). 사례 = 공통 `cases/*.md`. *(`case_search` 자작 폐기)*
- [ ] **`update_state`** — 보드 상태 쓰기 통로. **hook으로 잠금(confirmed🔒)·집행(spent) 가드 + 발송/적립 승인 게이트** 내장. 모든 상태 변경은 이 통로로만.
  - 프런트 상태 모델 참고: `frontend/src/data/boardState.ts`(3겹·예산 3상태·업체 4단계·stale).

## Skill (`.pi/skills/` — 4종 작성됨, 카탈로그 `plans/PI_ELEMENTS.md §5`)
- [x] **budget-policy** · **notice-writer** · **risk-assessment**(omnibus: 리스크·컴플라이언스·접근성·비상·식이) · **satisfaction-survey**(P3).
- 흡수돼 별도 skill 없음: `meeting-notes`→secretary 프롬프트, `proposal-writer`→writer, `clarify-questions`→Planner, `task-checklist`→build_checklist.
- [x] skill 자동 발견·로드 검증 — pi 0.79.8 로더 소스(`core/skills.js`) 대조: 스캔 경로 `.pi/skills`·`SKILL.md` 루트·`description` 규칙(≤1024자) 전부 충족, 헤드리스 startup 무에러(모델 401까지 도달=로드 OK). 남은 건 실제 모델이 task 매칭 시 *호출*하는지(라이브, 크레딧 소요 — 검증 타이밍 사용자 결정).

## MCP (`.mcp.json` = `{"mcpServers":{}}` — 비어 있음)
- [ ] **Gmail** — secretary 통신 읽기 / Planner 발송. (없으면 secretary가 읽을 통신이 없음)
- [ ] Slack(회의록 원천)·지도. *검색·날씨는 `pi-web-access`로 일부 대체 가능.*

## 백엔드 (Pi부터 새로 작성 예정 — `backend/` 없음)
- **방식 확정: B = `pi --mode rpc` 서브프로세스** (SDK 인프로세스 A 아님). 근거: pi 철학(코어 그대로+능력만 확장)·교수님 레퍼런스(CLI+구조화출력 패턴)·rpc.md가 "외부 UI용"으로 권장·되묻기/게이트가 `extension_ui_request`로 깔끔. 백엔드 = 웹서버 + 워크스페이스별 `pi` 자식프로세스 + rpc↔`contract.ts` 브리지 + 상태파일.
- [x] **rpc 브리지** — `backend/src/bridge.ts`(순수, 테스트 9개) + `pi-session.ts`(JSONL LF split) + `ws-handler.ts`(tee). 매핑 검증됨.
- [x] **WebSocket 스트리밍 v1** — `server.ts`(/ws·/health) + 행사별 cwd. **e2e 통과**(smoke모드: client→server→pi→client 한바퀴). 남음: 풀 에이전트(비smoke) + 실제 프런트 연결.
- [ ] **thinking 표시(프런트+contract)** — 추론 블록을 UI에 노출. `contract.ts`에 `{type:"thinking_delta",delta}` 추가 + S3 타임라인에 **기본 접힘·흐린 색 토글 패널**. (thinking 수다스러우니 펼침은 선택. 발표 임팩트 좋음.) ✅rpc 필드 확정: `message_update`/`assistantMessageEvent.type==="thinking_delta"`/`.delta`.
- [x] **rpc 스모크** — `pi --mode rpc` 자식 구동·이벤트 수신 확인(스모크 파일은 구조 재정비로 삭제). 프로토콜은 메모리 `pi-rpc-protocol`에 영속.
- [x] **백엔드 구조 스캐폴드** — `backend/`(TS+tsx): contract·rpc·config·workspace(완성) + bridge·pi-session·ws-handler·server(골격). typecheck 통과. 모듈지도 `backend/README.md`.
- [ ] **citation `[n]` → pi-local-rag 출처 연결** — 본문 `[n]` / 출처를 `rag_query` 결과(cases)에 매핑해 인용 드로어로. (rpc `tool_end`엔 citation 번호 없음 → 본문 파싱 or rag 출처 기반.)
- [ ] **보드 상태 동기화** — `contract.ts`엔 보드 이벤트 없음 → 별도 REST `GET /api/workspaces/:id`(상태파일 `workspace/<id>/state.json`). update_state가 유일 writer.
- **결정: 자동 트리거 안 함.** monitor/secretary는 백그라운드 cron/메일폴링 X → **온디맨드**(대화 중 Planner 추천 / 사용자 "재검토" / 견적 메일 도착 시). 재기획은 *추천만*, 프런트 배너로 표시. → 백엔드에 트리거 서브시스템 불필요(더 얇아짐).
- [ ] **홈 알림 센터 소스 정의(설계 구멍)** — 자동 트리거 없음 → 비동기 알림이 어디서 오나? 후보: Planner 대화 추천 / 사용자 액션 / secretary 온디맨드. 정해야 알림이 채워짐.
- [ ] **메인 세션 도구 제한 주의** — `tools` 허용목록을 좁히면 `ask_user_question`·`Agent`·`web_search` 등이 빠질 수 있음. 메인엔 제한을 걸지 않거나 명시 포함.
- [ ] `ask_user_question`/승인 게이트의 RPC `extension_ui_request` 이벤트 → 프런트 `ask`/`gate` 타임라인 매핑 (PI_INTEGRATION §8).
- [ ] 프런트 mock→실제 교체 지점: `frontend/src/agent/mockClient.ts`, `data/workspaces.ts` (CLAUDE.md 참조).

## 검증
- [x] 실제 `pi` 세션에서 **풀 파이프라인 라이브 동작 확인**(2026-06-21): researcher 3개 병렬 fan-out → `ask_user_question` 선택 게이트(장소·케이터링·예산방향) → writer(haiku) → critic(sonnet, 치명3/권고4) → 예산 사용자판단 재게이트. 한 세션에서 쭉 돔.
- [x] **fuzzy 모델** 해석 확인 — 라이브 런에서 writer=`claude haiku 4.5`, critic=`claude sonnet 4.6`로 정상 해석·실행됨.

## 문서 정리
- [ ] **이름 충돌**: 루트 `AGENTS_DETAILS.md`(아키텍처)와 `docs/AGENTS_DETAILS.md`(역할 요약)가 **같은 파일명**. 하나로 통합하거나 이름을 구분(예: docs/는 `AGENT_ROLES.md`).
