# pi-event-agent

Pi 에이전트 프레임워크 기반 **행사 기획 AI 에이전트 웹 서비스**.
사용자가 행사 조건(유형·인원·예산)을 입력하면 에이전트가 진행 과정을 스트리밍하며
리서치·기획·산출하고, 과거 행사의 업체·스펙·교훈을 다음 기획에 재사용한다.

## 저장소 구조

```
.
├─ .pi/
│  ├─ agents/                      # 전용 에이전트 정의 (.md)
│  └─ mcp.json                     # MCP 서버 등록 (메일·캘린더·지도, 커뮤니티 서버)
├─ extensions/                     # Pi Extension (커스텀 결정론적 도구; 사례 RAG는 pi-local-rag 채택)
├─ cases/                          # 과거 사례 .md (pi-local-rag 인덱싱 대상)
├─ skills/                         # Skill (<이름>/SKILL.md 절차, 자동 발견)
├─ frontend/                       # React + Vite 프런트 (홈·기획폼·타임라인·작업공간·문서, mock 구동)
├─ backend/                        # Pi 세션(pi --mode rpc) ↔ WebSocket·REST 브리지
├─ docs/                           # 공개 문서
│  ├─ DESIGN.md                    #   디자인 시스템 (시각 토큰·컴포넌트)
│  ├─ ai-usage-log.md              #   AI 사용 기록
│  └─ mockup/                      #   실행 화면 / 시안 PNG
├─ CLAUDE.md                       # 에이전트 작업 가이드
├─ .gitignore
├─ LICENSE                         # (예정)
└─ README.md
```

> 기획·설계 문서는 `plans/`에 모아 로컬 전용(`.gitignore`)으로 둔다 — 공개 repo엔 코드 + `README` + `docs/`만.

## 현재 상태

- **에이전트 실연결**: 백엔드(`backend/` — `pi --mode rpc` ↔ WebSocket 브리지)로 동작 타임라인·되묻기·승인·모델 전환·스트리밍이 실제로 돈다. Extension(`event-tools`: 예산·체크리스트·상태·제안서·통신·사례·날씨) · Skill · MCP(메일·캘린더·지도) · 사례 RAG(pi-local-rag) 연동. 작업공간 사람 편집·점검·완료(→사례 적립)·캘린더 등록 포함.
- **일부 mock 잔존**: 홈 알림·사례 목록 등 일부 데이터 화면은 REST 미연결(전환 진행 중). 프런트는 계약(`contract.ts`)에 의존해 교체가 무수정.

### 실행

```bash
# 1) 프런트 (UI)
cd frontend && npm install && npm run dev          # http://localhost:5173

# 2) 백엔드 (에이전트 — pi --mode rpc ↔ WebSocket 브리지)
#    "AI 에이전트" 화면은 이 백엔드가 떠 있어야 실제로 동작한다.
cd backend && npm install && npm run dev           # ws://127.0.0.1:8787
```

> 데이터 화면(홈·작업공간·문서)은 백엔드 REST(`/api/workspaces…`)에서 읽는다. 에이전트 대화·점검·완료(사례 적립)·캘린더 등록은 위 백엔드 + Pi/MCP 셋업(아래)이 필요하다.

#### (선택) 캘린더 임베드 — 작업공간 일정 카드에 본인 Google Calendar 표시

```bash
# frontend/.env.local 에 본인 캘린더 ID(보통 Gmail 주소)를 넣는다.
echo 'VITE_GCAL_ID=you@gmail.com' >> frontend/.env.local
```

- **`.env` 아니라 `.env.local`?** 둘 다 `.gitignore`(`.env.*`)라 어느 쪽이든 커밋은 안 된다. 다만 **`.env.local`이 "개인·기기별 로컬 값"의 관례 자리**(Vite가 항상 로드하되 git에서 빼는 용도)라 권장. `.env`에 넣어도 동작은 같다.
- 미설정 시엔 **마일스톤 미니 달력**으로 폴백. 설정 후 **dev 서버 재시작**.
- 임베드는 브라우저가 해당 Google 계정에 로그인돼 있어야 본인(비공개) 캘린더를 렌더한다. 일정의 "**캘린더에 등록**" 버튼으로 만든 이벤트가 이 임베드에 그대로 보인다.

