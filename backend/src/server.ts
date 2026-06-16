// 얇은 Fastify + WebSocket 서버 (B1). WS 왕복 + 모델 레지스트리·폴백 통지 데모.
// ⚠️ prompt 처리부는 B1에선 데모(가짜 스트리밍)다. B2에서 실제 Pi 세션으로 교체한다.

import Fastify from "fastify";
import websocket from "@fastify/websocket";
import type { WebSocket } from "@fastify/websocket";
import { runWithFallback } from "./runWithFallback.ts";
import type { AgentEvent, ClientMessage } from "./contract.ts";

const PORT = Number(process.env.PORT ?? 8787);

const app = Fastify({ logger: false });
await app.register(websocket);

app.get("/health", async () => ({ ok: true }));

app.get("/ws", { websocket: true }, (socket: WebSocket) => {
  const send = (e: AgentEvent) => socket.send(JSON.stringify(e));

  socket.on("message", async (raw: Buffer) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      send({ type: "error", message: "잘못된 메시지 형식" });
      return;
    }

    if (msg.kind === "prompt") {
      await handlePromptDemo(msg.text, send);
    } else if (msg.kind === "abort") {
      // B2에서 session.abort() 배선. 지금은 ack.
      send({ type: "done" });
    } else if (msg.kind === "answer") {
      // B2에서 ExtensionUIContext 응답으로 배선.
    }
  });
});

// B1 데모: 모델 레지스트리·폴백으로 현재 모델/전환 통지 → 가짜 텍스트 스트리밍.
// (B2에서 createAgentSession + subscribe 실제 이벤트로 교체)
async function handlePromptDemo(text: string, send: (e: AgentEvent) => void) {
  try {
    const reply = await runWithFallback(
      "default",
      async (model) => {
        // 실제 LLM 호출 자리(B2). 지금은 모델만 고르고 에코.
        return `[${model.name}] 데모 응답: "${text}" 잘 받았어요.`;
      },
      {
        current: (name) => send({ type: "model_current", name }),
        switched: (from, to, reason) => send({ type: "model_switch", from, to, reason }),
      }
    );

    for (const ch of reply) send({ type: "text_delta", delta: ch });
    send({ type: "done" });
  } catch (e) {
    send({ type: "error", message: e instanceof Error ? e.message : "알 수 없는 오류" });
  }
}

app
  .listen({ port: PORT, host: "127.0.0.1" })
  .then(() => console.log(`backend listening on ws://127.0.0.1:${PORT}/ws`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
