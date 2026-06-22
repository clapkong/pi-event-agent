# ARCHITECTURE — 시스템 구조 · Pi 연동 사양

> 실제 구현 기준(코드 대조 완료). 상태 모델은 `STATE_MODEL.md`, Pi 요소 카탈로그는 `PI_ELEMENTS.md`,
> 에이전트 구성은 `AGENTS_DETAILS.md`, MCP 셋업은 `MCP_DETAILS.md`, 제품 정의는 `README.md`.
> **Pi는 학습 컷오프 이후 도구라 API 추측은 거의 틀린다 — 이 문서의 검증된 사양만 따르고, 없는 함수는 멈추고 물어본다.**

---

## 1. 전체 구조

```
[React + Vite 프런트]  홈 · 기획 폼 · 동작 타임라인(S3) · 작업공간(S4) · 문서/사례 · 현재 모델 표시
   │  WebSocket  (ws://127.0.0.1:8787/ws?ws=<id>) — 에이전트 진행 실시간 스트리밍
   │  REST       (http://127.0.0.1:8787/api/*)    — 보드·제안서·사례·통신·날씨·연결상태 조회/편집
[얇은 Node 백엔드 (Fastify + @fastify/websocket)]  워크스페이스별 Pi 세션 소유 + rpc↔contract 변환
   │  stdin/stdout JSONL
[pi --mode rpc  (자식 프로세스, 워크스페이스당 1개)]  두뇌. Skill / Extension / MCP / 서브에이전트 실행
   │
[LLM]  .pi/settings.json: openrouter · anthropic/claude-sonnet-4.6
   │
[데이터 = 파일]  행사별 workspace/<id>/ (.json·.md) + 공통 cases/*.md (pi-local-rag 인덱싱)
```

**핵심 흐름:** 프런트 `prompt` → WS → 백엔드 `pi.send(rpc)` → pi stdout JSONL 이벤트 → `bridge` 변환 → WS → 프런트 타임라인.

> **왜 백엔드가 필요한가:** Pi는 브라우저가 아니라 Node에서 돈다. 우리는 SDK를 임베드하지 않고
> **`pi --mode rpc` CLI를 자식 프로세스로 띄워** stdin(명령)/stdout(JSONL 이벤트)로 통신한다.
> 백엔드는 그 프로세스를 워크스페이스별로 소유하고, rpc 이벤트를 프런트 계약(`contract.ts`) 형태로 통역한다.

---

## 2. 기술 스택

전부 **TypeScript / Node.js, ESM**.

| 레이어 | 기술 |
|---|---|
| 프런트 | React + Vite + TS |
| 통신 | WebSocket(에이전트 스트림) + REST(데이터) |
| 백엔드 | Fastify + `@fastify/websocket` |
| 에이전트 | **`pi`(`@earendil-works/pi-coding-agent`) `--mode rpc` 자식 프로세스** |
| Pi 패키지(`.pi/settings.json`) | `@tintinweb/pi-subagents` · `pi-mcp-adapter` · `pi-web-access` · `pi-local-rag` |
| LLM | openrouter · `anthropic/claude-sonnet-4.6` (`defaultThinkingLevel: medium`) |
| 데이터/RAG | `.md`/`.json` 파일 + `pi-local-rag`(내부 SQLite FTS5 + sqlite-vec 하이브리드, 임베딩 내장·오프라인) |
| 날씨 | Open-Meteo (백엔드 `weather.ts`, MCP 아님) |

---

## 3. 백엔드 모듈 (`backend/src/`)

