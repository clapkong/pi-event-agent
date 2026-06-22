# TODO

> 아직 안 만든 것 / 마저 해야 할 것 (2026-06-21 기준).
> 아키텍처는 `AGENTS_DETAILS.md`·`docs/AGENTS_DETAILS.md`, 진행 정본은 `plans/`(로컬), 작업 규칙은 `CLAUDE.md`.

## 자작 ask (rpiv 대체) — rpiv는 `ui.custom`(TUI 전용)이라 웹 비호환. 두 갈래 분담:
- [ ] **[event-tools 세션]** `ask_user_question` 도구를 `ctx.ui.select` 기반으로 event-tools에 추가 + `.pi/settings.json`에서 `rpiv-ask-user-question` 제거(이름 충돌). 게이트에 이미 쓰는 `ctx.ui.select` 패턴 그대로.
- [ ] **[이 세션/프런트]** rich ask **다이얼로그(React)** + `contract`/`bridge` 지원 — `extension_ui_request`(select)가 오면 rpiv보다 예쁜 웹 다이얼로그로. (멀티질문·설명·"기타→직접입력" 등 `ctx.ui.select`가 실어나르는 범위 내 최대한.) 둘이 **contract의 ask 형식만 맞추면** 합쳐짐.

## Skill (`.pi/skills/` — 4종 작성됨, 카탈로그 `plans/PI_ELEMENTS.md §5`)
- 흡수돼 별도 skill 없음: `meeting-notes`→secretary 프롬프트, `proposal-writer`→writer, `clarify-questions`→Planner, `task-checklist`→build_checklist.
- [x] skill 자동 발견·로드 검증 — pi 0.79.8 로더 소스(`core/skills.js`) 대조: 스캔 경로 `.pi/skills`·`SKILL.md` 루트·`description` 규칙(≤1024자) 전부 충족, 헤드리스 startup 무에러(모델 401까지 도달=로드 OK). 남은 건 실제 모델이 task 매칭 시 *호출*하는지(라이브, 크레딧 소요 — 검증 타이밍 사용자 결정).

## MCP (`.pi/mcp.json` — 커뮤니티 3종 + 검색, 커밋됨)
- **→ gmail·캘린더·지도·검색 완료(라이브 검증). 새로 붙일 MCP 없음.** 상세 `docs/MCP_DETAILS.md`. 남은 외부데이터 = 날씨(아래, MCP 아닌 도구).
- [ ] **서비스 연결하기** (실제 서비스 백엔드에도 연결. 작업 공간에서 캘린더, 지도, mail 접근 가능)
- [ ] mail/slack(예정)이 n개 이상 쌓이면 secretary, workspace가 바뀌면 monitor 호출해서 배너 띄워주기

## 날씨 (외부 데이터 — 백엔드 모듈)
- [x] **`get_weather` 백엔드 모듈** — `backend/src/weather.ts`(Open-Meteo, 키 불필요). 행사일까지 **≤16일=예보 / 그 이상·과거=과거 N년 같은 월-일 평년값**(평균+변동폭), `source`(forecast/climatology)·`basis`(어떤 날 기준인지)로 구분, 출력 `{label,temp,pop,stale}` state.json 호환. `GET /api/workspaces/:id/weather`(fetch→state.json.weather 저장→보드가 읽음). 검증: 스모크(예보/평년/지오코딩/에러)+엔드포인트 e2e+tsc. 지오코딩은 영문 도시만 → 한글·랜드마크는 lat/lon(maps MCP 좌표).
- [x] **프런트 날씨 표시** — 보드 weather 카드에 `basis`(예보 vs 평년·기준일) 한 줄 추가(`S4View` + `s4.module.css .wBasis`, `boardState` weather에 `source?`/`basis?` 옵션 필드). tsc 통과. (basis 문자열이 "…예보 ·"/"평년값 ·"로 시작해 source까지 한 줄로 전달.)
- [ ] **날씨 변화→재기획 연동** — 날씨 입력 바뀌면 재기획 배너로(`InputSnapshot`/freshness). 현재는 `stale` 태그·우천 리스크 표시만.

