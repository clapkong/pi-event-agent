# backend — 행사 기획 에이전트 (B방식)

`pi --mode rpc` 서브프로세스를 웹(WS)으로 중계하는 **얇은 통역 콜센터.**
에이전트 지능은 전부 레포 루트의 `.pi/`(Planner·서브·skill·extension·MCP)에 있고, 여기는 *배관*만.

## 모듈 지도 (책임 1개씩)
```
contract.ts    WS API 명세(정본). 백→프 이벤트 + 프→백 명령. 순수 타입.
rpc.ts         pi rpc 프로토콜 타입(실측). 명령/이벤트.
config.ts      포트·경로·pi 인자.
workspace.ts   행사 id → cwd(workspace/<id>) · 세션ID. 폴더 보장.
bridge.ts      rpc ↔ contract 변환만(순수). 통신 모름 → 테스트 쉬움.
pi-session.ts  pi 자식 1개 소유: spawn·send·onEvent·close. 프런트 모름.
ws-handler.ts  연결 1개 = pi-session + bridge 엮기(글루).
server.ts      Fastify 엔트리(/ws·/health). 얇게.
```

## 흐름
```
브라우저 {kind} ─WS→ server → ws-handler → bridge(→rpc) → pi-session → pi(.pi/)
브라우저 ←WS─ AgentEvent ← bridge(←rpc) ← pi-session ← pi
```

## 실행
```
npm install
npm run dev          # 풀 에이전트
PI_SMOKE=1 npm run dev   # 배관만 싸게(.pi/ 컨텍스트·확장 끔)
```
프런트: `frontend/.env.local` 에 `VITE_USE_REAL_AGENT=1` → realClient 가 ws://127.0.0.1:8787/ws 로 붙음.

## 구현 순서 (골격 → 하나씩)
- [x] 스캐폴드(타입·config·모듈 골격)
- [ ] bridge (순수 — 단위테스트로 매핑 검증, pi 없이)
- [ ] pi-session (작은 스모크)
- [ ] ws-handler + server 배선 → 브라우저 1왕복 + 터미널 tee
- [ ] resume: --session-id 영속 + 재접속 시 타임라인 복원
- [ ] contract 정본화: 프런트가 이 파일을 `@contract` 로 참조(사본 제거)
```