| 파일 | 책임 |
|---|---|
| `config.ts` | 상수(`PORT=8787`·`PI_BIN`·`PI_BASE_ARGS=["--mode","rpc"]`·`REPO_ROOT`·`SMOKE`) |
| `server.ts` | Fastify 와이어링 + **REST 엔드포인트**(아래 §4) + `/ws` |
| `ws-handler.ts` | WS 연결당 Pi 세션 1개 수명 관리 · 명령/이벤트 펌프 · ask/gate 대기상태 상관 |
| `pi-session.ts` | `pi --mode rpc` 자식 프로세스 소유. spawn·`send`(stdin JSON)·`onEvent`(stdout JSONL **LF split**, U+2028/2029 때문에 readline 금지)·`close` |
| `rpc.ts` | pi rpc 명령/이벤트 타입 |
| `bridge.ts` | **순수 변환기** rpc ↔ `contract`. 도구명→요소분류, 스킬 로드 감지, 서브에이전트 라벨 |
| `contract.ts` | **WS API 타입 정의** — 이벤트 `AgentEvent` + 명령 `ClientCommand`. 프런트(`frontend/src/agent/contract.ts`)에 같은 형태를 미러(수동 동기화)하며, 그게 프런트의 유일한 백엔드 접점 |
| `workspace.ts` | 행사별 `cwd`(`workspace/<id>/`)·파일 경로·목록 헬퍼 |
| `weather.ts` | Open-Meteo 예보(≤16일)/평년값 |
| `subagent-tail.ts` | 서브에이전트 내부 출력 파일 tail → `subagent_delta` |

### 보안/격리
- 워크스페이스별 **세션·cwd 분리**(`?ws=<id>` → `workspace/<id>`). 레포 루트·`.env` 노출 방지.
- `PI_SMOKE=1` → 배관만 싸게 테스트(`--no-session --no-context-files --no-extensions --no-skills`).

---

## 4. API 계약

### 4.1 WebSocket — 에이전트 스트림 (`contract.ts`, 정본)

**백엔드 → 프런트 이벤트(`AgentEvent`)**
`text_delta` · `thinking_delta`(추론, 접힘) · `subagent_delta{agentId}` · `tool_start{label,tool,element}` ·
`tool_end{result,citation?}` · `ask{question,options}` · `gate{question}` · `model_switch{from?,to,reason}` ·
`model_current{name}` · `done` · `error{message,retry?}`.

**프런트 → 백엔드 명령(`ClientCommand`)**: `prompt{text}` · `answer{choice}`(되묻기 응답/게이트 승인=`"승인"`) · `abort`.

**요소 분류(`element`)** — 타임라인 "MCP ×N · Extension ×N · Skill ×N" 카운트의 근거:
- **MCP**: `web_search`·`fetch_content`·`gmail*`·`calendar*`·`maps*`·`google*`
- **Extension**: `rag_query`·`rag_index` + event-tools(`estimate_budget`·`build_checklist`·`update_state`·`save_report`·`get_weather`·`save_comms`·`save_case`·`ask_user_question`)
- **Skill**: `read`가 `.pi/skills/<name>/SKILL.md`를 읽으면 그 스킬 사용으로 간주(progressive disclosure)
- **Tool**: 그 외 내장 도구

### 4.2 REST — 데이터 (`server.ts`)
`GET /health` · `GET /api/cases`·`/api/cases/:id` · `GET /api/connections`(연결상태 패널) ·
`GET/POST /api/workspaces` · `GET/PATCH /api/workspaces/:id`(보드 `state.json`; PATCH=사람 직접 편집·잠금) ·
`GET/PUT /api/workspaces/:id/proposal`(제안서 + 버전 로그) · `GET .../artifacts`·`.../file` ·
`GET .../comms`(통신) · `GET .../weather`(Open-Meteo→`state.json.weather`).

> `/api/connections`의 status는 **`configured`**(`.pi` 설정에 등록됨)이지 실시간 liveness가 아니다 — liveness는 런타임 rpc에서만 알 수 있다.

---

## 5. LLM (모델)

- 모델은 **`.pi/settings.json`의 `defaultProvider:openrouter`·`defaultModel:anthropic/claude-sonnet-4.6`** 하나로 고정.
- **현재 모델 표시**(`model_current`)는 pi의 `message_start.message.model`을 그대로 읽어 전달한다.
- `model_switch`/자동 폴백은 **계약에는 있으나(타입) 정교한 모델 레지스트리/체인은 미구현** — 단일 모델 운용.
  (옛 `MODEL_CHAINS`/`runWithFallback` 설계는 스코프에서 잘라냄. 필요 시 향후 확장.)
- 개발 중 Claude 직접 호출은 구독 OAuth(`CLAUDE_CODE_OAUTH_TOKEN`) 경로 — CLAUDE.md 참조.

---

## 6. 데이터 흐름 · 사례 순환

- **산출물은 파일.** 보드(`state.json`)는 에이전트의 `update_state` **유일 통로**로 쓰고, 제안서는 `save_report`(→`proposal.md`),
  통신은 `save_comms`(→`comms.json`). 사람은 작업공간/문서에서 직접 편집(REST PATCH/PUT) → 다음 요청 때 에이전트가 읽음.
