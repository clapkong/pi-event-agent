# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 불변 규칙

- 백엔드 구조를 뜯어고칠 예정이기 때문에 frontend의 기능을 유지하되, 백엔드 규칙 관련 주석이나 구조는 무시하는 방향으로. 새로 정의가 필요하면 프런트에 정의된 걸 버리고 적극적으로 수용하기. plans/도 제대로 된 파일들이 아니라는 점 명심하기
- **한국어로 응답**한다.
- 교수를 가리킬 땐 반드시 **"교수님"**(존칭). "교수"라고만 쓰지 않는다.
- 기획은 AI로 구체화한 거라 실제와 안 맞을 수 있다. **불확실하면 지어내지 말고 사용자에게 물어본다.**
- 커밋 메시지: `feat|fix|refactor|...: 요약` + 빈 줄 + 세부. (대괄호 없이)
- 커밋은 **의미 단위로 묶는다** — 작은 수정마다 즉시 커밋하지 말고, 한 작업 덩어리(마일스톤/논리 단위)가 끝나면 관련 변경을 모아서. (1분에 하나씩 X)
- 현재는 CLAUDE.md가 미니멀하게 되어 있으며, 작업을 하면서 구현된 내용 중 필요한 내용을 추가한다.
- 한 단위의 작업을 끝내고 ai-usage-log.md에 기록. 디자인이 수정된 경우 impeccable skill 사용해서 디자인도 점검 및 수정 추천
- **프런트 개발은 mock으로 한다** (`useAgentRun` 기본 = mock). 실제 백엔드(Pi·OpenRouter)는 **검증 때만** — `frontend/.env.local`에 `VITE_USE_REAL_AGENT=1` + `backend` 실행 시에만 `realClient`로 붙는다. 확인 끝나면 env 끄면 자동 mock 복귀(크레딧 절약). 전환은 env 토글 한 곳.
- **개발 중 Claude 모델 호출은 `plans/claude_test` 방식**을 따른다 — Claude Agent SDK(`@anthropic-ai/claude-agent-sdk`) `query()` + **구독 OAuth**(`claude setup-token` → `CLAUDE_CODE_OAUTH_TOKEN`), `ANTHROPIC_API_KEY`는 unset(종량제 회피). 사용자가 구독 결제해둬서 **개발 중엔 사실상 무료**. 모델: `claude-sonnet-4-6`(어려운 추론)·`claude-haiku-4-5-20251001`(일반). ⚠️ **개발 한정** — 실제 배포/실사용 인증은 다르다(종량제 API 또는 모델 레지스트리/OpenRouter 경로).

## ⚠️ Pi SDK 규칙 (가장 중요)

Pi(`@earendil-works/pi-coding-agent`)는 학습 컷오프 이후에 나온 도구라 **API를 추측하면 거의 다 틀린다.** `plans/PI_INTEGRATION.md`의 **검증된 사양만** 따르고, 거기 없는 Pi 함수/옵션이 필요하면 **멈춰서 사용자에게 물어본다.** (Pi 주변의 일반 웹앱 골조 — React·Fastify·WebSocket·DB — 는 평범한 작업이니 자유롭게.)

## 프로젝트 & 정본

Pi 기반 **행사 기획 AI 에이전트 웹 서비스**(오픈소스 SW 수업 기말). **구현 진행 중** — `frontend/`는 F0–F5(홈·기획폼·타임라인·작업공간·문서, 전부 mock) 완성. **백엔드는 Pi부터 새로 작성 예정** — 재시작 핸드오프는 `plans/BACKEND_RESTART.txt`(로컬). 정본·진행 현황은 `plans/`(로컬: `PLAN.md`·`TASKS.md`).

> ⚠️ **현재 프런트는 전부 mock 데이터로 동작한다.** 백엔드가 없어서 가짜로 돌리는 임시 상태다. 실제 데이터 붙일 때(Phase B) **반드시 제거·교체**할 곳:
> - `frontend/src/agent/mockClient.ts` — 에이전트 진행 대본(가짜). `realClient`(WebSocket)로 교체. 교체 지점은 `useAgentRun(makeClient)` 기본값 한 곳.
> - `frontend/src/data/workspaces.ts` `SEED_WORKSPACES` (+ `data/home.ts`의 알림·체크리스트·달력 mock) — 가짜 시드. `store/workspaces.tsx`가 들고 있음. 백엔드 조회로 교체.
> 경계는 `frontend/src/agent/contract.ts`(계약). UI는 이 계약만 의존하므로 위 두 곳만 바꾸면 컴포넌트는 무수정.

**불변 원칙:** 행사 1개 = 워크스페이스 1개 = 작업폴더(`cwd`) 1개 = Pi 세션 1개 = 결과 리포트 1개.

정본·문서 맵은 **`plans/PLAN.md` §0**(로컬). 거기서 시작하면 나머지 문서로 이어진다. 코딩 전엔 `plans/TASKS.md`(단계 정의 `plans/BUILD.md`), 작업 후엔 `docs/ai-usage-log.md`에 한 줄. 과제 명세 최종 권위는 `plans/DETAILS.md`.
