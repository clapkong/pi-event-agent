# 전수 감사 체크리스트 (⑧)

> **목적**: 코드·정적 검증은 끝났다(tsc·도구 등록·엔드포인트·인덱스). 남은 건 **실제 라이브 런에서 5요소(MCP·Skill·Extension·Agent·LLM)가 "쓰여야 할 곳에 진짜로 쓰이는지"**를 로그로 확인하는 것.
> **방법**: 백엔드(`backend/`) + 프런트 띄우고, 새 행사를 하나 만들어 **기획 → 점검 → 완료**까지 한 바퀴 돌리며 동작 타임라인·`save_*` 산출물·MCP 호출 로그를 대조한다.
> **주의(이미 의심되는 것)**: 통신(secretary) 데이터가 `example.com` 등 가짜로 보인 적 있음 → **secretary가 Gmail을 실제로 읽는지 vs 지어내는지**가 최우선 검증 대상.

---

## A. 5요소 실사용 (각 요소가 실제 호출되는가)

- [ ] **LLM** — Planner=`claude-sonnet-4.6`, 서브=각 frontmatter 모델(haiku/gemini)로 실제 라우팅되는가(model_current 이벤트).
- [ ] **MCP — 캘린더**: `calendar_get-current-time`·`calendar_list-events`(공휴일/충돌)·이벤트 생성('캘린더에 등록')이 **실제 Google API**를 치는가.
- [ ] **MCP — 메일(Gmail)**: secretary '점검'이 **받은 편지함을 실제로 조회**하는가. ⚠️ `example.com` 가짜면 환각 → AGENTS.md "지어내지 말 것" 위반.
- [ ] **MCP — 지도**: 장소 지오코딩/주변 검색이 실제로 쓰이는가.
- [ ] **MCP — 검색(web)**: researcher가 `web_search`/`fetch_content`로 외부 조사하는가.
- [ ] **Skill** — task 매칭 시 에이전트가 `read`로 `.pi/skills/<name>/SKILL.md`를 로드하는가(타임라인 "스킬: <name>"·Skill 카운트). notice-writer·budget-policy·risk-assessment·satisfaction-survey 중 실제 호출되는 것.
- [ ] **Extension** — `estimate_budget`·`build_checklist`·`update_state`·`save_report`·`get_weather`·`save_comms`·`save_case`·`ask_user_question`·`rag_query`/`rag_index`가 각 단계에서 호출되는가.
- [ ] **Agent(서브)** — researcher(병렬)·writer·critic 순차 루프가 실제로 도는가(서브에이전트 출력 스트림).

## B. 기획 파이프라인 (한 런)

- [ ] researcher fan-out → `ask_user_question`(선택 게이트, **모달**로 뜨는지) → writer 초안 → critic 판정 → 라우팅(writer/재조사/사용자판단) → `판정: 통과` 시 종료.
- [ ] critic이 `inherit_context:false`인데도 입력계약(ⓐ초안 ⓑ제약 ⓒ근거 ⓓ확정결정 ⓔ이전지적)으로 **무한루프 없이** 도는가.
- [ ] `save_report` → `data/workspace/<id>/proposal.md` 저장 → 문서 탭에 렌더·**편집·버전 이력** 동작.
- [ ] **제안서에 `[n]` 인용 + `## 출처` 섹션**이 실제로 들어가고, 문서에서 `[n]` 클릭 시 드로어(사례/URL)로 연결되는가.
- [ ] **제안서 저장 직후 "업체 메일 보낼까요?" `ask_user_question`** 이 뜨고, 승인 시 Gmail로 발송되는가(데모 핵심).

## C. 보드(작업공간) 실데이터

- [ ] `update_state`로 stage·budget·conditions·vendors·**milestones(제안서 액션플랜과 일치, 담당 포함)**·weather가 보드에 반영.
- [ ] 예산/조건/업체/일정 **사람 편집 → PATCH 저장**(새로고침 유지). 일정 완료체크·추가/삭제.
- [ ] **다음 마감**이 오늘 기준 다음 미완료 마일스톤으로 갱신(행사일 dday 아님).
- [ ] 날씨: 행사일 확정 시 `get_weather` 1회 호출 → 보드 weather(라벨 안 깨짐).
- [ ] 사람 편집 시 **재기획 배너**에 변경분 누적, '점검'은 monitor 경로로 배너.

## D. 운영(점검·완료)

- [ ] **'점검'(백그라운드)**: secretary 새 메일 분류(`save_comms`, **출처=메일** 표시) + 날씨 + monitor 변경 판단 → 필요 시 재기획 배너. AI 탭으로 안 넘어가고 작업공간 유지.
- [ ] 운영 단계 워크스페이스 1주 경과 후 열면 **자동 점검 1회**.
- [ ] **'정산·완료'** 확인 → 회고 `ask` → `save_case`로 `data/cases/<id>.md` → `rag_index` 적립 → state.json caseId → 산출물에 '사례 적립됨'.

## E. 화면(거짓/누락 없음)

- [ ] 사이드바 연결 상태 = 실제 `.pi` 설정(모델 claude-sonnet-4.6·MCP 3종·검색·RAG, 캘린더 연결됨).
- [ ] 홈: 워크스페이스 타일·알림(replan/마감)·체크리스트·달력 = 실데이터. mock 0.
- [ ] **사례 목록(/cases)**: data/cases/*.md 전체가 표로, 행 클릭 → 상세.
- [ ] 산출물: 워크스페이스 모든 문서(.md) 나열 + 사례 링크. proposal 외 문서 읽기전용 뷰(`?doc=`).
- [ ] 통신 카드: 각 항목에 **출처 채널(메일)** 표시.

## F. RAG (사례 순환)

- [ ] `rag_query`가 기획 중 관련 사례를 실제로 검색·인용하는가(하이브리드 BM25+벡터).
- [ ] 완료 행사가 `save_case`+`rag_index`로 적립돼 **다음 행사 기획에서 검색**되는가(루프 닫힘).

## 합격 기준

- 위 항목이 **로그/화면으로 확인**되면 통과. 특히 **B의 메일 발송·D의 통신 환각 여부**는 데모 신뢰성에 직결.
- 실패 시: 해당 요소가 안 쓰이면 AGENTS.md 지시 보강 or 도구/프롬프트 수정 후 재런.
