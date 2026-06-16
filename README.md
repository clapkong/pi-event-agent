# pi-event-agent

Pi 에이전트 프레임워크 기반 **행사 기획 AI 에이전트 웹 서비스**.
사용자가 행사 조건(유형·인원·예산)을 입력하면 에이전트가 진행 과정을 스트리밍하며
리서치·기획·산출하고, 과거 행사의 업체·스펙·교훈을 다음 기획에 재사용한다.

## 저장소 구조

```
.
├─ .pi/
│  └─ agents/                      # 전용 에이전트 정의 (.md)
├─ extensions/                     # Pi Extension (커스텀 결정론적 도구, case_search/insert 등)
├─ skills/                         # Skill (<이름>/SKILL.md 절차, 자동 발견)
├─ frontend/                       # React + Vite 프런트 (홈·기획폼·타임라인, F0–F3·mock 구동)
├─ backend/                        # 얇은 Node + WebSocket + Pi 세션 + 모델 레지스트리 (B1·B2 구현, M1)
├─ .mcp.json                       # MCP 서버 등록 (검색·지도·Gmail·캘린더)    (예정)
├─ docs/                           # 공개 문서
│  ├─ DESIGN.md                    #   디자인 시스템 (시각 토큰·컴포넌트)
│  ├─ BUILD.md                     #   구현 플레이북 — 단계 정의(F0–F5 / B1–B4 / M1–M7)
│  ├─ TASKS.md                     #   원자 단위 실행 체크리스트 (진행 현황)
│  ├─ ai-usage-log.md              #   AI 사용 기록
│  └─ mockup/                      #   실행 화면 / 시안 PNG
├─ CLAUDE.md                       # 에이전트 작업 가이드
├─ .gitignore
├─ LICENSE                         # (예정)
└─ README.md
```

> 기획·설계 문서는 `plans/`에 모아 로컬 전용(`.gitignore`)으로 둔다 — 공개 repo엔 코드 + `README` + `docs/`만.

## 현재 상태

입력 → WebSocket → 실제 Pi 세션 → 스트리밍까지 관통(M1). 프런트는 같은 계약(`contract.ts`)만 의존하므로 mock ↔ 실제 백엔드를 무수정으로 교체한다.

- **UI 구현(mock — 실제 기능 아님)**: 사이드바 셸 · 홈 대시보드 · 기획 폼 · 동작 타임라인 / 얇은 WS 백엔드 + 모델 레지스트리·폴백 / **실제 Pi 연동(M1)**
- **예정**: 작업공간·상태 모델 · 결과 문서(프런트) / Extension·Skill·MCP·pgvector(백엔드 B3)

```bash
# 프런트 (mock, 외부 의존 0)
cd frontend && npm install && npm run dev

# 실제 Pi 백엔드까지 (OPENROUTER_API_KEY 필요)
cd backend && npm install && npm start            # 터미널 1
echo "VITE_USE_REAL_AGENT=1" > frontend/.env.local # 터미널 2 (검증 후 삭제)
cd frontend && npm run dev
```

> 보안: 에이전트의 내장 파일/셸 도구는 비활성(`noTools`)이며, 앞으로 우리가 정의한 Extension만 허용한다.

## Pi 필수 5요소

- **Pi** — 코어 임베드 + 스트리밍
- **Skill** — `skills/<이름>/SKILL.md` 절차
- **MCP** — 외부 소비(검색·지도/날씨·Gmail·캘린더, `.mcp.json`). 사례DB는 Extension(pgvector), 자작 MCP 노출은 P3 가점
- **Pi Extension** — `extensions/`의 커스텀 결정론적 도구
- **Web UI** — CLI 아닌 React
