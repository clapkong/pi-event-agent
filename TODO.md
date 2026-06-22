# TODO

> 아직 안 만든 것 / 마저 해야 할 것 (2026-06-21 기준).
> 아키텍처는 `docs/ARCHITECTURE.md`, Pi 구성요소·에이전트는 `docs/PI_ELEMENTS.md`, 작업 규칙은 `CLAUDE.md`.

## 자작 ask
- [x] `ask_user_question` 도구(event-tools, `ctx.ui.select`) + rpiv 미사용(settings.json에 없음). 게이트·되묻기 라이브 검증됨.
- [ ] (선택·미화) ask를 타임라인 칩 대신 **별도 React 다이얼로그/모달**로. 지금도 칩으로 동작하니 기능상 필수 아님.

## Skill (`.pi/skills/` — 4종 작성됨, 카탈로그 `docs/PI_ELEMENTS.md §4`)
- 흡수돼 별도 skill 없음: `meeting-notes`→secretary 프롬프트, `proposal-writer`→writer, `clarify-questions`→Planner, `task-checklist`→build_checklist.
- [x] skill 자동 발견·로드 검증 — pi 0.79.8 로더 소스(`core/skills.js`) 대조: 스캔 경로 `.pi/skills`·`SKILL.md` 루트·`description` 규칙(≤1024자) 전부 충족, 헤드리스 startup 무에러(모델 401까지 도달=로드 OK). 남은 건 실제 모델이 task 매칭 시 *호출*하는지(라이브, 크레딧 소요 — 검증 타이밍 사용자 결정).

## MCP (`.pi/mcp.json` — 커뮤니티 3종 + 검색, 커밋됨)
- **→ gmail·캘린더·지도·검색 완료(라이브 검증). 새로 붙일 MCP 없음.** 요소 상세 `docs/PI_ELEMENTS.md §5`, 설치 `README.md`. 남은 외부데이터 = 날씨(아래, MCP 아닌 도구).
- [ ] **서비스 연결하기** (실제 서비스 백엔드에도 연결. 작업 공간에서 캘린더, 지도, mail 접근 가능)
- [ ] mail/slack(예정)이 n개 이상 쌓이면 secretary, workspace가 바뀌면 monitor 호출해서 배너 띄워주기

## 날씨 (외부 데이터 — 백엔드 모듈)
- [x] **`get_weather` 백엔드 모듈** — `backend/src/weather.ts`(Open-Meteo, 키 불필요). 행사일까지 **≤16일=예보 / 그 이상·과거=과거 N년 같은 월-일 평년값**(평균+변동폭), `source`(forecast/climatology)·`basis`(어떤 날 기준인지)로 구분, 출력 `{label,temp,pop,stale}` state.json 호환. `GET /api/workspaces/:id/weather`(fetch→state.json.weather 저장→보드가 읽음). 검증: 스모크(예보/평년/지오코딩/에러)+엔드포인트 e2e+tsc. 지오코딩은 영문 도시만 → 한글·랜드마크는 lat/lon(maps MCP 좌표).
- [x] **프런트 날씨 표시** — 보드 weather 카드에 `basis`(예보 vs 평년·기준일) 한 줄 추가(`S4View` + `s4.module.css .wBasis`, `boardState` weather에 `source?`/`basis?` 옵션 필드). tsc 통과. (basis 문자열이 "…예보 ·"/"평년값 ·"로 시작해 source까지 한 줄로 전달.)
- [ ] **날씨 변화→재기획 연동** — 날씨 입력 바뀌면 재기획 배너로(`InputSnapshot`/freshness). 현재는 `stale` 태그·우천 리스크 표시만.