## 백엔드 (Pi부터 새로 작성 예정 — `backend/` 없음)
- **방식 확정: B = `pi --mode rpc` 서브프로세스** (SDK 인프로세스 A 아님). 근거: pi 철학(코어 그대로+능력만 확장)·교수님 레퍼런스(CLI+구조화출력 패턴)·rpc.md가 "외부 UI용"으로 권장·되묻기/게이트가 `extension_ui_request`로 깔끔. 백엔드 = 웹서버 + 워크스페이스별 `pi` 자식프로세스 + rpc↔`contract.ts` 브리지 + 상태파일.
- [x] **WebSocket 스트리밍 v1** — `server.ts`(/ws·/health) + 행사별 cwd. **e2e 통과**(smoke모드: client→server→pi→client 한바퀴). 남음: 풀 에이전트(비smoke) + 실제 프런트 연결.
- [ ] **thinking 표시(프런트+contract)** — 추론 블록을 UI에 노출. `contract.ts`에 `{type:"thinking_delta",delta}` 추가 + S3 타임라인에 **기본 접힘·흐린 색 토글 패널**. (thinking 수다스러우니 펼침은 선택. 발표 임팩트 좋음.) ✅rpc 필드 확정: `message_update`/`assistantMessageEvent.type==="thinking_delta"`/`.delta`.
- [ ] **citation `[n]` → pi-local-rag 출처 연결** — 본문 `[n]` / 출처를 `rag_query` 결과(cases)에 매핑해 인용 드로어로. (rpc `tool_end`엔 citation 번호 없음 → 본문 파싱 or rag 출처 기반.)
- [x] **보드 상태 동기화** — REST `GET /api/workspaces/:id`(server.ts, state.json passthrough + CORS). 프런트 `useBoard`가 빈 보드로 시작→`fetchBoard`로 채움(**mock seed 폴백 제거**, 없으면 빈 채). 브라우저 e2e 검증(state.json→REST→보드). 남음: update_state 쓰기→재조회(현재 1회 로드).
- **결정: 자동 트리거 안 함.** monitor/secretary는 백그라운드 cron/메일폴링 X → **온디맨드**(대화 중 Planner 추천 / 사용자 "재검토" / 견적 메일 도착 시). 재기획은 *추천만*, 프런트 배너로 표시. → 백엔드에 트리거 서브시스템 불필요(더 얇아짐).
- [ ] **홈 알림 센터 소스 정의(설계 구멍)** — 자동 트리거 없음 → 비동기 알림이 어디서 오나? 후보: Planner 대화 추천 / 사용자 액션 / secretary 온디맨드. 정해야 알림이 채워짐.
- [ ] **메인 세션 도구 제한 주의** — `tools` 허용목록을 좁히면 `ask_user_question`·`Agent`·`web_search` 등이 빠질 수 있음. 메인엔 제한을 걸지 않거나 명시 포함.
- [ ] `ask_user_question`/승인 게이트의 RPC `extension_ui_request` 이벤트 → 프런트 `ask`/`gate` 타임라인 매핑 (PI_INTEGRATION §8).
- **데이터 mock 교체(REST)** — 조각별 출처가 달라 단계적:
  - [x] `boardState.ts` → `GET /api/workspaces/:id`(state.json).
  - [x] `workspaces.ts`+`store/workspaces.tsx` → `GET/POST /api/workspaces`(workspace/<id>/meta.json). 프런트 id 생성→낙관적 추가+POST 영속, 마운트 시 GET 로드. seed 제거(빈 목록서 시작). 엔드포인트 검증 완료.
  - [ ] `proposal.ts` → writer 산출물(아직 파일로 안 씀 — 에이전트 출력 포맷·저장위치 정의 필요).
  - [ ] `home.ts` 알림 → **알림 소스 미정**(아래 설계 구멍)에 막힘. 체크리스트/달력은 state.json milestones 에서 파생 가능.
  - [ ] `cases.ts` → pi-local-rag `cases/*.md` 파싱(frontmatter→Case, citedBy 역추적).

## 검증
- [x] 실제 `pi` 세션에서 **풀 파이프라인 라이브 동작 확인**(2026-06-21): researcher 3개 병렬 fan-out → `ask_user_question` 선택 게이트(장소·케이터링·예산방향) → writer(haiku) → critic(sonnet, 치명3/권고4) → 예산 사용자판단 재게이트. 한 세션에서 쭉 돔.
- [x] **fuzzy 모델** 해석 확인 — 라이브 런에서 writer=`claude haiku 4.5`, critic=`claude sonnet 4.6`로 정상 해석·실행됨.

## 문서 정리
- [ ] **이름 충돌**: 루트 `AGENTS_DETAILS.md`(아키텍처)와 `docs/AGENTS_DETAILS.md`(역할 요약)가 **같은 파일명**. 하나로 통합하거나 이름을 구분(예: docs/는 `AGENT_ROLES.md`).
