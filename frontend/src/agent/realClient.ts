// agent/realClient.ts — 실제 백엔드(WS)에 붙는 AgentClient 구현 (B2).
// contract.ts(AgentClient)만 구현. 에이전트 mock 제거됨 — useAgentRun이 항상 이걸 쓴다(실제 Pi 호출).

import { WS_URL } from "@/config";
import type { AgentClient, AgentEvent, AgentEventHandler } from "./contract.ts";

export function createRealClient(wsId = "demo", baseUrl = WS_URL): AgentClient {
  const ws = new WebSocket(`${baseUrl}?ws=${encodeURIComponent(wsId)}`);
  const handlers = new Set<AgentEventHandler>();
  const queue: string[] = [];

  ws.addEventListener("message", (e) => {
    let event: AgentEvent;
    try {
      event = JSON.parse(e.data as string);
    } catch {
      return;
    }
    for (const h of handlers) h(event);
  });
  ws.addEventListener("open", () => {
    for (const m of queue) ws.send(m);
    queue.length = 0;
  });
  ws.addEventListener("error", () => {
    for (const h of handlers)
      h({ type: "error", message: "백엔드 연결 실패 (ws://…:8787)" });
  });

  const sendMsg = (obj: unknown) => {
    const s = JSON.stringify(obj);
    if (ws.readyState === WebSocket.OPEN) ws.send(s);
    else queue.push(s);
  };

  return {
    subscribe(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    prompt(text) {
      sendMsg({ kind: "prompt", text });
    },
    answer(choice) {
      sendMsg({ kind: "answer", choice });
    },
    abort() {
      sendMsg({ kind: "abort" });
    },
    close() {
      handlers.clear();
      try {
        ws.close();
      } catch {
        /* 이미 닫힘 */
      }
    },
  };
}
