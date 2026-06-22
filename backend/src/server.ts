// server.ts — 엔트리. Fastify 와이어링만(얇게). 실제 일은 ws-handler 가.
import { readFile, writeFile } from "node:fs/promises";
import Fastify from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import { PORT, SMOKE } from "./config.ts";
import { getWeather } from "./weather.ts";
import { handleConnection } from "./ws-handler.ts";
import { createWorkspace, listWorkspaces, safeId, stateFile, workspaceCwd } from "./workspace.ts";

const app = Fastify({ logger: false });
await app.register(fastifyWebsocket);

// 프런트(Vite dev, 다른 origin)에서 REST 조회 허용. 단순 GET이라 preflight 없음 → 헤더만.
app.addHook("onRequest", async (_req, reply) => {
  reply.header("access-control-allow-origin", "*");
});

app.get("/health", async () => ({ ok: true, smoke: SMOKE }));

// 워크스페이스 목록 (사이드바·홈 타일). meta.json 기준.
app.get("/api/workspaces", async () => listWorkspaces());

// 워크스페이스 생성 (새 행사 폼). id 는 프런트가 보낸 값 사용(없으면 생성).
app.post("/api/workspaces", async (req, reply) => {
  const b = (req.body ?? {}) as { id?: string; name?: string; summary?: string };
  if (!b.name?.trim()) {
    reply.code(400);
    return { error: "name_required" };
  }
  return createWorkspace({ id: b.id, name: b.name, summary: b.summary });
});

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

// 날씨: Open-Meteo로 예보(≤16일)/평년값(그 이상·과거) 조회 → state.json.weather 에 저장 → 보드가 읽음.
// GET ?date=YYYY-MM-DD(필수) & (lat&lon | place). weather 는 잠금 없는 필드라 백엔드가 직접 채워도 가드와 무관.
app.get("/api/workspaces/:id/weather", async (req, reply) => {
  const id = safeId((req.params as Record<string, string>).id);
  const q = req.query as Record<string, string>;
  if (!q.date) {
    reply.code(400);
    return { error: "date_required", hint: "?date=YYYY-MM-DD & (lat&lon | place)" };
  }
  try {
    const w = await getWeather({
      latitude: q.lat ? Number(q.lat) : undefined,
      longitude: q.lon ? Number(q.lon) : undefined,
      place: q.place,
      eventDate: q.date,
    });
    // state.json 의 weather 필드만 병합 저장(읽기-수정-쓰기). 폴더 보장.
    workspaceCwd(id);
    let state: Record<string, unknown> = {};
    try {
      state = JSON.parse(await readFile(stateFile(id), "utf-8"));
    } catch {
      /* state.json 없으면 새로 만듦 */
    }
    state.weather = { label: w.label, temp: w.temp, pop: w.pop, stale: w.stale, source: w.source, basis: w.basis };
    await writeFile(stateFile(id), `${JSON.stringify(state, null, 2)}\n`, "utf-8");
    return w;
  } catch (e) {
    reply.code(400);
    return { error: (e as Error).message };
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
