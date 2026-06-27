// server.ts — 엔트리. Fastify 와이어링만(얇게). 실제 일은 ws-handler 가.
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import Fastify from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import { DATA_ROOT, HOST, PORT, REPO_ROOT } from "./config.ts";
import { getWeather } from "./weather.ts";
import { handleConnection } from "./ws-handler.ts";
import {
  commsFile,
  createWorkspace,
  listArtifacts,
  listWorkspaces,
  proposalFile,
  safeId,
  stateFile,
  workspaceCwd,
  workspaceFile,
} from "./workspace.ts";

const app = Fastify({ logger: false });
await app.register(fastifyWebsocket);

// 프런트(Vite dev, 다른 origin) CORS. PATCH/JSON 은 preflight(OPTIONS) 필요 → 같이 처리.
app.addHook("onRequest", async (req, reply) => {
  reply.header("access-control-allow-origin", "*");
  reply.header("access-control-allow-methods", "GET,POST,PATCH,PUT,OPTIONS");
  reply.header("access-control-allow-headers", "content-type");
  if (req.method === "OPTIONS") {
    reply.code(204);
    return reply.send();
  }
});

app.get("/health", async () => ({ ok: true }));

// 사례(cases/*.md) 파싱 — frontmatter(id·title·type·headcount·venue·date·satisfaction·budgetActual) + 본문.
// pi-local-rag 가 인덱싱하는 같은 파일을 프런트 사례 화면도 읽게 한다(하드코딩 사례 제거).
function parseCase(md: string, fallbackId: string) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const fm = m ? m[1] : "";
  const body = (m ? m[2] : md).trim();
  const get = (k: string) => fm.match(new RegExp(`^${k}:\\s*(.+)$`, "m"))?.[1].trim() ?? "";
  const budgetActual: { name: string; amount: number }[] = [];
  for (const line of fm.split("\n")) {
    const b = line.match(/-\s*\{\s*name:\s*(.+?),\s*amount:\s*(\d+)\s*\}/);
    if (b) budgetActual.push({ name: b[1].trim(), amount: Number(b[2]) });
  }
  return {
    id: get("id") || fallbackId,
    title: get("title"),
    type: get("type"),
    headcount: Number(get("headcount")) || 0,
    venue: get("venue"),
    date: get("date"),
    satisfaction: Number(get("satisfaction")) || 0,
    budgetActual,
    body,
  };
}

app.get("/api/cases", async () => {
  const dir = join(DATA_ROOT, "cases");
  let files: string[] = [];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".md")).sort();
  } catch {
    /* cases 폴더 없음 */
  }
  const cases = [];
  for (const f of files) {
    try {
      cases.push(parseCase(await readFile(join(dir, f), "utf-8"), f.replace(/\.md$/, "")));
    } catch {
      /* skip */
    }
  }
  return { cases };
});

app.get("/api/cases/:id", async (req, reply) => {
  const id = safeId((req.params as Record<string, string>).id);
  try {
    return parseCase(await readFile(join(DATA_ROOT, "cases", `${id}.md`), "utf-8"), id);
  } catch {
    reply.code(404);
    return { error: "not_found", id };
  }
});

// 연결 상태(사이드바 ConnPanel): 실제 .pi 설정에서 파생 — 하드코딩 더미 제거.
// 모델 = settings.defaultModel, MCP = mcp.json 서버, 검색·RAG = settings.packages.
app.get("/api/connections", async () => {
  const piDir = join(REPO_ROOT, ".pi");
  let model = "(미설정)";
  let packages: string[] = [];
  try {
    const s = JSON.parse(await readFile(join(piDir, "settings.json"), "utf-8"));
    model = s.defaultModel ?? model;
    packages = Array.isArray(s.packages) ? s.packages : [];
  } catch {
    /* 설정 없음 */
  }
  let mcps: string[] = [];
  try {
    const m = JSON.parse(await readFile(join(piDir, "mcp.json"), "utf-8"));
    mcps = Object.keys(m.mcpServers ?? m.servers ?? m);
  } catch {
    /* mcp 없음 */
  }
  const has = (pkg: string) => packages.some((p) => p.includes(pkg));
  const mcpLabel: Record<string, string> = { gmail: "이메일", calendar: "캘린더", maps: "지도/날씨" };
  // status="configured" = .pi 설정에 등록됨(실시간 연결 확인이 아님 — liveness는 런타임 rpc에서만 알 수 있음).
  type Item = { name: string; kind: "LLM" | "MCP" | "Extension"; sub: string; status: "configured" | "off" };
  const items: Item[] = [
    { name: "LLM", kind: "LLM", sub: `현재 모델: ${model}`, status: model === "(미설정)" ? "off" : "configured" },
  ];
  for (const id of mcps) items.push({ name: mcpLabel[id] ?? id, kind: "MCP", sub: `${id} MCP`, status: "configured" });
  if (has("pi-web-access")) items.push({ name: "검색", kind: "MCP", sub: "pi-web-access", status: "configured" });
  if (has("pi-local-rag")) items.push({ name: "사례 RAG", kind: "Extension", sub: "pi-local-rag", status: "configured" });
  return { model, items };
});

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
// 없으면 404 → 프런트는 빈 보드를 보여준다(seed/mock 폴백 없음).
app.get("/api/workspaces/:id", async (req, reply) => {
  const id = safeId((req.params as Record<string, string>).id);
  try {
    return JSON.parse(await readFile(stateFile(id), "utf-8"));
  } catch {
    reply.code(404);
    return { error: "no_state", id };
  }
});

