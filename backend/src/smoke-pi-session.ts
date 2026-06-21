// smoke-pi-session.ts — PiSession 실제 동작 확인. 실행: npm run smoke
// smoke:true 라 풀 에이전트 끔(싸게). 프롬프트 1개 → 이벤트 출력 → agent_end 시 종료.
import { PiSession } from "./pi-session.ts";
import { REPO_ROOT } from "./config.ts";

const session = new PiSession({ cwd: REPO_ROOT, sessionId: "smoke", smoke: true });

session.onEvent((ev) => {
  if (ev.type === "message_update") {
    const a = ev.assistantMessageEvent;
    if (a?.type === "text_delta") process.stdout.write(a.delta);
    else console.log(`  · ${a?.type}`);
  } else {
    console.log("EVENT", ev.type);
  }
  if (ev.type === "agent_end") {
    console.log("\n[done]");
    session.close();
  }
});

session.onExit((code) => {
  console.log("[pi exited]", code);
  process.exit(0);
});

setTimeout(() => {
  console.log(">> prompt");
  session.send({ type: "prompt", message: "한 문장으로 자기소개해줘." });
}, 1000);
