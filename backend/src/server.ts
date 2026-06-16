// 얇은 Fastify + WebSocket 서버 (B2). 실제 Pi 세션 → F1 계약 이벤트로 변환해 WS로 흘린다.
// 연결 1개 = 워크스페이스 1개 = Pi 세션 1개 (PLAN 불변 원칙).

import Fastify from "fastify";
import websocket from "@fastify/websocket";
import type { WebSocket } from "@fastify/websocket";
import { createAgentSession } from "@earendil-works/pi-coding-agent";
import { getModel } from "@earendil-works/pi-ai";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { MODEL_CHAINS, getModelDef } from "./models.ts";
import type { AgentEvent, ClientMessage } from "./contract.ts";

const PORT = Number(process.env.PORT ?? 8787);
const WORKSPACE_ROOT = join(process.cwd(), "..", "workspace");

const app = Fastify({ logger: false });
await app.register(websocket);

app.get("/health", async () => ({ ok: true }));

// OpenRouter 체인에서 (지금 호출 가능한) 첫 모델을 고른다. claude-sdk는 Pi 직접 세션엔 안 씀(별도 경로).
function pickOpenRouterModel() {
  const chain = MODEL_CHAINS.default;
  const name = chain.find((n) => getModelDef(n).provider === "openrouter") ?? chain[0];
  return getModelDef(name);
}

app.get("/ws", { websocket: true }, (socket: WebSocket, req) => {
  const send = (e: AgentEvent) => socket.send(JSON.stringify(e));
  const wsId = (req.query as { ws?: string })?.ws ?? "demo";
  const cwd = join(WORKSPACE_ROOT, wsId);
  mkdirSync(cwd, { recursive: true });

  // 세션은 첫 prompt 때 생성해 재사용(멀티턴 컨텍스트 유지).
  let session: Awaited<ReturnType<typeof createAgentSession>>["session"] | null = null;

  async function ensureSession() {
    if (session) return session;
    const def = pickOpenRouterModel();
    send({ type: "model_current", name: def.name });
    const result = await createAgentSession({
      cwd,
      model: getModel("openrouter", def.ref),
      // 보안: 내장 도구(bash·read·write·edit·ls 등)를 전부 끈다. cwd만으론 bash가
      // 상위로 올라가 레포·.env를 읽을 수 있어 격리가 안 됨. 지금은 텍스트 전용.
      // B3에서 우리 Extension만 tools allowlist로 열고 noTools:"builtin" 유지.
      noTools: "all",
    });
    session = result.session;

    // Pi subscribe → F1 계약 변환 (PI_INTEGRATION §8 매핑).
    session.subscribe((event: any) => {
      if (
        event?.type === "message_update" &&
        event.assistantMessageEvent?.type === "text_delta"
      ) {
        send({ type: "text_delta", delta: event.assistantMessageEvent.delta ?? "" });
      }
      // 도구 이벤트(tool_start/tool_end) 매핑은 B3(커스텀 도구)에서 도구 런으로 확정.
    });
    return session;
  }

  socket.on("message", async (raw: Buffer) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      send({ type: "error", message: "잘못된 메시지 형식" });
      return;
    }

    try {
      if (msg.kind === "prompt") {
        const s = await ensureSession();
        await s.prompt(msg.text); // await 반환 = 턴 완료
        send({ type: "done" });
      } else if (msg.kind === "abort") {
        await session?.abort();
        send({ type: "done" });
      } else if (msg.kind === "answer") {
        // 되묻기 응답: B3에서 ExtensionUIContext(ui.select/confirm) 브리지로 배선.
      }
    } catch (e) {
      send({ type: "error", message: e instanceof Error ? e.message : "실행 오류" });
    }
  });
});

app
  .listen({ port: PORT, host: "127.0.0.1" })
  .then(() => console.log(`backend listening on ws://127.0.0.1:${PORT}/ws (Pi)`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
