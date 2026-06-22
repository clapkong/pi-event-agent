# pi-event-agent

**Pi 기반 행사 기획 AI 에이전트 웹 서비스.**
사용자가 행사 조건(유형·인원·예산·날짜·장소)을 입력하면, 실제 도구를 쓰는 Pi 에이전트가 기획 전 과정
(조건→리서치→예산→업체→제안서→발송→정산→적립)을 **사람 체크포인트를 끼고** 한 번에 처리하고,
**과거 행사의 업체·스펙·교훈을 재사용**해 매번 처음부터 다시 하지 않게 한다.

> 오픈소스 SW 수업 기말 프로젝트. 설계 정본은 [`docs/`](docs/) — 시스템 구조([`ARCHITECTURE`](docs/ARCHITECTURE.md))·상태 모델([`STATE_MODEL`](docs/STATE_MODEL.md))·Pi 요소([`PI_ELEMENTS`](docs/PI_ELEMENTS.md))·에이전트([`AGENTS_DETAILS`](docs/AGENTS_DETAILS.md))·MCP([`MCP_DETAILS`](docs/MCP_DETAILS.md))·디자인([`DESIGN`](docs/DESIGN.md)).

---

## 프로젝트 소개

- **문제** — 행사 기획은 리서치·계산·문서화·진행 관리가 뒤섞인 반복 노동인데, 매번 처음부터 다시 하고 **과거 경험이 다음 행사로 이어지지 않는다.**
- **대상 사용자** — 소규모 행사를 직접 기획·운영하는 담당자(사내 워크숍·채용설명회·밋업·세미나·동아리). AI에게 초안은 맡기되 **예산·업체 같은 확정 사항은 직접 통제**하고 싶은 사람.
- **차별점(ChatGPT 대비)** — 한 방·말로만·내 과거를 모름 ❌ → **end-to-end · 실제 도구로 실행(검색·지도·메일·캘린더) · 내 과거 행사 재사용** ✅.
- **불변 원칙** — 행사 1개 = 워크스페이스 1개 = 작업폴더(`cwd`) 1개 = Pi 세션 1개 = 결과 리포트 1개.

---

## 주요 기능

- **동작 타임라인** — 에이전트의 리서치·도구 실행을 실시간 스트리밍으로 보여주고, 각 스텝에 **Pi 요소 마커(MCP/Extension/Skill)** 를 단다.
- **Human-in-the-loop 3종** — 실행 중 **중지**, 선택지 **되묻기**, 발송·적립 직전 **승인 게이트**.
- **상태 모델** — 입력/산출/확정 3겹 + 잠금(확정🔒)·신선도(stale) 꼬리표. **예산 3상태**(계획·확정·집행) · **업체 4단계**(후보→견적→확정→계약).
- **재기획** — 입력(날씨·장소 등)이 바뀌면 영향 산출물을 stale로 표시하고, **잠금 항목은 보존**한 채 잔여 예산 범위에서 계획만 재배분.
- **제안서 + 버전 이력** — 에이전트가 작성한 제안서를 사람이 직접 편집·확정, AI/사람 버전 이력과 **출처 인용(`#N`) 드로어** 제공.
- **과거 사례 재사용(RAG)** — 완료된 행사를 사례 `.md`로 적립하고, 새 기획에서 하이브리드 검색으로 인용 → **사례 역추적**으로 순환을 닫는다.
- **실제 도구 연결** — Gmail 발송(승인 게이트 뒤)·Google Calendar 일정 등록·Google Maps 장소/접근성·날씨(Open-Meteo).

---

## 시스템 구조

```
[React + Vite 프런트]  홈 · 기획 폼 · 동작 타임라인 · 작업공간 · 문서/사례
   │  WebSocket(에이전트 스트림)  +  REST(보드·제안서·사례·통신·날씨)
[얇은 Node 백엔드 (Fastify)]  워크스페이스별 Pi 세션 소유 + rpc↔계약 변환
   │  stdin/stdout JSONL
[pi --mode rpc (자식 프로세스)]  Skill / Extension / MCP / 서브에이전트 실행
   │
[LLM: OpenRouter · claude-sonnet-4.6]      [데이터: workspace/<id>/*.json·md + cases/*.md(pi-local-rag)]
```

