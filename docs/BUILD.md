# BUILD — 구현 플레이북 (Claude Code 실행 단계)

> 커밋 메시지의 단계 코드 — **`F0–F5`(프런트) · `B1–B4`(백엔드) · `M1–M7`(마일스톤)** — 가 여기서 정의된다. 세부 체크리스트는 `TASKS.md`.
> ℹ️ `../plans/…` 참조는 **비공개 로컬 설계 문서**다(공개 repo엔 코드·README·`docs/`만 둠).

> **이 문서는 "무엇을 어떤 순서로 만들고 어떻게 검증하나"의 실행 레이어다.** 설계 근거는 `../plans/ARCHITECTURE.md`·`../plans/PI_ELEMENTS.md`·`../plans/DATA_MODEL.md`·`../plans/SCREENS.md`·`DESIGN.md`, 사양은 `../plans/PI_INTEGRATION.md`. 제품 마일스톤은 `../plans/PLAN.md §5`.

## 원칙

- **순서: 프런트엔드 → 백엔드.** 프런트는 mock으로 **단독 실행·브라우저 검증** 가능하게 먼저 완성한다. 백엔드는 지금 검증 여유가 없으므로 뒤로 미루되, **계약(F1)만 먼저 못 박는다.**
- **연결 지점은 단 하나 — `AgentClient` 계약.** 프런트의 모든 컴포넌트는 이 타입에만 의존한다. 백엔드 기획이 바뀌어도 갈아끼우는 건 어댑터(mock → real) 한 곳뿐.
- **각 단계 = Claude Code 한 입 크기**: 자급자족 + 브라우저/스크립트로 검증 가능 + 명확한 완료 기준. 앞 단계가 "도는 상태"여야 다음으로.
- 검증 못 하면 추측 금지(특히 Pi/MCP 사양) → 멈추고 물어본다.

---

## PHASE F — 프런트엔드 (mock 기반, 단독 실행·검증)

끝나면: **키·DB·Pi 없이 브라우저에서 완전히 클릭 가능한 앱**이 mock 데이터로 돈다.

### F0 — 스캐폴드 & 디자인 기반
- **산출물**: `frontend/`(Vite+React+TS, ESM) · `react-router` · 디자인 토큰을 CSS 변수로 이식(`DESIGN.md §2–8`) · 폰트(Pretendard·IBM Plex Mono·Noto Serif KR) · S0 사이드바 셸 + 라우팅(`/` 홈, `/w/:id` 워크스페이스).
- **완료 기준**: `npm run dev` → 사이드바 + 빈 라우트가 토큰(색·타이포·여백)대로 보인다.

### F1 — 연결 계약 + Mock ★ (린치핀, 제일 공들일 것)
- **산출물**: `frontend/src/agent/contract.ts` — 백엔드와 공유할 타입(추후 공유 위치로 이동 가능).
  - **이벤트**(서버→프런트): `text_delta{delta}` · `tool_start{label, tool, element: "MCP"|"Extension"|"Skill"}` · `tool_end{result, citation?}` · `ask{question, options}` · `gate{question}` · `model_switch{from?, to, reason}` · `model_current{name}` · `done` · `error{message, retry?}`.
  - **메서드**(프런트→서버): `prompt(text)` · `answer(choice)` · `abort()`.
  - 인터페이스 `AgentClient { subscribe(cb), prompt, answer, abort }`.
- `frontend/src/agent/mockClient.ts` — 스크립트된 런 재생: `case_search`(Extension) → `ask`(되묻기) → `estimate_budget`(Extension) → `gate`(승인) → `proposal-writer`(Skill) 스트리밍, 중간에 `model_switch` 토스트 1회.
- **완료 기준**: 작은 하니스가 이벤트 스트림을 콘솔에 찍는다. 이 모듈이 **유일한 백엔드 접점**임을 코드로 확인(다른 곳에서 fetch/ws 직접 호출 없음).
- **근거**: 이벤트 형태는 `../plans/PI_INTEGRATION.md §4`(message_update/text_delta/tool 이벤트/ask)와 `../plans/ARCHITECTURE.md §3·§4`.

### F2 — S3 대화·동작 타임라인 (시그니처) — mock 구동
- **산출물**: run-of-show 타임라인(노드·라벨·**요소 마커**·모노 도구 태그·타임스탬프·출처 `#N`) · 요소 요약 스트립 · 스트리밍 텍스트+커서 · 되묻기 박스 · 승인 게이트 · 컴포저(중지+전송) · **현재 모델 뱃지 + 전환 토스트**.
- **완료 기준**: 브라우저에서 "기획 시작" → 타임라인 스트리밍, **중지** 동작, **되묻기** 응답, **승인 게이트** 통과가 보인다.
- **근거**: `../plans/SCREENS.md S3`, `DESIGN.md §9.9–9.12`.