- **사례 RAG 루프**(`pi-local-rag`, 별도 DB·MCP 없음):
  ```
  새 기획 ──rag_query(하이브리드 벡터+BM25)──▶ cases/*.md + .pi/rag/ 인덱스
  행사 완료·승인 ──save_case(cases/<id>.md)─▶ rag_index ─▶ 다음 기획에서 재검색·인용
  ```
  역추적(`citedBy`): 에이전트가 사례를 인용하면 해당 `cases/<id>.md` frontmatter에 workspaceId를 추가(파일 edit)해 순환을 가시화.

### HITL 3종
- **중지**: `abort` → pi `abort`(메서드, AbortSignal 아님).
- **되묻기**: 도구가 `ctx.ui.select/input/editor` → rpc `extension_ui_request` → 계약 `ask` → 사용자 응답 → `extension_ui_response`.
- **승인 게이트**: `ctx.ui.confirm` → 계약 `gate`(메일 발송·사례 적립 등 직전).

---

## 7. 레포 구조

```
.
├─ .pi/
│  ├─ agents/<name>.md          # 서브에이전트 5종 (researcher·writer·critic·secretary·monitor)
│  ├─ skills/<name>/SKILL.md     # Skill 4종 (자동 발견)
│  ├─ extensions/event-tools.ts  # 자작 Pi Extension (도구 8개)
│  ├─ mcp.json                   # MCP 서버 (gmail·calendar·maps)
│  └─ settings.json              # 모델·로드할 패키지
├─ AGENTS.md                     # 세션 메인(Planner) 시스템 프롬프트
├─ cases/*.md                    # 공통 과거 사례 (pi-local-rag 인덱싱 대상)
├─ backend/src/                  # 얇은 Node + WS/REST + pi rpc 브리지 (위 §3)
├─ frontend/src/                 # React + Vite (홈·폼·타임라인·작업공간·문서·사례)
├─ workspace/<id>/               # 런타임: 행사별 cwd (state.json·proposal.md·comms.json·meta.json·contacts)
└─ docs/                         # 공개 문서 (이 문서 등)
```

---

## 8. 검증된 Pi 사양 (rpc 모드 · 추측 금지)

> 근거: 실측 + 메모리 `pi-rpc-protocol`·`pi-extension-authoring`. CLAUDE.md의 "검증된 사양만" 포인터가 가리키는 곳.

- **모드**: `pi --mode rpc`. stdin = JSON 명령 한 줄, stdout = **JSONL 이벤트**(LF로만 split — readline 금지).
- **rpc 이벤트 어휘**: `agent_start`/`turn_*`/`message_start`/`message_update`(`assistantMessageEvent.type` =
  `text_delta`|`thinking_delta`, `.delta`)/`message_end`/`tool_execution_start{toolName,args}`/`tool_execution_end{result,isError}`/
  `extension_ui_request{id,method,title,options?,message?}`/`response{success,error?}`/`agent_end`.
- **명령**: `prompt{message}` · `abort` · `extension_ui_response{id, confirmed?|value?}`.
- **도구 결과 형태(0.79.x)**: `{ content: [{ type:"text", text }], details }` — `output`만 주면 compaction 크래시. content 배열 필수.
- **Extension 작성(검증)**: `export default function (pi: ExtensionAPI) { … }` 팩토리. 도구=`pi.registerTool(defineTool({...}))`(TypeBox 스키마),
  훅=`pi.on("tool_call", (e,ctx)=>({block,reason}))`(남의 MCP 도구도 차단 가능), 승인/되묻기=`ctx.ui.confirm/select/input`,
  상태=`ctx.cwd` 파일 직접. **`createExtension` API는 없다.** 로딩=`cwd/.pi/extensions/<name>/index.ts`(jiti, TS 직접).
- **서브에이전트**: `.pi/agents/<name>.md`(네이티브) + `@tintinweb/pi-subagents`. Planner는 `Agent` 도구로 spawn(`subagent_type`·`run_in_background`).
- **MCP**: 코어는 MCP 미지원 → `pi-mcp-adapter`가 `.pi/mcp.json` 자동 로드(`MCP_DETAILS.md`).