SDK 임베드가 아니라 **`pi --mode rpc` CLI를 자식 프로세스로 띄워** 통신한다. 상세는 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Pi · Skill · MCP · Pi Extension 활용

> 필수 5요소를 무엇으로 충족하는지. 카탈로그 전체는 [`docs/PI_ELEMENTS.md`](docs/PI_ELEMENTS.md).

| 요소 | 우리 구현 |
|---|---|
| **Pi** | `pi --mode rpc` 세션 + subscribe 스트리밍(타임라인) + 중지·되묻기·승인 + **서브에이전트 6종**(메인 Planner + researcher·writer·critic·secretary·monitor) |
| **Skill** | `.pi/skills/<name>/SKILL.md` **4종** — `budget-policy`·`notice-writer`·`risk-assessment`·`satisfaction-survey` |
| **MCP** | `.pi/mcp.json` **3종** — 메일(Gmail)·캘린더(Google Calendar)·지도(Google Maps), 커뮤니티 npx 서버를 `pi-mcp-adapter`로 연결 |
| **Pi Extension** | 자작 [`event-tools`](.pi/extensions/event-tools.ts) — `export default (pi)=>{}` 팩토리에 **도구 8개 + 잠금/집행/승인 가드 훅**(`estimate_budget`·`build_checklist`·`update_state`·`save_report`·`get_weather`·`save_comms`·`save_case`·`ask_user_question`). + 채택 `pi-local-rag`(사례 RAG) |
| **Web UI** | React + Vite (CLI 아님). 홈 + 워크스페이스(타임라인·작업공간·문서·사례), 화면 요소 마커로 5요소 시각 증명 |

---

## 실행 화면

> ⚠️ 실제 앱 스크린샷은 **추후 추가 예정**(placeholder). 아래는 채워질 자리.

| 화면 | 스크린샷 |
|---|---|
| 홈 대시보드 | _(스크린샷 추가 예정)_ |
| 기획 폼 (새 행사) | _(스크린샷 추가 예정)_ |
| 동작 타임라인 (에이전트) | _(스크린샷 추가 예정)_ |
| 작업공간 (상태 모델) | _(스크린샷 추가 예정)_ |
| 결과 문서 · 인용 드로어 | _(스크린샷 추가 예정)_ |

---

## 기술 스택

전부 **TypeScript · Node.js · ESM**.

| 레이어 | 기술 |
|---|---|
| 프런트 | React 18 · Vite · react-router · react-markdown |
| 통신 | WebSocket(에이전트 스트림) + REST(데이터) |
| 백엔드 | Fastify · `@fastify/websocket` · tsx |
| 에이전트 | `pi`(`@earendil-works/pi-coding-agent`) `--mode rpc` 자식 프로세스 |
| Pi 패키지 | `@tintinweb/pi-subagents` · `pi-mcp-adapter` · `pi-web-access` · `pi-local-rag` |
| LLM | OpenRouter · `anthropic/claude-sonnet-4.6` |
| 데이터/RAG | `.md`/`.json` 파일 + `pi-local-rag`(내부 SQLite FTS5 + sqlite-vec 하이브리드, 오프라인 임베딩) |
| 외부 도구 | Gmail · Google Calendar · Google Maps (MCP) · Open-Meteo(날씨) |

---

## 설치

**사전 요구**: Node.js LTS, 전역 `pi` 설치, `OPENROUTER_API_KEY`(LLM 필수).

```bash
git clone <repo-url> && cd pi-event-agent

# 1) 프런트 · 백엔드 의존성
cd frontend && npm install && cd ..
cd backend  && npm install && cd ..

# 2) Pi 확장 복원 (설치본 .pi/npm/ 은 gitignore — 매니페스트 .pi/settings.json 기준 1회)
pi install npm:@tintinweb/pi-subagents -l
pi install npm:pi-mcp-adapter -l
pi install npm:pi-web-access -l
pi install npm:pi-local-rag -l        # 사례 RAG (하이브리드 검색)

# 3) 키 (.env, gitignore)
echo 'OPENROUTER_API_KEY=<발급 키>' >> .env
```

