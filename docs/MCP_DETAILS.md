# MCP 연동 상세 (메일·캘린더·지도)

> 행사 기획 에이전트가 쓰는 외부 도구(MCP)를 Pi에 붙이는 **현행 셋업 + 재현 가이드.**
> 결론: **커뮤니티 MCP 서버(npx)를 개인 Google 계정**으로 쓰고, 설정은 **`.pi/mcp.json`(프로젝트, 커밋됨)** 에 둔다. 비밀은 `${VAR}`로 빼서 repo엔 노출 0. 공식 Google Workspace 원격 MCP는 **프리뷰 게이팅**이라 일반 계정으로 사용 불가(아래 §0).

---

## 0. 왜 이렇게 — 공식 MCP는 못 쓴다

Google은 공식 원격 MCP(`gmailmcp.googleapis.com`·`calendarmcp.googleapis.com`)를 제공하지만, **Google Workspace Developer Preview Program에 가입·승인된 계정/프로젝트만** 실제 데이터 작업이 된다.

- 증상: OAuth·도구 목록(캐시)까지는 되는데, **도구 실행 시 `The caller does not have permission`** (프로젝트 감사 로그에도 안 남음 = 서비스 경계 차단).
- gcloud로 전 변수 검증함: API 사용 설정 O, 프로젝트 owner O, 토큰·스코프 정상 O, **직접 Google API는 됨** — 그런데 MCP 래퍼 서비스만 거부.
- 프로그램 가입은 **승인에 며칠** 걸리고 **조직 단위**라 학교/학생 계정으론 불가.

→ **공식은 포기.** 대신 **표준 Gmail/Calendar/Maps API를 쓰는 커뮤니티 MCP 서버**를 채택 — 개인 계정으로 게이팅 없이 바로 작동.

---

## 1. 구성 (현행)

| 도구 | MCP 서버 (npx) | API | 인증 |
|---|---|---|---|
| **메일** | `@gongrzhe/server-gmail-autoauth-mcp` | Gmail API | OAuth (브라우저 1회), refresh로 자동 갱신 |
| **캘린더** | `@cocal/google-calendar-mcp` | Calendar API | OAuth (브라우저 1회) |
| **지도** | `@modelcontextprotocol/server-google-maps` | Google Maps Platform | API 키 (결제 필요) |

- 모두 **개인 Google 계정**(예: `clapkong23@gmail.com`) + **개인 Cloud 프로젝트**.
- 설정은 **`.pi/mcp.json`** (프로젝트 루트 `.pi/`, skills·extensions와 같은 자리, **커밋됨**). pi-mcp-adapter가 이 파일을 자동 로드.
- **비밀은 파일에 안 박는다** — maps 키·OAuth 클라이언트 경로는 `${VAR}`/`${HOME}`로 참조. 실제 값은 홈 디렉터리·셸 env에.
- 별도 Pi 익스텐션 `pi-mcp-adapter`가 이 서버들을 에이전트에 노출(프록시). 검색은 `pi-web-access`(네이티브, MCP 아님)로 별도.

---

## 2. 파일·위치

| 위치 | 커밋? | 내용 |
|---|---|---|
| `.pi/mcp.json` | ✅ 커밋 | 서버 3개 정의 (비밀은 `${VAR}`) |
| `~/.gmail-mcp/gcp-oauth.keys.json` | ✗ (홈) | **OAuth 클라이언트** (gmail·calendar 공용) |
| `~/.gmail-mcp/credentials.json` | ✗ (홈) | gmail 토큰(refresh 포함) |
| `~/.config/google-calendar-mcp/tokens.json` | ✗ (홈) | calendar 토큰 |
| `.env` 의 `GOOGLE_MAPS_API_KEY` | ✗ (gitignore) | maps API 키 (`OPENROUTER_API_KEY`와 같은 파일 = 비밀 단일 소스) |

> **커밋되는 건 `.pi/mcp.json` 뿐이고, 비밀은 전부 홈/`.env`.** 그래서 repo에 비밀 노출 0.

---

## 3. 재현 (처음부터)

### 3.1 Google Cloud (개인 계정, 브라우저/gcloud)
1. 개인 프로젝트 생성. (`gcloud projects create <id>` 또는 콘솔)
2. **Gmail·Calendar API 사용 설정** (무료, 카드 불필요):
   ```bash
   gcloud services enable gmail.googleapis.com calendar-json.googleapis.com --project=<PID>
   ```
3. **OAuth 동의 화면**: 대상 **외부(External)**, 앱 이름 입력, **테스트 사용자에 본인 이메일 추가**, 데이터 액세스에 스코프 추가:
   ```
   https://mail.google.com/
   https://www.googleapis.com/auth/calendar
   ```
4. **OAuth 클라이언트 → 데스크톱 앱** 생성 → **JSON 다운로드** → **`~/.gmail-mcp/gcp-oauth.keys.json`** 으로 저장 (gmail·calendar **공용**).