### F3 — S2 기획 폼 + S1 홈
- **산출물**: 기획 폼(칩 `장소·인원·예산·날짜` + 자연어) → `기획 시작하기`로 워크스페이스/타임라인 진입. 홈 대시보드(타일·알림 센터·달력·체크리스트·사례 모음).
- **완료 기준**: 폼에서 새 행사 생성 → S3로 전환되며 mock 런 시작. 홈에서 워크스페이스 타일 클릭 → S4.
- **근거**: `../plans/SCREENS.md S1·S2`.

### F4 — S4 작업공간 + 상태 모델 ★
- **산출물**: 프런트 store에 **상태 모델 구현**(`../plans/DATA_MODEL.md §1`): Conditions+locks · 예산 3상태 · 업체 4단계 · 신선도(stale) · 재기획 배너. 상태 스트립(단계 스테퍼+요약) · 예산 막대+표+잠금 · 업체 미니 스테퍼 · 지도/날씨 카드 · D-레일/달력.
- **완료 기준**: 필드를 **확정🔒** → mock 에이전트가 안 바꿈. 입력(날씨/장소) 변경 → **재기획 배너** 뜨고 잠금 항목은 유지.
- **근거**: `../plans/DATA_MODEL.md §1`, `../plans/SCREENS.md S4`, `DESIGN.md §9.7·9.16·9.18–9.24`.

### F5 — S5 문서 + S6 사례 + S7 보조
- **산출물**: 제안서 문서(명조·인라인 잠금 칩·위첨자 인용 `#N`·노션식 편집 블록) · 버전 이력 · 인용 드로어(벡터/BM25 점수) · 사례 상세+역추적(citedBy) · 연결 상태 패널(**현재 모델 표시**) · 회의록 목록.
- **완료 기준**: 제안서 블록 편집 → 저장(store/mock 파일). `#N` 클릭 → 드로어. 사례 역추적에 인용 행사 표시.
- **근거**: `../plans/SCREENS.md S5–S7`, `DESIGN.md §9.13–9.15·9.27–9.28`.

> **Phase F 종료 = (mock) UI 구현 완성(실제 동작 아님).** 외부 의존 0. `@earendil-works/pi-web-ui`는 우리 맞춤 디자인과 안 맞으니 쓰지 않고 자체 컴포넌트로 만든다.

---

## PHASE B — 백엔드 (나중, **같은 계약을 구현**)

프런트는 손대지 않는다. mock 어댑터를 real로 바꾸는 것만으로 붙어야 한다. **B는 얇은 end-to-end 한 줄(조건→사례검색→예산→제안서→발송→적립, 단계당 도구 1개)을 먼저 관통시킨 뒤 각 단계를 두껍게 채운다 — 기능 컷이 아니라 순서일 뿐.**

### B1 — 얇은 Node 서버 + WS + 모델 레지스트리
- **산출물**: `backend/`(Fastify/`ws`) · WS 엔드포인트 · `MODELS` 레지스트리 + `runWithFallback` + `model_switch`/`model_current` 통지(`../plans/ARCHITECTURE.md §3`).
- **완료 기준**: WS 왕복 + 모델 체인 단위 테스트(토큰 없을 때 Claude 건너뛰고 OpenRouter로, 전환 시 notify).

### B2 — Pi 세션 → 계약 이벤트 매핑 ★
- **산출물**: `createAgentSession` · `subscribe` 이벤트를 **F1 계약 형태로 변환** · `prompt`/`answer`/`abort` 배선(`../plans/PI_INTEGRATION.md §3·§4`).
- **완료 기준**: 실제 Pi 런이 계약 형태로 WS에 흐른다. **frontend의 mockClient → realClient 교체** 후 프런트가 그대로 동작.

### B3 — Extension + Skill + MCP + pgvector
- **산출물**: Extension(`estimate_budget`·`ask_user`·`case_search`/`case_insert`(pgvector)·`build_checklist`·`vendor_compare`·`settlement_diff`·`draft_email`) · Skill(`clarify-questions`·`proposal-writer` …) · `.mcp.json`(검색·지도·Gmail) · 합성 사례 적재.
- **완료 기준**: `../plans/PLAN.md §5`의 M2–M6 완료 기준.

### B4 — 배선·마감
- 승인 게이트(`pi-permission-system`) · Gmail 실제 발송 · 연락처 store · 사례 순환(`archive_case`).

---

## 의존 관계 한눈에

```
F0 → F1 ─┬─ F2 ─┬─ F3
         │      └─ F4 ─ F5
         └────────────────────────► (계약) ◄──── B1 → B2 → B3 → B4
```

F1의 `contract.ts`가 프런트 전체와 백엔드 B2가 공유하는 단일 타입. 백엔드 기획이 바뀌면 B2 어댑터만 고친다.
