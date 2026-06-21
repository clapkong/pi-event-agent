// server.ts — 엔트리. Fastify 와이어링만(얇게). 실제 일은 ws-handler 가.
import Fastify from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import { PORT, SMOKE } from "./config.ts";
import { handleConnection } from "./ws-handler.ts";
import { safeId } from "./workspace.ts";

const app = Fastify({ logger: false });
await app.register(fastifyWebsocket);

app.get("/health", async () => ({ ok: true, smoke: SMOKE }));

// 프런트 realClient 가 붙는 곳: ws://127.0.0.1:8787/ws?ws=<id>
app.get("/ws", { websocket: true }, (socket, req) => {
  const wsId = safeId(((req.query as Record<string, string>)?.ws ?? "demo"));
  console.log(`[ws] connected ws=${wsId}${SMOKE ? " (smoke)" : ""}`);
  handleConnection(socket, wsId);
});

await app.listen({ port: PORT, host: "127.0.0.1" });
console.log(`backend up: http://127.0.0.1:${PORT}  (ws /ws?ws=<id>)${SMOKE ? "  [PI_SMOKE]" : ""}`);
