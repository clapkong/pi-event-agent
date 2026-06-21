# MCP 연동 가이드 (외부 도구 연결)

> 행사 기획 에이전트가 쓰는 외부 도구를 Pi에 붙이는 방법. **재현용** — 새 환경(교수님 채점 등)에서 이 문서만 따라오면 동일하게 셋업된다.
> 모든 비밀값(클라이언트 ID/비밀/토큰)은 `<플레이스홀더>`이며, 실제 값은 git에 올리지 않는다(아래 §보안).

---

## 0. 개요 — 무엇을, 왜 이렇게

도구는 **3갈래**이고, Gmail은 **하이브리드**(공식 + 자작)로 구성한다.

| 기능 | 경로 | 인증 |
|---|---|---|
| 웹 검색·페이지·PDF·유튜브 | **`pi-web-access`** (Pi 네이티브 확장) | 없음 (무설정) |
| 메일 읽기·검색·**초안** | **공식 Gmail 원격 MCP** (`gmailmcp.googleapis.com`) | OAuth |
| 메일 **실제 발송** | **자작 MCP 서버** (`mcp-servers/gmail-send/`) | OAuth (자체) |

**설계 의도**
- 공식 Gmail MCP는 **발송 도구가 없다**(초안 `create_draft`까지만). 그래서 실제 발송은 **직접 만든 작은 MCP 서버**가 공식 Gmail API `messages.send`를 호출해 처리한다.
- 외부(third-party) MCP 서버 코드는 쓰지 않는다 — 공식 서버 + **우리 코드**만.
- 발송은 **승인 게이트**(MCP elicitation) 뒤에서만 일어난다.

```
              pi-mcp-adapter (.mcp.json / .pi/mcp.json)
              /                                    \
   [공식 Gmail 원격 MCP]                      [자작 gmail-send MCP]
   읽기·검색·초안                              실제 발송 (messages.send)
   gmailmcp.googleapis.com                     mcp-servers/gmail-send/
   (별도) [pi-web-access] = 검색·웹 (네이티브 확장, MCP 아님)
```

---

## 1. 사전 요구사항

- **Pi** (`@earendil-works/pi-coding-agent`) 설치 + 모델 프로바이더 로그인(`/login` 또는 `OPENROUTER_API_KEY`).
- **`pi-mcp-adapter`** 설치: `pi install npm:pi-mcp-adapter` (이미 `.pi/settings.json`에 등록돼 있으면 `pi install`로 복원).
- **`pi-web-access`** 설치(검색용): `pi install npm:pi-web-access` — 무설정 동작.
- Node.js LTS, **Google 계정 + Google Cloud 프로젝트**(무료, 결제 설정 불필요).

---

## 2. 설정 파일 구조 (중요)

`pi-mcp-adapter`는 표준 MCP 파일을 읽는다. 우선순위(아래가 위를 덮음):

```
~/.config/mcp/mcp.json        # 사용자 전역 (공유)
<Pi agent dir>/mcp.json       # Pi 전역 오버라이드
.mcp.json                     # 프로젝트 공유 (git 커밋 가능, 비밀 없음)
.pi/mcp.json                  # 프로젝트 Pi 오버라이드 ← 가장 우선, 비밀 박는 곳
```

이 프로젝트의 규칙 — **설정 파일은 `.pi/mcp.json` 하나로 통일**:
- **`.pi/mcp.json`** — 모든 서버(공식 `gmail` + 자작 `gmail-send`)를 여기 둔다. OAuth 클라이언트 ID/비밀을 **리터럴**로 박으므로 **`.gitignore`에 등록**(절대 커밋 금지). → 커밋되는 repo엔 MCP 설정 파일이 없고, 새 환경은 **이 가이드대로 직접 만든다**.
- **`.mcp.json`은 쓰지 않는다** — 커밋되는 공유 파일이라 비밀을 못 넣어서, 빈 파일이 둘로 늘어나는 혼란만 준다(제거함). 팀 공유가 필요하면 그때 비밀 없는 서버만 분리하면 된다.
- **`.env`** — `GMAIL_OAUTH_CLIENT_ID` / `GMAIL_OAUTH_CLIENT_SECRET` 저장. **gitignore됨.** (auth 스크립트가 읽음)

