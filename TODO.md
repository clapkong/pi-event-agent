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
- [ ] `createAgentSession` + WebSocket 스트리밍. **행사별 cwd + 공유 agentDir(SYSTEM/agents/extensions)** 구조.
- [ ] **monitor·secretary 트리거 인프라** — 둘은 Planner가 spawn하지 않고 **백엔드가 트리거**한다: secretary=통신 도착 훅(Gmail watch/poll), monitor=주기 cron. 트리거 결과(회의록·판정)를 세션에 주입 → Planner가 대응. (pi의 in-agent `schedule`은 세션 스코프라 부족.)
- [ ] **메인 세션 도구 제한 주의** — `tools` 허용목록을 좁히면 `ask_user_question`·`Agent`·`web_search` 등이 빠질 수 있음. 메인엔 제한을 걸지 않거나 명시 포함.
- [ ] `ask_user_question`/승인 게이트의 RPC `extension_ui_request` 이벤트 → 프런트 `ask`/`gate` 타임라인 매핑 (PI_INTEGRATION §8).
- [ ] 프런트 mock→실제 교체 지점: `frontend/src/agent/mockClient.ts`, `data/workspaces.ts` (CLAUDE.md 참조).

## 검증
- [ ] 실제 `pi` 세션에서 위임·**선택 게이트(ask_user_question)**·writer↔critic 루프 동작 실측.
- [ ] **fuzzy 모델**(`sonnet`/`haiku`)이 OpenRouter 경유로 실제 해석되는지 확인 (안 잡히면 조용히 폴백).

## 문서 정리
- [ ] **이름 충돌**: 루트 `AGENTS_DETAILS.md`(아키텍처)와 `docs/AGENTS_DETAILS.md`(역할 요약)가 **같은 파일명**. 하나로 통합하거나 이름을 구분(예: docs/는 `AGENT_ROLES.md`).
