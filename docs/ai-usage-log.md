# AI 사용 로그

> **사람(개발자)이 방향·결정·검증을 주도하고, AI(Claude Code)가 그 지시에 따라 구현을 보조한 기록.**
> 각 행: 날짜 · 도구 · AI가 구현한 것 · **내 역할(지시·결정·피드백·검증)** · 산출물.
> 모든 산출물은 사람이 직접 확인·수정 지시했고, 설계·디자인·우선순위 결정은 사람이 내렸다.

---

## 2026-06-16

| 도구 | AI 구현 | **내 역할 (지시·결정·피드백·검증)** | 산출물 |
|---|---|---|---|
| Claude Code (Opus 4.8) | 정본 plan을 "한 세션=한 태스크" 원자 단위 체크리스트로 분해, V0 검증 스파이크를 선행 단계로 분리 | **분해 방식·V0 선행 분리 방향 지시 및 검토** | `plans/TASKS.md` |
| + impeccable | F0 프런트 스캐폴드(Vite+React+TS·ESM, 라우팅, S0 사이드바, 디자인 토큰·폰트 이식) | **F0 착수 지시(impeccable 사용·토큰은 `DESIGN.md` 따르라 지정), 브라우저 직접 확인, "새 행사 안 보임" 점검 요청→원인 규명 확인** | `frontend/*` |
| Claude Code | F1 연결 계약 + Mock(`contract.ts`·`mockClient.ts`·`harness.ts`) | **다음 단계로 F1 지시, "F1이 뭔지" 설명 요청, 하니스 시퀀스 결과 검토** | `frontend/src/agent/*` |
| + impeccable | F2 S3 동작 타임라인(타임라인·되묻기·승인 게이트·컴포저·모델 토스트) | **F2 지시, "공간을 다 못 쓰는 느낌" 레이아웃 피드백→칼럼폭 수정, 4상태 검토** | `frontend/src/screens/workspace/*` |
| Claude Code | 현재 mock 동작·교체 지점 문서화 | **"지금 mock이고 나중에 실제 데이터로 바꿔야 한다고 `CLAUDE.md`에 적어둬" 지시** | `CLAUDE.md` |
| Claude Code | 앱 셸 풀블리드 전환 + `DESIGN.md` 동기화 | **"카드 형식 말고 메인 화면 전체로" 디자인 결정** | `AppShell.module.css`, `DESIGN.md` |
| + impeccable | F3 기획 폼(S2) + 홈 대시보드(S1): store·타일·알림 센터·달력·체크리스트 | **F3 지시, 확정 시안과의 일치 검토·확인** | `screens/home·new`, `store/*` |
| + impeccable | F0–F3 디자인 점검(이모지→Tabler 아이콘, 홈 버킷 버그, 타이포) + 다음 세션 가이드 | **"impeccable로 점검·수정" 지시, 타임라인 명조 이질감 직접 발견·지적** | `index.html`, `screens/*`, `NEXT_SESSION.txt` |
| (git) | 커밋 정리 | **교수님 레포 확인 지시→마일스톤 단위 커밋 방침 결정, 커밋 키워드 대괄호 제거 결정, 푸시·force-push 판단** | (커밋 히스토리) |

## 2026-06-17