### 3.2 인증 (각 서버, 브라우저 1회)
```bash
# gmail
npx -y @gongrzhe/server-gmail-autoauth-mcp auth
#  → ~/.gmail-mcp/credentials.json 생성

# calendar (같은 OAuth 클라이언트 재사용)
GOOGLE_OAUTH_CREDENTIALS="$HOME/.gmail-mcp/gcp-oauth.keys.json" npx -y @cocal/google-calendar-mcp auth
#  → ~/.config/google-calendar-mcp/tokens.json 생성
```
> 테스트 모드 앱이라 "확인되지 않은 앱" 경고 → **고급 → 계속.**

### 3.3 지도 (Maps — 결제 필요)
```bash
# 개인 프로젝트에 결제(카드) 연결 후:
gcloud services enable geocoding-backend.googleapis.com places-backend.googleapis.com \
  directions-backend.googleapis.com distance-matrix-backend.googleapis.com \
  elevation-backend.googleapis.com apikeys.googleapis.com --project=<PID>
gcloud services api-keys create --display-name="Maps MCP" --project=<PID>   # keyString 복사

# 키를 셸 env로 (커밋 안 됨). 이 프로젝트는 (A) .env 단일 소스 사용:
#  (A) .env에 모음 — 비밀 한 곳(OPENROUTER_API_KEY 옆에). pi 실행 셸에서 로드.
echo 'GOOGLE_MAPS_API_KEY=<발급된 키>' >> .env
set -a; source .env; set +a                          # 이 셸에 export → 바로 pi
#  (B) 대안: ~/.zshrc에 영구 export — 새 터미널마다 자동(.env 안 거쳐도 됨)
echo 'export GOOGLE_MAPS_API_KEY="<발급된 키>"' >> ~/.zshrc && source ~/.zshrc
```
> ⚠️ 학교(Workspace) 계정은 보통 카드 결제가 막힘 → Maps는 **개인 계정**에서.

### 3.4 설정 `.pi/mcp.json` (커밋됨)
```json
{
  "mcpServers": {
    "gmail":    { "command": "npx", "args": ["-y", "@gongrzhe/server-gmail-autoauth-mcp"] },
    "calendar": { "command": "npx", "args": ["-y", "@cocal/google-calendar-mcp"],
                  "env": { "GOOGLE_OAUTH_CREDENTIALS": "${HOME}/.gmail-mcp/gcp-oauth.keys.json" } },
    "maps":     { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-google-maps"],
                  "env": { "GOOGLE_MAPS_API_KEY": "${GOOGLE_MAPS_API_KEY}" } }
  }
}
```
- `${HOME}`·`${GOOGLE_MAPS_API_KEY}`는 어댑터가 **env 필드에서 보간**(process env에서 읽음). → 파일엔 비밀 0, 커밋 가능.
- maps 키는 **pi 실행 셸의 env**에 있어야 함(§3.3 A/B). 백엔드 경유 실행이면 백엔드가 `.env`를 로드(dotenv)해 pi 서브프로세스에 넘기므로 자동. **터미널 직접 실행**이면 `set -a; source .env; set +a` 후 `pi` (또는 ~/.zshrc 방식).

### 3.5 사용·검증 (Pi 안)
`.env` 로드 후 Pi 실행(`set -a; source .env; set +a && pi`) 다음:
```
"내 메일 라벨 보여줘"        → gmail_list_email_labels
"내 캘린더 일정 보여줘"      → calendar_list-calendars / list-events
"연세대 근처 카페 찾아줘"    → maps_maps_geocode + maps_maps_search_places
```

---

## 4. 트러블슈팅

| 증상 | 원인 / 해결 |
|---|---|
| 공식 MCP가 `The caller does not have permission` | 프리뷰 게이팅 → 공식은 못 씀. 커뮤니티 서버로(§0). |
| `/mcp` 패널에 `(not cached)` | 새 서버 첫 세션. `/mcp reconnect <서버>` 또는 Pi 재시작. npx 첫 다운로드라 잠깐 걸림. |
| `MCP: 1/3` 등 일부만 연결 | lazy라 **쓴 서버만** 연결됨. 정상. |
| Maps만 안 됨 / 키 없음 | `${GOOGLE_MAPS_API_KEY}` 미설정 — pi 실행 전 **`.env` 로드**(`set -a; source .env; set +a`). 키 전파 1~2분. |
| "확인되지 않은 앱" 경고 | 테스트 모드. 고급 → 계속. |
| gmail/calendar 권한 거부 | 학교(Workspace) 조직이 third-party 앱 차단 가능 → **개인 계정** 사용. |

---

## 5. 보안

- 커밋되는 `.pi/mcp.json`엔 **비밀 없음**(`${VAR}`만). 실제 비밀: OAuth 클라이언트·토큰은 **홈 디렉터리**(`~/.gmail-mcp/` 등), Maps 키는 **`.env`**(gitignore).
- 스코프: gmail = `mail.google.com`, calendar = `calendar`. Maps 키는 데모용 무제한 — 운영 시 API/도메인 제한 권장.
- 모든 작업은 사용자 계정 권한을 상속(데이터 거버넌스). 발송·생성 등은 에이전트 응답을 검토하고 사용.

---

## 6. 관련
- 어댑터: `pi-mcp-adapter` (`.pi/mcp.json` 자동 로드)
- 검색·웹: `pi-web-access` (네이티브 확장, MCP 아님)
- 작업 기록: `docs/ai-usage-log.md`
