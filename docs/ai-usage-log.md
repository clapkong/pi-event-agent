# AI 사용 로그

> 이 프로젝트에서 AI(Claude Code 등)를 **무엇에·어떻게** 썼는지의 기록.
> 형식: 날짜 · 도구/모델 · 한 일 · 산출물(파일/커밋) · 사람이 검토·수정한 부분.

---

## 2026-06-16

| 도구/모델 | 한 일 | 산출물 | 사람 검토·수정 |
|---|---|---|---|
| Claude Code (Opus 4.8) | 정본 plan을 "한 세션=한 태스크" 원자 단위 실행 체크리스트로 분해. Pi 검증 스파이크(V0)를 선행 단계로 분리. | `plans/TASKS.md` | 검토 완료 |
| Claude Code (Opus 4.8) + impeccable | F0.1–F0.3 프런트 스캐폴드: Vite+React+TS(ESM), react-router(`/`·`/w/:id`) + S0 사이드바 셸, `DESIGN.md` 토큰을 CSS 변수로 이식 + 폰트(Pretendard·IBM Plex Mono·Noto Serif KR) 로드. `npm run build`·dev 부팅 + headless 스크린샷 검증. | `frontend/*` | 검토 완료(브라우저 확인) |
| Claude Code (Opus 4.8) | F1.1–F1.4 연결 계약 + Mock(린치핀): `agent/contract.ts`(이벤트 합집합 + `AgentClient` 인터페이스), `agent/mockClient.ts`(스크립트 런 재생), `agent/harness.ts`(콘솔 출력). 시퀀스 순서·단일 백엔드 접점·타입체크 검증. ask/abort/model_switch는 V0 잠정으로 주석. | `frontend/src/agent/*` | 검토 완료(하니스 시퀀스 확인) |
| Claude Code (Opus 4.8) + impeccable | F2.1–F2.4 S3 대화·동작 타임라인(시그니처): `useAgentRun` 훅(이벤트→화면 상태), run-of-show 타임라인(노드·요소 마커·모노 도구 태그·타임스탬프·인용 #N), 요소 요약 스트립, 스트리밍 텍스트+커서, 되묻기/승인 게이트, 컴포저(전송+중지), 모델 뱃지+전환 토스트. puppeteer로 시작→되묻기→승인→완료 4상태 캡처 검증. 사용자 피드백 반영: 읽기 칼럼을 콘텐츠 최대폭으로 넓히고 컴포저 정렬 일치(공간 활용 개선). | `frontend/src/screens/workspace/*`, `agent/useAgentRun.ts` | 검토 완료(스크린샷 4상태 + 레이아웃 피드백) |
| Claude Code (Opus 4.8) | 현재 프런트가 mock 데이터로 동작함을 문서화 — Phase B에서 제거·교체할 두 곳(`mockClient.ts`→realClient, `MOCK_WORKSPACES`→스토어/백엔드)과 경계(`contract.ts`) 명시. | `CLAUDE.md` | (사용자 지시로 기록) |
| Claude Code (Opus 4.8) | 사용자 결정으로 앱 셸을 풀블리드로 변경(캔버스 여백·둥근 프레임·그림자 제거, 창 꽉 채움). `DESIGN.md` §2.1·§4·§5를 결정에 맞게 동기화(문서-코드 일치 유지). | `frontend/src/shell/AppShell.module.css`, `docs/DESIGN.md` | 검토 완료(스크린샷) |
| Claude Code (Opus 4.8) + impeccable | F3.1–F3.2 S2 기획 폼 + S1 홈: 워크스페이스 store(생성/목록 공유), 기획 폼(서식 토큰 칩+자연어→생성→S3 autostart), 홈 대시보드(2열 타일·진행 미터·알림 센터 팝오버·달력·체크리스트·사례 모음·접이식 행). 공용 `StatusBadge` 추출. 시안(home/workspace_init.png) 대조, puppeteer로 홈→알림→폼→자동시작 검증. | `frontend/src/screens/home/*`, `screens/new/*`, `store/workspaces.tsx`, `components/StatusBadge.*`, `data/*` | 검토 완료(스크린샷 4컷 + 시안 대조) |
| Claude Code (Opus 4.8) + impeccable(polish) | F0–F3 디자인 점검+수정: 이모지/유니코드 아이콘을 Tabler 라인 아이콘으로 교체(DESIGN §7 정합), 홈 버킷 로직 버그 수정(지연 워크스페이스 누락·기획중 중복 → 진행중=active+late/예정=planning/완료=done). 타임라인 스트리밍 텍스트를 명조→본문 산세리프로(명조는 문서 전용, 사용자 피드백). 다음 세션 시작 가이드 작성. CLAUDE.md·README 현황(F0–F3) 갱신. | `frontend/index.html`, `screens/*`, `shell/Sidebar.tsx`, `plans/NEXT_SESSION.txt`, `CLAUDE.md`, `README.md` | 검토 완료(스크린샷 재캡처) |

## 2026-06-17

| 도구/모델 | 한 일 | 산출물 | 사람 검토·수정 |
|---|---|---|---|
| Claude Code (Opus 4.8) | V0 Pi 검증 스파이크: 실제 OpenRouter 키로 `createAgentSession`→`prompt`→`subscribe` 스트리밍 실측 + `.d.ts` 직접 확인. 미검증 3종 해결 — 중지=`abort()`, 모델전환=`setModel()`, 되묻기=ExtensionUIContext(ui.select/confirm). F1 계약 그대로 유효 확정, "잠정" 주석 해제. 프런트는 mock 유지(실 API 미사용). | `scratch/pi-spike.ts`(로컬), `plans/PI_INTEGRATION.md §8`, `plans/TASKS.md`, `frontend/src/agent/contract.ts`(주석), `CLAUDE.md`(mock 개발 규칙) | 검토 완료(스파이크 실행 결과) |
| Claude Code (Opus 4.8) | Claude 경로 스모크 테스트(구독 OAuth) 통과 → 두 프로바이더(OpenRouter·Claude SDK) 다 검증. **B1 백엔드**: `backend/`(Fastify+@fastify/websocket, ESM) `/ws`·`/health`, 모델 레지스트리(`models.ts`)·폴백(`runWithFallback.ts`)+WS 통지(model_current/switch), 단위 테스트 3/3. WS 왕복 검증. prompt 처리부는 데모(B2에서 실제 Pi로 교체). | `backend/*`, `plans/TASKS.md` | 검토 완료(테스트·WS 왕복) |
| Claude Code (Opus 4.8) | **B2 — M1 달성**: backend 데모를 실제 Pi(`createAgentSession`+`subscribe`→F1 계약 변환, prompt/abort 배선)로 교체. frontend `realClient.ts`(WS) 작성, `useAgentRun`을 env 토글(`VITE_USE_REAL_AGENT`)로 — 기본 mock, 검증 때만 실제. 브라우저에서 실제 Pi(gpt-4o-mini) 응답이 무수정 S3에 스트리밍됨(스크린샷). 루트 spike 패키지는 backend로 정리. | `backend/src/server.ts`, `frontend/src/agent/realClient.ts`·`useAgentRun.ts`, `.gitignore`, `CLAUDE.md` | 검토 완료(M1 스크린샷·실 Pi) |

---

<!-- 새 항목 추가 시 날짜 섹션 + 표 행으로. AI가 생성한 코드는 사람이 검토했음을 명시. -->
