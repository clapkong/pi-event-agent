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
import { estimateBudget } from "./tools/estimateBudget.ts";
import type { AgentEvent, ClientMessage, ElementType } from "./contract.ts";

const PORT = Number(process.env.PORT ?? 8787);
const WORKSPACE_ROOT = join(process.cwd(), "..", "workspace");

// 등록한 커스텀 도구. 타임라인 라벨·요소 마커 매핑.
const TOOLS = [estimateBudget];
const TOOL_META: Record<string, { label: string; element: ElementType }> = {
  estimate_budget: { label: "예산 산정", element: "Extension" },
};

// 도구 결과(JSON)를 타임라인용 한 줄 요약으로.
function summarizeTool(toolName: string, result: unknown): string {
  try {
    // AgentToolResult: { content: [{type:"text",text}], details }
    const r = result as { details?: any; content?: { type: string; text?: string }[] };
    const d = r?.details ?? JSON.parse(r?.content?.find((c) => c.type === "text")?.text ?? "{}");
    if (toolName === "estimate_budget" && d?.items) {
      const man = (n: number) => `${Math.round(n / 10000).toLocaleString("ko-KR")}만`;
      return `총 ${man(d.totalBudget)}원 → ${d.items.length}개 항목 배분 · 1인 ${Math.round(d.perPerson).toLocaleString("ko-KR")}원`;
    }
    return (r?.content?.find((c) => c.type === "text")?.text ?? "완료").slice(0, 140);
  } catch {
    return "완료";
  }
}

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
      // def.ref는 레지스트리에서 검증된 슬러그(런타임 OK). getModel은 리터럴 유니온을 요구해 any 캐스팅.
      model: getModel("openrouter", def.ref as never),
      customTools: TOOLS, // 우리 Extension(estimate_budget 등)
      tools: TOOLS.map((t) => t.name), // allowlist: 우리 도구만 — 내장 bash/fs 차단(보안)
    });
    session = result.session;

    // Pi subscribe → F1 계약 변환 (PI_INTEGRATION §8 매핑).
    session.subscribe((event: any) => {
      if (
        event?.type === "message_update" &&
        event.assistantMessageEvent?.type === "text_delta"
      ) {
        send({ type: "text_delta", delta: event.assistantMessageEvent.delta ?? "" });
      } else if (event?.type === "tool_execution_start") {
        const m = TOOL_META[event.toolName] ?? {
          label: event.toolName,
          element: "Extension" as ElementType,
        };
        send({ type: "tool_start", label: m.label, tool: event.toolName, element: m.element });
      } else if (event?.type === "tool_execution_end") {
        send({ type: "tool_end", result: summarizeTool(event.toolName, event.result) });
      }
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