| 도구 | AI 구현 | **내 역할 (지시·결정·피드백·검증)** | 산출물 |
|---|---|---|---|
| Claude Code | 컴포저 텍스트 전달·타임라인 이어붙이기 + 사용자 메시지 표시 버그 수정 | **컴포저·"메시지가 사라지는" 타임라인 초기화 버그 직접 발견·지적** | `S3View.tsx`, `useAgentRun.ts`, `Timeline.tsx` |
| Claude Code | 폼(S2) 입력을 초기 프롬프트로 전달 | **"폼 조건이 자동으로 안 들어간다" 직접 발견·지적** | `NewEvent.tsx` |
| Claude Code | 행사별 워크스페이스 분리(`useAgentRun(wsId)`) + 핸드오프 문서 정리 | **"마무리하고 다음 세션 잘 넘기게 .md 갱신" 지시, 커밋을 의미 단위로 묶기 결정** | `useAgentRun.ts`, `S3View.tsx`, `README.md`·`CLAUDE.md` |
| Claude Code + impeccable | **F4 S4 작업공간 + 상태 모델**: `boardState.ts`(3겹·잠금/신선도·예산 3상태·업체 4단계·stale + `useBoard` 인터랙션), S4 화면(상태 스트립·재기획 배너·조건·예산 막대+표+잠금·업체 미니 스테퍼·지도/날씨·D-레일). 라우트 `/w/:id/board`. 재기획 시나리오(F4.4) puppeteer 3상태 검증. | **"토큰 남은 김에 F4 진행" 결정, 인프라 없는 자율 단위(F4) 선택, "안 더러워지게 한 덩어리만" 방침** | `frontend/src/data/boardState.ts`, `screens/workspace/S4View.*`, `routes/Board.tsx`, 라우팅·TopBar·타일 |

---

## 2026-06-21

| 도구 | AI 구현 | **내 역할 (지시·결정·피드백·검증)** | 산출물 |
|---|---|---|---|
| Claude Code (Opus 4.8) | `.pi/agents/` 6개 서브에이전트 정의를 `@tintinweb/pi-subagents` v0.10.3 정본 사양과 대조·수정: secretary의 잘못된 `mcp` 도구명 제거(로드 실패 버그), researcher·monitor의 `isolated:true` 제거(외부 조사·날씨 접근 차단 버그), writer/monitor/critic 모델을 fuzzy 이름(`haiku`/`sonnet`)으로, Planner 위임 대상을 실제 spawn 타입명(`researcher`/`writer`/`critic`/`monitor`/`secretary`)으로 정렬, monitor의 "깃발 push"→"결과 반환" 멘탈모델 정정 | **"`.pi/agents` 검토·개선" 지시, 범위를 `.pi/agents`로 한정, Planner를 워크스페이스당 1개로 두는 이유 설명→서브에이전트 유지 결정, 모델 fuzzy 방식 채택 결정** | `.pi/agents/*.md` |
| Claude Code (Opus 4.8) | Pi 시스템 프롬프트 빌드 경로 실측(`system-prompt.js`: 기본 "coding assistant" 정체성은 `SYSTEM.md`(=`customPrompt`)가 있으면 통째 교체, 없으면 `AGENTS.md`/`CLAUDE.md`를 `<project_context>`로 덧붙임)으로 "메인=세션 자체" 구조 확정. Planner(`event-organizer-main.md`)를 서브에이전트 디렉터리에서 빼서 **`AGENTS.md`(세션 메인 프롬프트)로 이동**, `.pi/agents/`엔 서브 5개만 남김 | **"행사마다 세션을 따로 관리하니 main을 서브가 아닌 메인으로" 직접 결정, "Pi 내부 너무 건드리는 것 아닌가" 우려 제기→교재(11·12장)로 정식 기능임 확인 후 가장 가벼운 `AGENTS.md` 경로 선택** | `AGENTS.md`(신규), `.pi/agents/event-organizer-main.md`(삭제) |
| Claude Code (Opus 4.8) | 위임 오케스트레이션 명문화: `Agent` 도구 병렬 방식 실측(`tasks[]` 없음 → 한 메시지에 다중 `Agent` 호출 + 각 `run_in_background`, 동시성 4) 확인 후 ① 조사 = researcher **병렬 fan-out**(타입 1개·인스턴스 N), 과거 사례 DB는 main이 `case_search` 직접, ② 작성·검토 = writer ⇄ critic **순차 루프(≤2회)** 를 Planner 프롬프트와 두 아키텍처 문서에 반영. 협업 흐름도도 병렬·루프판으로 교체 | **"researcher 하나보다 여러 개 병렬이 낫지 않나, writer↔critic 관계가 안 드러난다" 직접 지적, 사례 DB 조회 주체=main 직접 선택, 반영 범위=프롬프트+문서 둘 다 선택** | `AGENTS.md`, `docs/AGENTSDOCS.md`, `AGENTS_DETAILS.md` |
| Claude Code (Opus 4.8) | 프런트 구조 진단(pi 패키지 층 관계 실측: `pi-coding-agent` = `pi-agent-core` + 파일도구, `pi-web-ui`도 같은 토대) + 화면 부품 과분할 정리: Home(타일·알림·달력 3파일) → `Home.tsx` 1개, S3 대화(상단바·타임라인·컴포저·토스트·마커 5파일) → `S3View.tsx` 1개로 통합(S4 단일파일 패턴에 맞춤), 설계 참조 주석(§9.x) 제거. 시각 변화 0, `tsc` 통과, 36→28파일 | **"화면만 보여줘야 하는데 로직·파일이 너무 많다" 직접 진단→로직은 `boardState`·`useAgentRun` 2곳에 모여있음 확인, "부품을 너무 쪼개놨다, S4처럼 한 파일로" 통합 방향 결정, 파일 수↓ vs 파일 길이↓ 트레이드오프 중 전자 선택** | `screens/home/Home.tsx`, `screens/workspace/S3View.tsx`(통합), 8파일 삭제 |