## 백엔드 (`backend/` — pi rpc↔WS·REST 구현됨)
- **방식 확정: B = `pi --mode rpc` 서브프로세스** (SDK 인프로세스 A 아님). 근거: pi 철학(코어 그대로+능력만 확장)·교수님 레퍼런스(CLI+구조화출력 패턴)·rpc.md가 "외부 UI용"으로 권장·되묻기/게이트가 `extension_ui_request`로 깔끔. 백엔드 = 웹서버 + 워크스페이스별 `pi` 자식프로세스 + rpc↔`contract.ts` 브리지 + 상태파일.
- [x] **WebSocket 스트리밍 v1** — `server.ts`(/ws·/health) + 행사별 cwd. **e2e 통과**(smoke모드: client→server→pi→client 한바퀴). 남음: 풀 에이전트(비smoke) + 실제 프런트 연결.
- [x] **thinking 표시(프런트+contract)** — `contract.ts`에 `thinking_delta` + S3 타임라인 접힘 토글 패널 구현(+ 서브에이전트 출력 스트림·경과시간).
- [ ] **citation `[n]` → pi-local-rag 출처 연결** — 본문 `[n]` / 출처를 `rag_query` 결과(cases)에 매핑해 인용 드로어로. (rpc `tool_end`엔 citation 번호 없음 → 본문 파싱 or rag 출처 기반.)
- [x] **보드 상태 동기화** — REST `GET /api/workspaces/:id`(server.ts, state.json passthrough + CORS). 프런트 `useBoard`가 빈 보드로 시작→`fetchBoard`로 채움(**mock seed 폴백 제거**, 없으면 빈 채). 브라우저 e2e 검증(state.json→REST→보드). 남음: update_state 쓰기→재조회(현재 1회 로드).
- **결정: 자동 트리거 안 함.** monitor/secretary는 백그라운드 cron/메일폴링 X → **온디맨드**(대화 중 Planner 추천 / 사용자 "재검토" / 견적 메일 도착 시). 재기획은 *추천만*, 프런트 배너로 표시. → 백엔드에 트리거 서브시스템 불필요(더 얇아짐).
- [x] **홈 알림 센터 소스 정의** — 보드 파생으로 결정: replan(재검토 필요) + 1주 내 미완료 마일스톤(마감 임박). Home.tsx deriveNotifs.
- [x] `ask_user_question`/승인 게이트의 RPC `extension_ui_request` → 프런트 `ask`/`gate` 타임라인 매핑 (bridge rpcToContract, 라이브 검증됨).
- **데이터 mock 교체(REST)** — 조각별 출처가 달라 단계적:
  - [x] `boardState.ts` → `GET /api/workspaces/:id`(state.json).
  - [x] `workspaces.ts`+`store/workspaces.tsx` → `GET/POST /api/workspaces`(workspace/<id>/meta.json). 프런트 id 생성→낙관적 추가+POST 영속, 마운트 시 GET 로드. seed 제거(빈 목록서 시작). 엔드포인트 검증 완료.
  - [x] `proposal.ts` → `save_report`→`workspace/<id>/proposal.md`, DocView가 `/proposal` 렌더·편집·버전. proposal.ts(죽은 mock) 삭제.
  - [x] `home.ts` 알림 → 보드 파생(replan=재검토·1주내 마일스톤=마감임박). 체크리스트·달력도 milestones 파생.
  - [x] `cases.ts` → `/api/cases`가 `cases/*.md` frontmatter 파싱(→Case). citedBy 역추적은 미추적이라 제외.

## 검증
- [x] 실제 `pi` 세션에서 **풀 파이프라인 라이브 동작 확인**(2026-06-21): researcher 3개 병렬 fan-out → `ask_user_question` 선택 게이트(장소·케이터링·예산방향) → writer(haiku) → critic(sonnet, 치명3/권고4) → 예산 사용자판단 재게이트. 한 세션에서 쭉 돔.
- [x] **fuzzy 모델** 해석 확인 — 라이브 런에서 writer=`claude haiku 4.5`, critic=`claude sonnet 4.6`로 정상 해석·실행됨.

