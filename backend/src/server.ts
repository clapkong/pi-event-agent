// server.ts — 엔트리. Fastify 와이어링만(얇게). 실제 일은 ws-handler 가.
import { readFile } from "node:fs/promises";
import Fastify from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import { PORT, SMOKE } from "./config.ts";
import { handleConnection } from "./ws-handler.ts";
import { safeId, stateFile } from "./workspace.ts";

const app = Fastify({ logger: false });
await app.register(fastifyWebsocket);

// 프런트(Vite dev, 다른 origin)에서 REST 조회 허용. 단순 GET이라 preflight 없음 → 헤더만.
app.addHook("onRequest", async (_req, reply) => {
  reply.header("access-control-allow-origin", "*");
});

app.get("/health", async () => ({ ok: true, smoke: SMOKE }));

// 보드 상태 조회: update_state(유일 writer)가 쓴 workspace/<id>/state.json 을 그대로 서빙.
// 없으면 404 → 프런트는 seed(데모)로 폴백.
app.get("/api/workspaces/:id", async (req, reply) => {
  const id = safeId((req.params as Record<string, string>).id);
  try {
    return JSON.parse(await readFile(stateFile(id), "utf-8"));
  } catch {
    reply.code(404);
    return { error: "no_state", id };
  }
});

// 프런트 realClient 가 붙는 곳: ws://127.0.0.1:8787/ws?ws=<id>
app.get("/ws", { websocket: true }, (socket, req) => {
  const wsId = safeId(((req.query as Record<string, string>)?.ws ?? "demo"));
  console.log(`[ws] connected ws=${wsId}${SMOKE ? " (smoke)" : ""}`);
  handleConnection(socket, wsId);
});

await app.listen({ port: PORT, host: "127.0.0.1" });
console.log(`backend up: http://127.0.0.1:${PORT}  (ws /ws?ws=<id>)${SMOKE ? "  [PI_SMOKE]" : ""}`);