| Claude Code (Opus 4.8) | 에이전트 `.md` 프롬프트 엔지니어링 패스(한 파일씩): 5개 서브 + `AGENTS.md`에 **입력 계약·출력 계약·역할 경계** 신설. researcher=다후보(검증된 것만·추천순)·web_search/fetch_content, writer=블록 포맷(`[잠금]`·`[n]`)+inherit_context, critic=판정 키워드+치명/권고+**수정 방향·처리 주체 분류**+inherit_context+tools=read, secretary=**추출만**(분리형), monitor=`판정: 재기획` 구조화. `AGENTS.md`에 조사 입력→**선택 게이트(ask_user_question)**→writer↔critic **루프 라우팅**→**변화 대응** 전 구간 배선 + ask_user_question 사용 정책·예시. 미구현 도구(`case_search`·`update_state`) TODO 표시. 두 아키텍처 문서 흐름도 동기화. 루트 `TODO.md` 신설 | **방식=한 파일씩 같이, 목표=역할별 꼭 필요한 것+입출력 구조화 직접 지정; researcher 다후보·secretary 분리형·case_search=main 직접·inherit_context(writer/critic)·critic이 수정방향+처리주체로 무한루프 차단 등 설계 결정; "ask_user_question 호출 가능?"·"호출할 줄 모르지 않나" 직접 점검→사용 정책 명문화 유도; TODO.md 생성 지시** | `.pi/agents/*.md`, `AGENTS.md`, `AGENTS_DETAILS.md`, `docs/AGENTS_DETAILS.md`, `TODO.md` |

| Claude Code (Opus 4.8) | 헤드리스(`pi -p`)로 secretary·monitor 실측 검증 → **secretary가 vague spawn 시 회의록을 환각**하는 것 발견·수정(secretary 최상위 환각 가드 "원본 못 읽으면 지어내지 말고 보고" + `AGENTS.md` "자기완결 지시 원칙": inherit_context 꺼진 서브엔 입력 출처 명시). monitor는 `판정: 재기획 제안` + 잠금/집행 제외 정상 확인. 이어 **monitor·secretary 트리거 소유권을 Planner→시스템(백엔드)으로 reframe**(운영 기간엔 활성 대화 없음 → 백엔드가 트리거, 결과만 세션 유입, Planner는 대응): `AGENTS.md` 4곳 + 두 아키텍처 문서 + `TODO.md`에 트리거 인프라 항목 | **"전체 파이프라인 시험" 지시 + 더미 워크스페이스 설정 요청, secretary 환각 직접 포착, 다른 세션의 트리거-소유권 분석을 가져와 "monitor·secretary는 시스템 트리거여야 한다" 결정** | `.pi/agents/secretary.md`, `AGENTS.md`, `AGENTS_DETAILS.md`, `docs/AGENTS_DETAILS.md`, `TODO.md`, `plans/test/*`(로컬) |

<!-- 새 항목: 날짜 섹션 + 표 행. AI 구현은 사람이 검토하고, 결정·피드백을 '내 역할'에 구체적으로 남긴다. -->
