# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 불변 규칙

- 설계·정본 문서는 **`docs/`(커밋됨)** — `ARCHITECTURE`(구조+상태 모델+검증된 Pi 사양)·`PI_ELEMENTS`(에이전트+Skill+MCP+Extension)·`DESIGN`(시각). 과제 명세는 로컬 **`plans/DETAILS.md`**(권위). (`plans/test/`는 데모 스캐폴딩, 로컬 전용.)
- Pi 사양은 공식 문서(맨 아래 'Pi 규칙들' 링크)와 `docs/ARCHITECTURE.md §9`(검증된 rpc·Extension 사양) 우선
- **한국어로 응답**한다.
- 교수를 가리킬 땐 반드시 **"교수님"**(존칭). "교수"라고만 쓰지 않는다.
- 기획은 AI로 구체화한 거라 실제와 안 맞을 수 있다. **불확실하면 지어내지 말고 사용자에게 물어본다.**
- 커밋 메시지: `feat|fix|refactor|...: 요약` + 빈 줄 + 세부. (대괄호 없이)
- 커밋은 **의미 단위로 묶는다** — 작은 수정마다 즉시 커밋하지 말고, 한 작업 덩어리(마일스톤/논리 단위)가 끝나면 관련 변경을 모아서. (1분에 하나씩 X)
- 현재는 CLAUDE.md가 미니멀하게 되어 있으며, 작업을 하면서 구현된 내용 중 필요한 내용을 추가한다.
- 한 단위의 작업을 끝내고 ai-usage-log.md에 기록. 디자인이 수정된 경우 impeccable skill 사용해서 디자인도 점검 및 수정 추천
- **에이전트·데이터 모두 실백엔드로 동작** — agent mock(`mockClient`) 제거됨, `useAgentRun`은 항상 `realClient`(ws://127.0.0.1:8787). 데이터 화면(home·board·doc·cases)도 백엔드 REST(`/api/*`)로 연결됨 — mock seed 제거. 따라서 `backend/`(pi rpc↔WS + REST) 실행 필요.
- **개발 중 Claude 모델 호출은 구독 OAuth 방식**을 따른다 — Claude Agent SDK(`@anthropic-ai/claude-agent-sdk`) `query()` + **구독 OAuth**(`claude setup-token` → `CLAUDE_CODE_OAUTH_TOKEN`), `ANTHROPIC_API_KEY`는 unset(종량제 회피). 사용자가 구독 결제해둬서 **개발 중엔 사실상 무료**. 모델: `claude-sonnet-4-6`(어려운 추론)·`claude-haiku-4-5-20251001`(일반). ⚠️ **개발 한정** — 실제 배포/실사용 인증은 다르다(종량제 API 또는 모델 레지스트리/OpenRouter 경로).

## ⚠️ Pi SDK 규칙 (가장 중요)

Pi(`@earendil-works/pi-coding-agent`)는 학습 컷오프 이후에 나온 도구라 **API를 추측하면 거의 다 틀린다.** `docs/ARCHITECTURE.md §9`(검증된 Pi rpc·Extension 사양)의 **검증된 사양만** 따르고, 거기 없는 Pi 함수/옵션이 필요하면 **멈춰서 사용자에게 물어본다.** (Pi 주변의 일반 웹앱 골조 — React·Fastify·WebSocket·DB — 는 평범한 작업이니 자유롭게.)

## 프로젝트 & 정본

Pi 기반 **행사 기획 AI 에이전트 웹 서비스**(오픈소스 SW 수업 기말). 프런트(`frontend/`) + 백엔드(`backend/`: `pi --mode rpc`↔WS/REST 브리지) 구현됨 — 에이전트 대화(WS)·데이터 화면(REST) 모두 실백엔드 연결. 설계 정본은 `docs/`, 남은 일은 `TODO.md`.

> 실데이터: ✅ 에이전트(`realClient`, WS) + ✅ 데이터 화면(REST `/api/*` ← `workspace/<id>/state.json`·`cases/*.md`) 모두 백엔드 연결 완료. mock seed 제거됨. 프런트 백엔드 접점 = `frontend/src/agent/contract.ts`(에이전트 WS 계약) + `/api/*`(데이터 REST).

**불변 원칙:** 행사 1개 = 워크스페이스 1개 = 작업폴더(`cwd`) 1개 = Pi 세션 1개 = 결과 리포트 1개.

**문서 맵(`docs/`):** 시스템 구조·상태 모델·검증된 Pi 사양 `ARCHITECTURE.md` → Pi 구성요소(에이전트·Skill·MCP·Extension) `PI_ELEMENTS.md`(메인 프롬프트는 `AGENTS.md`) → 시각 `DESIGN.md`. 제품 정의·화면·MCP 설치는 `README.md`. 과제 명세 최종 권위는 **`plans/DETAILS.md`**(로컬). 작업 후엔 `docs/ai-usage-log.md`에 한 줄.

# Pi 규칙들
- Pi Documentation: https://pi.dev/docs/latest
- Pi Skills Documentation: https://pi.dev/docs/latest/skills
- Pi Packages Documentation: https://pi.dev/docs/latest/packages
- Agent Skills Overview: https://agentskills.io/home
- Agent Skills Specification: https://agentskills.io/specification