> ⚠️ **함정**: 어댑터는 `oauth.clientId`/`oauth.clientSecret` 필드에서 **`${VAR}` 보간을 하지 않는다**(env·headers·bearerToken만 지원). `${...}`를 쓰면 리터럴 문자열이 그대로 구글로 전송돼 `invalid_client` 에러가 난다. → **`.pi/mcp.json`에 실제 값을 직접** 넣을 것.

---

## 3. 검색 — `pi-web-access` (설정 0)

설치만 하면 끝. 키·카드 불필요(Exa zero-config). 도구:
- `web_search({ query })` — 출처 URL 포함 검색
- `fetch_content({ url })` — 페이지·PDF·GitHub·유튜브 열람

Pi 네이티브 확장이라 **MCP 프록시 없이** 바로 호출된다. 서브에이전트(researcher 등)에도 자동 노출.

---

## 4. 공식 Gmail MCP (읽기·검색·초안)

### 4.1 Google Cloud 설정 (브라우저)
1. 프로젝트 생성/선택 (console.cloud.google.com).
2. **API 2개 사용 설정**:
   - `gmail.googleapis.com` (일반 Gmail API — §5 자작 서버가 씀)
   - `gmailmcp.googleapis.com` (Gmail **MCP** API — 공식 원격 서버용, *개발자 프리뷰*)
   ```bash
   gcloud services enable gmail.googleapis.com gmailmcp.googleapis.com --project=<PROJECT_ID>
   ```
3. **OAuth 동의 화면** (Google 인증 플랫폼 → 브랜딩/잠재고객/데이터 액세스):
   - 사용자 유형 **외부** → **테스트 사용자에 본인 이메일 추가** (안 하면 `access_denied`).
   - **데이터 액세스 → 범위 추가**:
     ```
     https://www.googleapis.com/auth/gmail.readonly
     https://www.googleapis.com/auth/gmail.compose
     https://www.googleapis.com/auth/gmail.send      # §5 자작 발송용 (같이 넣어두면 편함)
     ```
4. **OAuth 클라이언트 생성**: 클라이언트 → 만들기 → **웹 애플리케이션** →
   - 승인된 리디렉션 URI: **`http://localhost:3118/callback`** (Pi 어댑터/자작 auth가 쓰는 콜백)
   - 생성 후 **클라이언트 ID·비밀** 복사 → `.env`에 저장:
     ```
     GMAIL_OAUTH_CLIENT_ID=<클라이언트_ID>
     GMAIL_OAUTH_CLIENT_SECRET=<클라이언트_비밀>
     ```

### 4.2 `.pi/mcp.json` 등록 (리터럴 값)
```json
{
  "mcpServers": {
    "gmail": {
      "url": "https://gmailmcp.googleapis.com/mcp/v1",
      "auth": "oauth",
      "oauth": {
        "clientId": "<클라이언트_ID 실제값>",
        "clientSecret": "<클라이언트_비밀 실제값>",
        "redirectUri": "http://localhost:3118/callback",
        "scope": "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.compose"
      }
    }
  }
}
```

### 4.3 인증 & 사용 (Pi 안에서)
```
/mcp-auth gmail        # 브라우저 로그인 → 동의 → localhost:3118 리디렉트 → 완료
/mcp reconnect gmail   # idle이면 연결
```
도구: `search_threads`, `get_thread`, `list_labels`, `create_draft`, `list_drafts`, `label_*` … (**send 없음**)

---

## 5. 자작 Gmail 발송 MCP (실제 발송)

위치: `mcp-servers/gmail-send/` (독립 패키지, 자체 `node_modules`).

| 파일 | 역할 |
|---|---|
| `index.mjs` | MCP 서버. `send_email` 도구 → **승인 다이얼로그(elicitation)** → Gmail API `messages.send` |
| `auth.mjs` | 일회용 OAuth. `gmail.send` 권한으로 refresh token 발급 → `.token.json` |
| `.token.json` | client_id/secret/refresh_token 저장. **gitignore됨.** 런타임 env 불필요. |

### 5.1 일회용 인증
```bash
# Pi가 실행 중이면 포트 3118 충돌 → 먼저 비우기
lsof -ti:3118 | xargs kill 2>/dev/null

set -a && source .env && set +a            # .env의 클라이언트 ID/비밀 로드 (pi/node는 .env 자동 로드 안 함)
node mcp-servers/gmail-send/auth.mjs        # 브라우저 → gmail.send 허용 → .token.json 저장
```