### MCP 셋업 (메일·캘린더·지도 — 선택, 외부 도구 쓸 때만)

외부 도구는 **커뮤니티 MCP 서버**(npx)를 [`.pi/mcp.json`](.pi/mcp.json)(커밋됨, 비밀은 `${VAR}` 자리표시자)에 등록한다.
표준 Google API라 개인 계정으로 바로 작동한다(공식 Workspace 원격 MCP는 프리뷰 게이팅이라 일반 계정 불가 → 커뮤니티 서버 채택).

| 도구 | 서버 | 인증 |
|---|---|---|
| 메일 | `@gongrzhe/server-gmail-autoauth-mcp` | `npx -y @gongrzhe/server-gmail-autoauth-mcp auth` (브라우저 1회) |
| 캘린더 | `@cocal/google-calendar-mcp` | `GOOGLE_OAUTH_CREDENTIALS=<oauth.json> npx -y @cocal/google-calendar-mcp auth` |
| 지도 | `@modelcontextprotocol/server-google-maps` | env `GOOGLE_MAPS_API_KEY` (Maps는 결제 사용 설정 필요) |

- 사전: Google Cloud 개인 프로젝트에서 Gmail·Calendar API 사용 설정 + **데스크톱 OAuth 클라이언트** 발급, Maps는 결제 + API 키.
- 비밀은 repo 밖: OAuth 토큰은 `~/.gmail-mcp/`·`~/.config/google-calendar-mcp/`, **Maps 키는 `.env`**(gitignore). 어댑터가 실행 시 셸 env의 `${GOOGLE_MAPS_API_KEY}`를 주입.
  ```bash
  echo 'GOOGLE_MAPS_API_KEY=<발급 Maps 키>' >> .env
  ```
- MCP는 lazy라 **이 셋업 없이도 앱은 실행**된다(검색·기획 동작, 외부 도구만 비활성).
- 처음부터 재현·트러블슈팅: [`docs/MCP_DETAILS.md`](docs/MCP_DETAILS.md).

---

## 실행

```bash
# 1) 백엔드 (에이전트 — pi --mode rpc ↔ WebSocket/REST 브리지)
#    데이터 화면(작업공간·문서·사례)과 "AI 에이전트" 화면 모두 이 백엔드가 떠 있어야 동작.
cd backend
set -a; source ../.env; set +a    # .env의 키(OpenRouter·Maps)를 셸에 로드
npm run dev                       # http://127.0.0.1:8787  (ws /ws?ws=<id>)

# 2) 프런트 (UI)
cd frontend && npm run dev        # http://localhost:5173
```

### (선택) 캘린더 임베드 — 작업공간 일정 카드에 본인 Google Calendar 표시

```bash
echo 'VITE_GCAL_ID=you@gmail.com' >> frontend/.env.local   # 본인 캘린더 ID(보통 Gmail 주소)
```

- 미설정 시 **마일스톤 미니 달력**으로 폴백. 설정 후 **dev 서버 재시작**. 브라우저가 해당 Google 계정에 로그인돼 있어야 비공개 캘린더가 렌더된다.

---

## 현재 상태

- **에이전트 실연결**: 동작 타임라인·되묻기·승인·스트리밍이 실제로 돈다. Extension(`event-tools`)·Skill·MCP(메일·캘린더·지도)·사례 RAG(`pi-local-rag`) 연동. 작업공간 사람 편집·점검·완료(→사례 적립)·캘린더 등록 포함.
- **일부 mock 잔존**: 홈 대시보드 일부 위젯(알림 등)은 REST 미연결(전환 진행 중). 프런트는 계약([`contract.ts`](frontend/src/agent/contract.ts))에만 의존해 교체가 무수정.

## 라이선스

(예정)
