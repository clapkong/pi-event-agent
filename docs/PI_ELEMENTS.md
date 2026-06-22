# PI_ELEMENTS — Pi 구성요소 (에이전트 · Skill · MCP · Extension)

> 과제 필수 5요소(Pi · Skill · MCP · Pi Extension · Web UI)를 **무엇으로 충족하는지**의 단일 소스.
> 세션 메인 프롬프트는 `AGENTS.md`, 연동 사양은 `ARCHITECTURE.md §9`, MCP **설치 방법**은 `README.md`, 화면은 `DESIGN.md`.
> **규모: Tool 8 · Hook(가드) · Extension(자작 event-tools 1 + 채택 pi-local-rag) · Skill 4 · MCP 3 · 서브에이전트 5 + 메인.**

---

## 0. 요소 정의

| 요소 | 정체 | 위치 |
|---|---|---|
| **Agent / Subagent** | 위임받아 일하고 결과만 반환하는 분리 인스턴스 | `.pi/agents/<name>.md` (+ 메인 = `AGENTS.md`) |
| **Custom Tool** | `defineTool(...)` 단일 결정론적 도구 | Extension 팩토리 안에서 `pi.registerTool`로 등록 |
| **Extension** | `export default function (pi: ExtensionAPI) {…}` 팩토리 모듈 — 도구·훅을 묶음. **과제 "Pi Extension" 요건 = 이것** | `.pi/extensions/<name>.ts` (jiti, TS 직접) |
| **Hook** | `pi.on("tool_call", …)`. `{block,reason}`으로 도구 실행 차단 | Extension 내부 |
| **Skill** | 코드 없는 절차 문서. 모델이 필요 시 `read`로 로드 | `.pi/skills/<name>/SKILL.md` 자동 발견 |
| **MCP** | 외부 도구함 연결(실제 키) | `.pi/mcp.json` + `pi-mcp-adapter` |

> ⚠️ **custom tool ≠ Extension.** `defineTool` 하나는 *tool*. 과제 *Pi Extension*은 그것들을 팩토리 모듈로 **묶어 로드**한 것. `createExtension` API는 없다.

---

## 1. Agent / Subagent (메인 + 서브 5종)

**불변 원칙:** 행사 1개 = Pi 세션 1개. 그 세션의 메인(Planner)이 사용자와 대화하며 서브에이전트에 일을 위임하고 결과를 종합한다.
홈 화면은 세션이 아니라 여러 세션을 가로지르는 조회 대시보드이며 에이전트가 없다.

| Agent | 한 줄 역할 | 정의 | 트리거 / 설정 |
|---|---|---|---|
| **메인 (Planner)** | 세션 메인 엔진 — 대화·되묻기·예산·발송 판단·위임 종합·재기획 | `AGENTS.md`(세션 프롬프트) | 세션 시작 시 로드 |
| `researcher` | 외부 조사(장소·업체·시세·날씨). 출처 필수, 병렬 fan-out | `.pi/agents/researcher.md` | 메인이 spawn · `run_in_background` |
| `writer` | 제안서 초안(출처 인용 `[n]`·확정값 표기) | `.pi/agents/writer.md` | 메인이 spawn · `read`만·haiku |
| `critic` | 초안 다각도 검토 + 처리주체 라우팅(직접 수정 안 함) | `.pi/agents/critic.md` | 메인이 spawn · sonnet·`inherit_context:false` |
| `secretary` | 통신(메일) → 중립 회의록(사실 추출·태깅) | `.pi/agents/secretary.md` | 작업공간 **'점검'**으로 호출(수동·주기 자동) |
| `monitor` | 변화 감지 → 재기획 필요성 판정(직접 수정 안 함) | `.pi/agents/monitor.md` | 작업공간 **'점검'**으로 호출(수동·주기 자동) |

> "바깥 정보"를 다루는 셋은 방향이 달라 안 겹친다: **researcher=나가서 찾음 · monitor=지켜봄 · secretary=들어온 걸 받음.**

