// agent/harness.ts — 이벤트 스트림 콘솔 출력 하니스 (TASKS F1.4).
//
// 실행: node src/agent/harness.ts   (Node 24 네이티브 TS 스트리핑)
// mockClient 가 흘리는 이벤트를 순서대로 찍고, 되묻기/게이트엔 자동 응답한다.
// 완료 확인: 콘솔에 case_search → ask → estimate_budget → gate →
//            proposal-writer 시퀀스가 순서대로 찍힌다.

import { createMockClient } from "./mockClient.ts";

const client = createMockClient();
let n = 0;

const unsubscribe = client.subscribe((e) => {
  n += 1;
  const tag = String(n).padStart(2, "0");

  switch (e.type) {
    case "text_delta":
      // 스트리밍은 한 줄로 모아 보기 좋게 (개행 없이 이어붙임)
      process.stdout.write(e.delta);
      break;
    case "tool_start":
      console.log(`\n[${tag}] ▶ tool_start  [${e.element}] ${e.tool} — ${e.label}`);
      break;
    case "tool_end":
      console.log(
        `[${tag}] ✔ tool_end    ${e.result}${e.citation ? `  (출처 #${e.citation})` : ""}`
      );
      break;
    case "ask":
      console.log(`[${tag}] ? ask         ${e.question}  [${e.options.join(" · ")}]`);
      setTimeout(() => client.answer(e.options[0]), 80); // 첫 선택지로 자동 응답
      break;
    case "gate":
      console.log(`[${tag}] ⛉ gate        ${e.question}`);
      setTimeout(() => client.answer("승인"), 80); // 자동 승인
      break;
    case "model_switch":
      console.log(`[${tag}] ⇄ model_switch ${e.from ?? "?"} → ${e.to}  (${e.reason})`);
      break;
    case "model_current":
      console.log(`[${tag}] ● model_current ${e.name}`);
      break;
    case "done":
      console.log(`\n[${tag}] ■ done — 시퀀스 완료 ✓`);
      unsubscribe();
      break;
    case "error":
      console.log(`\n[${tag}] ✕ error       ${e.message}`);
      unsubscribe();
      break;
  }
});

client.prompt("프론트엔드 밋업 200명, 예산 500만원");