### Pi 셋업 (확장 복원)

전역 `pi` 설치 후, 이 프로젝트가 쓰는 확장을 **프로젝트 로컬**로 복원한다.
(매니페스트 `.pi/settings.json`에 기록돼 있으며 설치본 `.pi/npm/`은 gitignore되므로, fresh clone에선 아래를 1회 실행)

```bash
pi install npm:@tintinweb/pi-subagents -l
pi install npm:pi-local-rag -l        # 사례 RAG (하이브리드 검색)
```

### MCP 셋업 (메일·캘린더·지도)

외부 도구는 **커뮤니티 MCP 서버**(npx)를 **`.pi/mcp.json`**(프로젝트 `.pi/`, skills·extensions와 같은 자리, **커밋됨**)에 등록한다. 비밀(maps 키 등)은 `${VAR}`로 빼서 커밋물엔 노출 없음. 전부 표준 Google API라 개인 계정으로 바로 작동한다. (공식 Google Workspace 원격 MCP는 Developer Preview Program 등록 게이팅이라 일반 계정으로 사용 불가 — 그래서 커뮤니티 서버 채택.)

| 도구 | 서버 | 인증 |
|---|---|---|
| 메일 | `@gongrzhe/server-gmail-autoauth-mcp` | `npx -y @gongrzhe/server-gmail-autoauth-mcp auth` (브라우저 1회) |
| 캘린더 | `@cocal/google-calendar-mcp` | `GOOGLE_OAUTH_CREDENTIALS=<oauth.json> npx -y @cocal/google-calendar-mcp auth` |
| 지도 | `@modelcontextprotocol/server-google-maps` | env `GOOGLE_MAPS_API_KEY` (Google Maps는 결제 사용 설정 필요) |

- 사전: Google Cloud 개인 프로젝트에서 Gmail·Calendar API 사용 설정 + **데스크톱 OAuth 클라이언트** 발급(`gcp-oauth.json`), Maps는 결제(카드) + API 키.
- 설정 `.pi/mcp.json`은 **커밋**(비밀은 `${VAR}` 자리표시자만). 실제 비밀은 repo 밖: OAuth 토큰은 `~/.gmail-mcp/`·`~/.config/google-calendar-mcp/`, **maps 키는 `.env`**(gitignore). 어댑터가 실행 시 셸 env에서 `${GOOGLE_MAPS_API_KEY}` 자리에 주입한다.
- **Maps 키 넣는 법** — `.env`에 모아두고(`OPENROUTER_API_KEY` 옆) pi 실행 셸에서 로드:
  ```bash
  echo 'GOOGLE_MAPS_API_KEY=<발급된 Maps 키>' >> .env
  set -a; source .env; set +a && pi      # 이 셸에 export 후 실행 (영구로는 ~/.zshrc에 export)
  ```
  백엔드 경유 실행 시엔 백엔드가 `.env`를 로드(dotenv)해 pi에 넘기므로 자동.
- MCP는 lazy라 **이 셋업 없이도 앱은 실행**된다(검색·기획 동작, 외부 도구만 비활성).
- **상세·처음부터 재현·트러블슈팅: [`docs/MCP_DETAILS.md`](docs/MCP_DETAILS.md)**

### Pi 실행

```bash
set -a; source .env; set +a   # .env의 키(OpenRouter·Maps)를 현재 셸에 로드
pi                            # 행사 워크스페이스(cwd)에서 실행 — 확장·MCP 자동 로드
```
> 매번 치기 번거로우면 `~/.zshrc`에 `alias pie='set -a; source .env; set +a && pi'` 추가 → 이후 `pie`만 치면 됨. (키는 `.env`에 그대로 — 단일 소스 유지)

## Pi 필수 5요소

- **Pi** — 코어 임베드 + 스트리밍
- **Skill** — `skills/<이름>/SKILL.md` 절차
- **MCP** — 외부 소비(메일·캘린더·지도 = 커뮤니티 서버, `.pi/mcp.json`). 사례 검색은 `pi-local-rag`(.md 인덱싱)
- **Pi Extension** — `extensions/`의 커스텀 결정론적 도구
- **Web UI** — CLI 아닌 React