### 협업 흐름

```
사용자 ─조건─▶ 메인(Planner)
   ├ [조사: 병렬 fan-out]  rag_query(과거 사례, 메인이 직접) + researcher #1..N(run_in_background) → 종합
   ├ [선택 게이트]  확정될 후보(장소·업체)는 ask_user_question으로 사용자가 직접 고름 → confirmed🔒
   ├ [작성·검토 루프]  writer(초안) ⇄ critic(판정+수정방향+처리주체)  "통과" 또는 최대 2회
   │        └ critic 처리주체대로: writer 재작성 / 재조사(researcher) / 사용자 판단(ask_user_question)
   └ 제안서 완성(save_report) / 메일 본문 ──승인 게이트──▶ Gmail MCP 발송

[운영 중 변화 — 작업공간 '점검'(수동 버튼 + 운영 워크스페이스를 콜드로 열고 1주 경과면 자동 1회)이 호출]
'점검' ─▶ secretary(받은 편지함 분류·save_comms) + get_weather + monitor 관점 재기획 판단
        ─▶ 메인: 영향 있으면 replanChangedInputs로 재기획 배너만 올림(실제 재기획은 사용자가 요청)
```

- **위임의 핵심:** researcher·critic·secretary·monitor는 이 대화를 못 본다(`inherit_context` off). 호출 시 prompt에 **무엇을·어떤 입력으로** 할지 자기완결적으로 담는다(출처 안 주면 서브가 지어냄 — 실측된 실패 모드).
- **통제 철학:** 조사·초안·검토·계산은 AI가 빠르게, **확정·수정·발송 등 돈이 들거나 외부로 나가는 작업은 사람이 개입**(승인 게이트).
- **불변 가드:** 잠금(confirmed🔒)·집행(spent)·계약 항목은 어떤 에이전트도 변경하지 않으며, 재기획은 잔여 예산 범위 내에서만(`ARCHITECTURE.md §7`).

---

## 2. Custom Tool + Extension — `event-tools` (자작 Pi Extension)

`.pi/extensions/event-tools.ts` = `export default function (pi)` 팩토리 모듈에 **도구 8개 + 잠금/집행/승인 가드 훅**을 묶은 것 = **과제 "Pi Extension" 요건**.

| 도구 | 입력 → 출력 | 비고 |
|---|---|---|
| `estimate_budget` | 유형·인원·총예산 → 항목별 배분 | 결정론적 산수(+재배분) |
| `build_checklist` | 행사일 → D-30/14/7/1/당일 마감 베이스 | 날짜 계산 |
| `update_state` | 상태 변경 → **보드(state.json) 쓰기 유일 통로** | 잠금🔒·집행 가드 내장(Hook) |
| `save_report` | 마크다운 → `workspace/<id>/proposal.md` | 결과 리포트(1개) |
| `get_weather` | 좌표/장소+날짜 → 날씨 | Open-Meteo |
| `save_comms` | 통신 분류 → `comms.json` | secretary 결과 적립 |
| `save_case` | 사례 md → `cases/<id>.md` | 적립(이후 `rag_index`) |
| `ask_user_question` | 질문·선택지 → 구조화 되묻기 | `ctx.ui`(되묻기/승인) |

**Hook(가드, 코드 강제):** 잠금 가드(`confirmed🔒`·계약 항목 변경 차단) · 집행 가드(`spent` 변경 차단) ·
승인 게이트(메일 발송·사례 적립 직전 `ctx.ui.confirm`).

> 견적 비교·식이 집계·접근성 점검 등은 LLM이 맥락에서 처리 → 에이전트/Skill 프롬프트로 흡수(도구화하지 않음).

---

## 3. 채택 Extension / 패키지 (`.pi/settings.json`)

