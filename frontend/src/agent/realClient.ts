// agent/realClient.ts — 실제 백엔드(WS)에 붙는 AgentClient 구현 (B2).
// contract.ts(AgentClient)만 구현. 에이전트 mock 제거됨 — useAgentRun이 항상 이걸 쓴다(실제 Pi 호출).
// ⭐ 끊김 내성: WS가 끊기면(HMR·네트워크·일시 blip) 자동 재연결한다. 백엔드는 grace 동안 세션을
//    살려두고 재부착하므로, 재연결되면 같은 런이 이어진다(사용자는 끊김을 못 느낌).

import { WS_URL } from "@/config";
import type { AgentClient, AgentEvent, AgentEventHandler } from "./contract.ts";

export function createRealClient(wsId = "demo", baseUrl = WS_URL): AgentClient {
  const url = `${baseUrl}?ws=${encodeURIComponent(wsId)}`;
  const handlers = new Set<AgentEventHandler>();
  const queue: string[] = [];
  let ws: WebSocket;
  let closed = false; // .close() 로 의도적 종료된 경우만 재연결 안 함
  let retry = 0;

  const emit = (ev: AgentEvent) => {
    for (const h of handlers) h(ev);
  };

  const connect = () => {
    ws = new WebSocket(url);
    ws.addEventListener("message", (e) => {
      let event: AgentEvent;
      try {
        event = JSON.parse(e.data as string);
      } catch {
        return;
      }
      emit(event);
    });
    ws.addEventListener("open", () => {
      retry = 0;
      for (const m of queue) ws.send(m);
      queue.length = 0;
    });
    ws.addEventListener("close", () => {
      if (closed) return;
      // 비의도적 종료 → 백오프 후 자동 재연결(백엔드 grace 세션에 재부착됨).
      retry += 1;
      if (retry === 6) emit({ type: "error", message: "백엔드 재연결 시도 중… (ws://…:8787 확인)" });
      setTimeout(connect, Math.min(500 * 2 ** retry, 5000));
    });
    // error 뒤엔 close 가 따라오므로 재연결은 close 에서만 처리(중복 방지).
    ws.addEventListener("error", () => {});
  };
  connect();

  const sendMsg = (obj: unknown) => {
    const s = JSON.stringify(obj);
    if (ws.readyState === WebSocket.OPEN) ws.send(s);
    else queue.push(s); // 연결 전/재연결 중이면 큐잉했다가 open 시 전송
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
      closed = true;
      handlers.clear();
      try {
        ws.close();
      } catch {
        /* 이미 닫힘 */
      }
    },
  };
}