## 실런 피드백 백로그 (2026-06-22) — 남은 것
- [x] **① 날씨 연결**: `get_weather` pi 도구화(extension이 weather.ts 재사용) + AGENTS.md "행사일 확정 즉시 get_weather→update_state weather".
- [x] **② 스킬 카운트**: 공식 문서 확인 — 스킬은 task 매칭 시 에이전트가 **`read`로 SKILL.md 로드**(progressive disclosure). bridge `detectSkill`이 read 경로 `.pi/skills/<name>/SKILL.md`를 잡아 element=Skill·라벨 "스킬: <name>"로 → "Skill ×0" 해소. (못 센다던 건 틀림.)
- [x] **③ critic inherit_context→요약본**: critic.md `inherit_context:false` + 입력계약(ⓐ초안 ⓑ제약요약 ⓒ근거요약)을 프롬프트로. AGENTS.md에 critic 입력계약 + inherit-off 목록 추가. 부모 대화 통째 상속(67.9k) 대신 요약 전달 → 토큰 절감.
- [x] **④ 문서 편집·버전이력 복원**: DocView 편집(textarea→PUT)·버전이력(state.json.versions, AI/사람) 복원.
- [x] **⑤ stage 라이프사이클 → 사례 적립**: '정산·완료' 클릭 시 confirm("완료로 바꾸시겠습니까?") → setStatus(done) + 완료 프롬프트 트리거(AI 탭). AGENTS.md '행사 완료' 절차: ①회고 ask_user_question ②`save_case`로 cases/<id>.md ③`rag_index`로 적립. `save_case` 도구 추가(rag_index API 소스 확인: `{path}`). RAG 루프 닫힘.
- [x] **⑥ 메일/secretary 분류 + 작업공간 통신 창**: 수동 '점검' 버튼 + `save_comms` + 통신 카드 + (사용자 결정) **주기 자동 점검** — 운영 단계 워크스페이스를 열었는데 마지막 `checkedAt`이 1주 넘으면 백그라운드로 1회 자동 점검(`markChecked`+staleness 효과). 풀 백그라운드 폴러(세션 없이 Gmail 폴링)는 안 함(잠긴 "온디맨드" 유지) — 페이지 열 때 staleness만 본다.
- [x] **⑦ 재기획 배너 자동 갱신**: 두 경로 — (a) '점검'이 monitor→`replanChangedInputs`→배너(외부 입력: 날씨·메일), (b) **사람이 보드 입력(조건·예산) 편집 즉시 변경분이 배너에 누적**(useBoard editConditionValue/editBudget/editBudgetTotal→replan, dismiss는 백엔드 반영). 세션 내·사용자 액션 기반이라 백그라운드 인프라 불필요.
- [ ] **⑧ 전수 감사 — 실제 실행으로 확인 (마지막, 합의된 방식)**: 새 행사를 라이브로 한 번 돌리며 mcp/skills/extensions/agents가 **쓰여야 할 곳에 모두 실제로 쓰이는지** 로그로 검증(스킬 카운트·일정·완료→사례 적립·캘린더 등록·점검 흐름 포함). ※ 별도로 한 **정적 감사**(거짓/죽은 데이터: 연결상태·사례·proposal.ts·API_BASE·주석)는 완료 — 이건 ⑧이 아님.
- [x] **실제 일정 생성**: mock 아님 — `build_checklist`(Extension)가 마감 계산 → `update_state(milestones)` → 보드 D-레일.
- [x] **일정 업데이트(사람 편집 + 자동 진행상태)**: 마일스톤 완료체크·제목·담당·마감 인라인 편집·추가·삭제(useBoard toggleMilestoneDone/editMilestone/addMilestone/removeMilestone, due 변경 시 dday 재계산). 지난(due<오늘) 미완료는 '지연' 자동 표시(effStatus). 달력 이전/다음 달 이동. (GCal 등록은 사용자가 불필요라 함.)