### 5.2 `.pi/mcp.json`에 서버 추가
`gmail`(§4.2) 옆에 같이:
```json
"gmail-send": {
  "command": "node",
  "args": ["./mcp-servers/gmail-send/index.mjs"]
}
```

### 5.3 사용 (Pi 안에서)
```
/mcp reconnect gmail-send
```
그다음 — 도구가 2개라 헷갈리니 **명시적으로 발송 도구 지정**:
```
gmail-send 의 send_email 로 <받는사람>에게 제목 "...", 본문 "..." 보내줘
```
→ **승인 다이얼로그**("보내기/취소") → "보내기" → 실제 발송.

---

## 6. 처음부터 재현 (체크리스트)

```
[ ] pi install npm:pi-mcp-adapter   (+ pi-web-access)
[ ] Google Cloud 프로젝트 + gmail.googleapis.com / gmailmcp.googleapis.com 사용 설정
[ ] OAuth 동의화면: 외부 + 테스트 사용자(본인) + 스코프(readonly·compose·send)
[ ] OAuth 클라이언트(웹앱) 생성, redirect = http://localhost:3118/callback
[ ] cp .env.example .env            → GMAIL_OAUTH_CLIENT_ID / SECRET 채우기
[ ] cp .pi/mcp.json.example .pi/mcp.json  → oauth.clientId/clientSecret 실제값 채우기  (둘 다 gitignore 확인)
[ ] cd mcp-servers/gmail-send && npm install
[ ] set -a && source .env && set +a && node mcp-servers/gmail-send/auth.mjs
[ ] pi → /mcp-auth gmail → /mcp reconnect (gmail, gmail-send)
[ ] 발송 테스트 (send_email)
```

---

## 7. 트러블슈팅 (실제 겪은 것)

| 증상 | 원인 | 해결 |
|---|---|---|
| OAuth `invalid_client` / "OAuth client was not found" | `.mcp.json`에서 `${VAR}` 미보간 → 리터럴 `${...}` 전송 | `.pi/mcp.json`에 **실제 값** 박기 (§2) |
| `403 access_denied` "테스터만 접근" | 동의화면이 테스트 모드인데 본인이 테스트 사용자 아님 | 잠재고객 → 테스트 사용자에 본인 이메일 추가 |
| `Missing required state parameter` (CSRF) | 포트 3118을 **실행 중인 Pi**(공식 OAuth 콜백)가 점유 | `lsof -ti:3118 \| xargs kill` 후 재시도 |
| `Gmail API has not been used ... or it is disabled` | 일반 `gmail.googleapis.com` 미사용 설정 | 해당 API enable (1~2분 전파 대기) |
| 브라우저 인증 완료 페이지 한글 깨짐 | 응답 charset 미지정 (무해, 인증은 성공) | `.token.json` 생기면 정상 |
| 메일이 **초안만** 생기고 발송 안 됨 | 에이전트가 공식 `create_draft`를 선택 | `send_email` 도구를 **콕 집어** 지시 |
| 헤드리스/비-UI에서 발송 취소됨 | 승인 다이얼로그(elicitation)는 **대화형 Pi UI** 필요 | 대화형 세션에서 실행 |

---

## 8. 보안

- **절대 커밋 금지** (`.gitignore` 등록 확인): `.env`, `.pi/mcp.json`, `mcp-servers/gmail-send/.token.json`.
- 자작 발송 서버는 **`gmail.send` 스코프만** 사용(읽기·삭제 권한 없음). `.token.json`은 권한 600.
- 발송은 항상 **승인 게이트** 통과 후에만.
- 이 셋업은 **개인 계정·테스트 모드** 기준이다. 타인이 본인 PC에서 본인 Gmail로 쓰려면 §4의 OAuth/테스트 사용자 등록을 각자 반복해야 한다(개인 OAuth 특성).

---

## 9. 관련 문서
- 어댑터 사양·자작 MCP 경로: `plans/PI_INTEGRATION.md`
- 에이전트 구조: `AGENTS.md`, `docs/AGENTS_DETAILS.md`
- 작업 기록: `docs/ai-usage-log.md`