| 패키지 | 역할 |
|---|---|
| `pi-local-rag` | **사례 RAG**. `rag_query`(하이브리드 벡터+BM25)·`rag_index`. 내부 SQLite(FTS5+sqlite-vec), 별도 MCP·DB 없음. 사례 = `cases/*.md` |
| `pi-mcp-adapter` | `.pi/mcp.json` MCP 서버를 에이전트에 노출 |
| `pi-web-access` | researcher 웹·검색(네이티브 확장, MCP 아님) |
| `@tintinweb/pi-subagents` | 서브에이전트 spawn(`Agent` 도구) |

---

## 4. Skill — `.pi/skills/<name>/SKILL.md` (4종)

| skill | 내용 | 짝 |
|---|---|---|
| `budget-policy` | 유형별 예산 배분 원칙 | ↔ `estimate_budget` |
| `notice-writer` | 공지·메일 본문 채널별 톤(템플릿 자산 포함) | ↔ Gmail MCP |
| `risk-assessment` | omnibus 사전 점검: 리스크·행정 컴플라이언스(인허가·보험·소방)·접근성·비상대응·식이안전 | critic + Planner 공용 |
| `satisfaction-survey` | 사후 설문 설계 → 결과·감정 분석 | 사후(완료 단계) |

> 모델이 task를 만나면 `read`로 SKILL.md를 로드(progressive disclosure) → 백엔드가 그 경로를 보고 "Skill 사용"으로 카운트.

---

## 5. MCP — 외부 도구 3종 (`.pi/mcp.json`)

외부 도구는 **커뮤니티 MCP 서버(npx)** 를 `pi-mcp-adapter`로 연결해 에이전트에 노출한다. 전부 표준 Google API라 개인 계정으로 바로 작동.

| 도구 | 서버 | 에이전트가 하는 일 |
|---|---|---|
| **메일** | `@gongrzhe/server-gmail-autoauth-mcp` | 업체·기관 컨택, 회신·견적 조회, **발송(사람 승인 게이트 뒤)** |
| **캘린더** | `@cocal/google-calendar-mcp` | 행사일 요일·공휴일 확인, 마일스톤을 `primary` 캘린더에 등록 |
| **지도** | `@modelcontextprotocol/server-google-maps` | 장소 지오코딩, 주변 편의·평점, 출발지→장소 거리/접근성 |

- **왜 커뮤니티 서버인가:** 공식 Google Workspace 원격 MCP는 **Developer Preview Program 게이팅**이라 일반 계정으론 도구 실행이 거부된다(`The caller does not have permission`). 그래서 표준 API를 쓰는 커뮤니티 서버를 개인 계정으로 채택.
- **비밀 관리:** 커밋되는 `.pi/mcp.json`엔 비밀이 없다(`${VAR}` 자리표시자만). 실제 비밀은 repo 밖 — OAuth 토큰은 `~/.gmail-mcp/`·`~/.config/google-calendar-mcp/`, Maps 키는 `.env`(gitignore). 어댑터가 실행 시 셸 env에서 주입.
- **연결성:** MCP는 lazy라 **쓴 서버만** 연결된다(앱은 셋업 없이도 실행, 외부 도구만 비활성). 모든 작업은 사용자 계정 권한을 상속.
- **설치·인증·재현 절차는 `README.md`의 설치 섹션** 참고.

> 웹 검색은 MCP가 아니라 네이티브 확장 `pi-web-access`로 처리(§3). 날씨도 MCP가 아니라 백엔드 Open-Meteo(`ARCHITECTURE.md §2`).

---

## 6. 필수 5요소 충족 요약

- **Pi**: `pi --mode rpc` 세션 + subscribe 스트리밍(동작 타임라인) + 중지·되묻기·승인 + 서브에이전트 6종(§1).
- **Skill**: §4 4종(최소 1 요건 충족).
- **MCP**: §5 gmail·calendar·maps 외부 소비.
- **Pi Extension**: §2 자작 `event-tools`(도구 8 + 가드 훅) + §3 채택 `pi-local-rag`.
- **Web UI**: `frontend/` 홈 + 워크스페이스(S0–S7, 시각은 `DESIGN.md`). 화면 요소 마커로 5요소를 시각 증명.
