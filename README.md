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
├─ backend/                        # Pi 세션 + WS 백엔드                          (Pi부터 새로 작성 예정)
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

- **UI 구현 (mock — 실제 기능 아님)**: 홈 · 기획 폼 · 동작 타임라인(되묻기·승인·모델 전환) · 작업공간·상태 모델 · 결과 문서. 프런트는 계약(`contract.ts`)만 의존하므로, 백엔드가 같은 계약을 구현하면 mock ↔ 실제를 무수정으로 교체한다.
- **미구현**: 백엔드 전체 — Pi 세션·스트리밍 · Extension · Skill · MCP · 사례 RAG(pi-local-rag) · 승인 발송 · 사례 순환. **Pi부터 새로 작성 예정.**

```bash
# 프런트 (mock, 외부 의존 0)
cd frontend && npm install && npm run dev
```

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

## Pi 필수 5요소

- **Pi** — 코어 임베드 + 스트리밍
- **Skill** — `skills/<이름>/SKILL.md` 절차
- **MCP** — 외부 소비(메일·캘린더·지도 = 커뮤니티 서버, `.pi/mcp.json`). 사례 검색은 `pi-local-rag`(.md 인덱싱)
- **Pi Extension** — `extensions/`의 커스텀 결정론적 도구
- **Web UI** — CLI 아닌 React