// 사람이 작업공간에서 직접 편집(잠금·값 변경) → state.json 병합 저장. (사람은 잠금/확정의 권한자)
app.patch("/api/workspaces/:id", async (req, reply) => {
  const id = safeId((req.params as Record<string, string>).id);
  let cur: Record<string, unknown> = {};
  try {
    cur = JSON.parse(await readFile(stateFile(id), "utf-8"));
  } catch {
    /* 없으면 새로 */
  }
  workspaceCwd(id); // 폴더 보장
  const next = { ...cur, ...(req.body as Record<string, unknown>) };
  await writeFile(stateFile(id), `${JSON.stringify(next, null, 2)}\n`, "utf-8");
  return next;
});

// 제안서(결과 리포트) 조회: save_report 가 쓴 workspace/<id>/proposal.md.
app.get("/api/workspaces/:id/proposal", async (req, reply) => {
  const id = safeId((req.params as Record<string, string>).id);
  let versions: unknown[] = [];
  try {
    const s = JSON.parse(await readFile(stateFile(id), "utf-8"));
    if (Array.isArray(s.versions)) versions = s.versions;
  } catch {
    /* state 없음 */
  }
  try {
    const markdown = await readFile(proposalFile(id), "utf-8");
    // 제안서는 있는데 버전 로그가 없으면(예: 외부에서 들어온 파일) 파일 작성시각으로 v1 베이스라인.
    if (versions.length === 0) {
      let at = new Date().toISOString();
      try {
        at = (await stat(proposalFile(id))).mtime.toISOString();
      } catch {
        /* mtime 실패 시 now */
      }
      versions = [{ v: 1, author: "ai", at, summary: "AI 제안서 작성" }];
    }
    return { markdown, versions };
  } catch {
    reply.code(404);
    return { error: "no_proposal", id, versions };
  }
});

// 사람이 문서를 직접 편집 → proposal.md 저장 + 버전 로그(사람)를 state.json 에 적립.
app.put("/api/workspaces/:id/proposal", async (req, reply) => {
  const id = safeId((req.params as Record<string, string>).id);
  const body = req.body as { markdown?: unknown };
  if (typeof body?.markdown !== "string") {
    reply.code(400);
    return { error: "markdown_required" };
  }
  workspaceCwd(id);
  await writeFile(proposalFile(id), body.markdown, "utf-8");
  // 버전 로그(사람 직접 수정)
  let state: Record<string, unknown> = {};
  try {
    state = JSON.parse(await readFile(stateFile(id), "utf-8"));
  } catch {
    /* 새로 */
  }
  const versions = Array.isArray(state.versions) ? (state.versions as unknown[]) : [];
  versions.push({ v: versions.length + 1, author: "human", at: new Date().toISOString(), summary: "사람 직접 수정" });
  state.versions = versions;
  state.proposalVersion = versions.length;
  await writeFile(stateFile(id), `${JSON.stringify(state, null, 2)}\n`, "utf-8");
  return { ok: true, version: versions.length };
});

// 산출물 목록: 워크스페이스의 모든 문서(.md) + 적립된 사례 id(있으면). 제안서 외 다른 문서도 포함.
app.get("/api/workspaces/:id/artifacts", async (req) => {
  const id = safeId((req.params as Record<string, string>).id);
  let caseId: string | undefined;
  try {
    caseId = JSON.parse(await readFile(stateFile(id), "utf-8")).caseId;
  } catch {
    /* state 없음 */
  }
  return { docs: listArtifacts(id), caseId };
});

// 산출물 개별 파일(.md) 내용 — 제안서 외 문서 뷰어용.
app.get("/api/workspaces/:id/file", async (req, reply) => {
  const id = safeId((req.params as Record<string, string>).id);
  const name = (req.query as Record<string, string>).name;
  if (!name) {
    reply.code(400);
    return { error: "name_required" };
  }
  try {
    return { name, markdown: await readFile(workspaceFile(id, name), "utf-8") };
  } catch {
    reply.code(404);
    return { error: "not_found", name };
  }
});

// 통신(메일 분류·회의록) 조회: save_comms 가 쓴 workspace/<id>/comms.json. 없으면 빈 목록.
app.get("/api/workspaces/:id/comms", async (req, reply) => {
  const id = safeId((req.params as Record<string, string>).id);
  try {
    return JSON.parse(await readFile(commsFile(id), "utf-8"));
  } catch {
    reply.code(404);
    return { comms: [] };
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
  console.log(`[ws] connected ws=${wsId}`);
  handleConnection(socket, wsId);
});

await app.listen({ port: PORT, host: HOST });
console.log(`backend up: http://${HOST}:${PORT}  (ws /ws?ws=<id>)`);
