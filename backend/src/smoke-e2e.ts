// smoke-e2e.ts — 전체 사슬 + 백그라운드 서브 완료 이어짐 확인.
// 프롬프트 보내고 연결 유지한 채 기다려서, agent_end(done) 후에도
// researcher 완료→followUp→ask 가 오는지 본다. (TUI 패리티 확인)
// 실행: (서버 먼저 풀모드) npm run smoke:e2e
const URL = "ws://127.0.0.1:8787/ws?ws=e2e-cont";
let tries = 0;
let doneAt = 0;

function connect() {
  const ws = new WebSocket(URL);

  ws.addEventListener("open", () => {
    console.log("[connected] → prompt");
    ws.send(
      JSON.stringify({
        kind: "prompt",
        text: "사내 워크숍 기획해줘. 200명, 예산 500만원, 서울, 9월 셋째 주 금요일, 팀 네트워킹. 장소·케이터링 조사하고 제안서 초안까지.",
      }),
    );
  });

  ws.addEventListener("message", (e) => {
    const ev = JSON.parse(e.data as string);
    const t = new Date().toLocaleTimeString();
    if (ev.type === "text_delta") process.stdout.write(".");
    else if (ev.type === "tool_start") console.log(`\n[${t}] tool_start: ${ev.tool} (${ev.element})`);
    else if (ev.type === "tool_end") console.log(`[${t}] tool_end: ${String(ev.result).slice(0, 60)}`);
    else if (ev.type === "ask") console.log(`\n🟢 [${t}] ASK: ${ev.question} / 옵션: ${JSON.stringify(ev.options)}`);
    else if (ev.type === "gate") console.log(`\n🟢 [${t}] GATE: ${ev.question}`);
    else if (ev.type === "done") {
      doneAt = Date.now();
      console.log(`\n⏸  [${t}] done (agent_end) — 백그라운드 완료 대기...`);
    } else console.log(`\n[${t}] ${ev.type}`, ev.name ?? "");
  });

  ws.addEventListener("error", () => {
    if (tries++ < 20) setTimeout(connect, 300);
    else {
      console.error("연결 실패");
      process.exit(1);
    }
  });
}

connect();

// done 후에도 끊지 않고 90초까지 기다린다(group-join 지연 ~30s + researcher 시간).
setTimeout(() => {
  console.log(`\n--- 90s 종료. done 이후 ask가 왔으면 TUI 패리티 OK ---`);
  process.exit(0);
}, 90_000);
