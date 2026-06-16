# AI 사용 로그

> **사람(개발자)이 방향·결정·검증을 주도하고, AI(Claude Code)가 그 지시에 따라 구현을 보조한 기록.**
> 각 행: 날짜 · 도구 · AI가 구현한 것 · **내 역할(지시·결정·피드백·검증)** · 산출물.
> 모든 산출물은 사람이 직접 확인·수정 지시했고, 설계·디자인·우선순위 결정은 사람이 내렸다.

---

## 2026-06-16

| 도구 | AI 구현 | **내 역할 (지시·결정·피드백·검증)** | 산출물 |
|---|---|---|---|
| Claude Code (Opus 4.8) | 정본 plan을 "한 세션=한 태스크" 원자 단위 체크리스트로 분해, V0 검증 스파이크를 선행 단계로 분리 | **분해 방식·V0 선행 분리 방향 지시 및 검토** | `plans/TASKS.md` |
| + impeccable | F0 프런트 스캐폴드(Vite+React+TS·ESM, 라우팅, S0 사이드바, 디자인 토큰·폰트 이식) | **F0 착수 지시(impeccable 사용·토큰은 `DESIGN.md` 따르라 지정), 브라우저 직접 확인, "새 행사 안 보임" 점검 요청→원인 규명 확인** | `frontend/*` |
| Claude Code | F1 연결 계약 + Mock(`contract.ts`·`mockClient.ts`·`harness.ts`) | **다음 단계로 F1 지시, "F1이 뭔지" 설명 요청, 하니스 시퀀스 결과 검토** | `frontend/src/agent/*` |
| + impeccable | F2 S3 동작 타임라인(타임라인·되묻기·승인 게이트·컴포저·모델 토스트) | **F2 지시, "공간을 다 못 쓰는 느낌" 레이아웃 피드백→칼럼폭 수정, 4상태 검토** | `frontend/src/screens/workspace/*` |
| Claude Code | 현재 mock 동작·교체 지점 문서화 | **"지금 mock이고 나중에 실제 데이터로 바꿔야 한다고 `CLAUDE.md`에 적어둬" 지시** | `CLAUDE.md` |
| Claude Code | 앱 셸 풀블리드 전환 + `DESIGN.md` 동기화 | **"카드 형식 말고 메인 화면 전체로" 디자인 결정** | `AppShell.module.css`, `DESIGN.md` |
| + impeccable | F3 기획 폼(S2) + 홈 대시보드(S1): store·타일·알림 센터·달력·체크리스트 | **F3 지시, 확정 시안과의 일치 검토·확인** | `screens/home·new`, `store/*` |
| + impeccable | F0–F3 디자인 점검(이모지→Tabler 아이콘, 홈 버킷 버그, 타이포) + 다음 세션 가이드 | **"impeccable로 점검·수정" 지시, 타임라인 명조 이질감 직접 발견·지적** | `index.html`, `screens/*`, `NEXT_SESSION.txt` |
| (git) | 커밋 정리 | **교수님 레포 확인 지시→마일스톤 단위 커밋 방침 결정, 커밋 키워드 대괄호 제거 결정, 푸시·force-push 판단** | (커밋 히스토리) |

## 2026-06-17

| 도구 | AI 구현 | **내 역할 (지시·결정·피드백·검증)** | 산출물 |
|---|---|---|---|
| Claude Code | V0 Pi 실측(스트리밍·중지·되묻기·모델전환 확인 → F1 계약 확정, "잠정" 해제) | **"규칙은 AI가 정한 것"이라며 백엔드-우선 vs 프런트 재검토 제기, V0부터 진행 결정, OpenRouter 키 직접 셋업** | `PI_INTEGRATION.md §8`, `contract.ts` |
| Claude Code | Claude 경로 검증 + B1 백엔드(Fastify+WS, 모델 레지스트리·폴백, 단위 테스트 3/3) | **Claude 구독 결제·OAuth 셋업 제공, "개발 중 Claude는 `claude_test` 방식" 규칙 지시, B1 진행 지시** | `backend/*` |
| Claude Code | B2: 실제 Pi(`createAgentSession`)→계약 변환→`realClient`(env 토글) = **M1 달성** | **"백엔드 먼저, 그다음 프런트" 순서 결정, 루트 spike 패키지 정리 지시** | `backend/src/server.ts`, `frontend/src/agent/realClient.ts` |
| Claude Code | M1 검증 후 버그 수정: 컴포저 텍스트 전달, 타임라인 이어붙이기 + 사용자 메시지 표시 | **실제 프롬프트로 직접 M1 검증, 컴포저·"메시지가 사라지는" 타임라인 초기화 버그 직접 발견·지적, "되묻기(ask)는 B3냐" 질문** | `S3View.tsx`, `useAgentRun.ts`, `Timeline.tsx` |
| Claude Code | 폼(S2) 입력을 초기 프롬프트로 전달. **보안: 에이전트 내장 도구 전부 차단(`noTools:"all"`)** — cwd만으론 bash가 상위로 올라가 레포·`.env`를 읽던 것 차단(검증: 디렉토리 안 보임). B3에선 우리 Extension만 allowlist로. | **"폼 조건이 자동으로 안 들어간다", "에이전트가 어떻게 내 디렉토리를 보냐" 직접 발견·지적(보안 이슈 제기)** | `NewEvent.tsx`, `backend/src/server.ts` |
| Claude Code | 행사별 백엔드 세션·cwd 분리(`useAgentRun(wsId)`→`realClient(wsId)`, 행사1개=세션1개=cwd1개). mock 복귀(서버 정리·`.env.local` 삭제). 핸드오프 문서 정리(NEXT_SESSION·README·CLAUDE·TASKS 현황 갱신). | **mock 복귀 지시, "F 관련 마무리까지 하고 next session 잘 넘기게 .md 제대로 갱신" 지시, 커밋이 너무 잘게 나뉜다 지적→의미 단위로 묶기 결정** | `useAgentRun.ts`, `S3View.tsx`, `README.md`·`CLAUDE.md` |
| Claude Code + impeccable | **F4 S4 작업공간 + 상태 모델**: `boardState.ts`(3겹·잠금/신선도·예산 3상태·업체 4단계·stale + `useBoard` 인터랙션), S4 화면(상태 스트립·재기획 배너·조건·예산 막대+표+잠금·업체 미니 스테퍼·지도/날씨·D-레일). 라우트 `/w/:id/board`. 재기획 시나리오(F4.4) puppeteer 3상태 검증. | **"토큰 남은 김에 F4 진행" 결정, 인프라 없는 자율 단위(F4) 선택, "안 더러워지게 한 덩어리만" 방침** | `frontend/src/data/boardState.ts`, `screens/workspace/S4View.*`, `routes/Board.tsx`, 라우팅·TopBar·타일 |

---

<!-- 새 항목: 날짜 섹션 + 표 행. AI 구현은 사람이 검토하고, 결정·피드백을 '내 역할'에 구체적으로 남긴다. -->
