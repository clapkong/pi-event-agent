# STATE_MODEL — 상태 모델 · 스키마 · 연락처 · 사례

> 이 서비스의 심장인 상태 모델 + 저장 형태. 화면은 `frontend/`(S4 작업공간)·시각은 `DESIGN.md`,
> 데이터 흐름·파일 위치는 `ARCHITECTURE.md §6`. 보드는 에이전트의 `update_state`(유일 통로)로 쓰여 `workspace/<id>/state.json`에 저장된다.

---

## 1. 상태 모델 (★ 가장 중요)

워크스페이스 한 곳에 **세 겹**이 섞이고, 각 항목에 **두 꼬리표**가 붙는다.
"진행중이 애매"·"확정값 못 바꿈"·"입력 바뀌면 재기획"을 한 번에 푼다.

### 1.1 세 겹 (layer)
| 겹 | 내용 | 성격 |
|---|---|---|
| 입력/가정 | 날씨·장소(지도)·인원·사람 계획 | 바뀔 수 있음 |
| 기획 산출 | 제안서·예산 배분·체크리스트 | 입력에서 파생 |
| 실행/확정 | 확정 항목·계약 업체·집행(쓴) 예산 | 현실에 못 박힘 |

### 1.2 두 꼬리표
- **잠금**: `계획`(자유, 재기획 대상) ↔ `확정🔒`(사람이 못 박음, 재기획 제외).
- **신선도**: `최신` ↔ `재검토 필요(stale)`. 입력이 바뀌면 그 입력으로 만든 산출물이 stale.

### 1.3 워크스페이스 단계
`기획 → 진행중 → 정산·완료`. 상단 상태 스트립이 단계 + 요약(제안서 vN · 확정 N🔒 · 집행 % · 다음 마감)을 표시.
완료 확정은 **사람 몫**(프런트 확인 후) → 에이전트가 사례 적립(`save_case`+`rag_index`).

### 1.4 예산 3상태
| 상태 | 의미 | 재기획 영향 |
|---|---|---|
| 계획(planned) | 에이전트 배분 예정액 | 재배분 가능 |
| 확정🔒(confirmed) | 사람이 못 박음 | 잠김 |
| 집행(spent) | 실제 쓴 금액(계약 반영) | 불변 |

요약 막대: `집행 │ 확정·미집행 │ 계획 잔여`.

### 1.5 업체 4단계 (state machine)
`후보 → 견적 → 확정🔒 → 계약`. **확정부터 잠금**(재기획·비교 제외), **계약에서 집행 예산 반영**. 업체마다 `stage` 한 값.

### 1.6 재기획 (stale detection)
산출물을 만든 **입력 스냅샷 ↔ 지금 입력** 비교 → 실질 변화 시 영향 산출물에 `재검토 필요` + 재기획 제안.
**재기획은 잠금 항목을 건드리지 않는다** — 잔여 예산(전체 − 집행 − 확정) 범위에서 **계획만 재산출**, 버전 +1.
운영 중 변화는 `update_state`의 `replanChangedInputs`로 **배너만** 올리고, 실제 재기획은 사용자가 요청할 때 수행.

### 1.7 human-in-the-loop 3종
| 종류 | 트리거 | 메커니즘 (`ARCHITECTURE.md §6`) |
|---|---|---|
| 중지(개입) | 실행 중 멈춤 | `abort` |
| 되묻기 | 에이전트 선택지 질문 | `ask_user_question`/`ctx.ui.select` → `ask` |
| 승인 게이트 | 발송·적립·내보내기 직전 | `ctx.ui.confirm` → `gate` |

---

## 2. 데이터 스키마 (개략 — `state.json` 중심)

```
Workspace     { id, name, type, status: 기획|진행중|완료, summary, createdAt }   // meta.json
state.json    { stage, budgetTotal, conditions[], budget[], vendors[], venue, weather,
                milestones[], versions[], proposalVersion, replanChangedInputs?, caseId? }
conditions[]  { key, value, locked }                          // 확정 게이트 → locked:true
budget[]      { name, planned, confirmed: bool, spent }       // 예산 3상태
vendors[]     { name, category, stage: 후보|견적|확정|계약, locked, spent }
venue         { name, note }
weather       { label, temp, pop, stale, source, basis }      // get_weather/REST가 그대로 채움
milestones[]  { dday(음수=행사 전), title, due:YYYY-MM-DD, status, owner }   // = 제안서 액션 플랜
versions[]    { v, author: ai|human, at, summary }            // 제안서 버전 이력
Case          # cases/<id>.md — frontmatter 메타 + 본문. 임베딩은 pi-local-rag 내부(스키마에 없음)
              { id, title, type, headcount, venue, date, satisfaction, budgetActual[], citedBy[] }
Contact       { name, role, org, email, phone, scope: 내부|외부 }   // 연락처
Comms         # comms.json — { from, subject, date, relevant, reason, insight }[]  // secretary 분류
```

규칙:
- `locked` 또는 `confirmed`/`stage≥확정`인 항목은 **재기획에서 제외**. 가드(event-tools 훅)가 위반을 자동 차단.
- `stage==계약` → `budget.spent` 반영.
- 입력(`weather`/`venue` 등)이 직전 스냅샷과 달라지면 파생 산출물 `stale` + 재기획 배너.

---

## 3. 연락처 (Contact)

이메일 발송 수신자는 **하드코딩하지 않고** 연락처에서 조회한다.
- 저장: `workspace/<id>/contacts.json`.
- Gmail MCP 발송은 이 목록에서 수신자를 찾아 발송(승인 게이트 뒤).
- 개발용 시드 placeholder: `clapkong@gmail.com`(내부 기획)·`clapkong23@gmail.com`(내부 재무)·`clapkong@yonsei.ac.kr`(외부).

---

## 4. 사례 + RAG (pi-local-rag)

- 사례 = 공통 `cases/<id>.md` **파일**. frontmatter에 메타, 본문에 사례 전문. **별도 DB·`embedding` 컬럼 없음** —
  임베딩·인덱스는 `pi-local-rag`가 내부 SQLite(`.pi/rag/`, regenerable)에서 자동 처리. 소스인 `cases/*.md`만 커밋.
- 쓰기: 행사 완료 → `save_case`(→`cases/<id>.md`) → `rag_index`. 읽기: `rag_query`(하이브리드 벡터+BM25, 점수·출처 메타 반환).
- **인용 드로어**(S5)는 `rag_query`의 점수·발췌·출처를 표시. **역추적**(`citedBy`)으로 "이 사례를 인용한 행사들"을 가시화.
- ⚠️ 사례 RAG는 **있으면 참고하는 보조 자료지 필수 단계가 아니다.** 인덱스가 비면(`index is empty`) 외부 조사만으로 진행(반복·중단 금지).
- 같은 `cases/*.md`를 백엔드 REST(`/api/cases`)도 파싱해 사례 화면에 서빙 — 하드코딩 사례 없음.
