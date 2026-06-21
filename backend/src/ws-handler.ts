// ws-handler.ts — 교환원. 한 WS 연결 = pi-session + bridge 를 엮는 글루.
// 양쪽 메시지를 bridge로 통역해 흘려보내기만. 로직은 안 가짐.
import type { WebSocket } from "@fastify/websocket";
import { REPO_ROOT, SMOKE } from "./config.ts";
import type { ClientCommand } from "./contract.ts";
import { contractToRpc, rpcToContract } from "./bridge.ts";
import { PiSession } from "./pi-session.ts";
import type { PendingUi } from "./rpc.ts";
import { sessionId } from "./workspace.ts";

/** 연결 하나를 처리: 워크스페이스용 pi 세션을 열고 socket ↔ bridge ↔ session 연결. */
export function handleConnection(socket: WebSocket, wsId: string): void {
  // ⚠️ TODO(격리): 원래 cwd=workspaceCwd(wsId) 로 행사별 폴더 격리해야 하나,
  // pi 는 cwd/.pi 만 봐서 레포 루트의 .pi(뇌)를 못 찾음. 임시로 REPO_ROOT 에서 띄움(파일 격리 X).
  // 해결책: 공유 agentDir 지정(PI_CODING_AGENT_DIR) + AGENTS.md 경로 처리. 대화는 sessionId 로 분리됨.
  const session = new PiSession({ cwd: REPO_ROOT, sessionId: sessionId(wsId), smoke: SMOKE });
  let pending: PendingUi | null = null;

  // pi → (통역) → 브라우저
  session.onEvent((ev) => {
    console.log(`[pi:${wsId}]`, ev.type); // 터미널 tee(관찰)
    const out = rpcToContract(ev, (p) => (pending = p));
    if (out && socket.readyState === socket.OPEN) socket.send(JSON.stringify(out));
  });
  session.onExit(() => {
    if (socket.readyState === socket.OPEN) socket.close();
  });

  // 브라우저 → (통역) → pi
  socket.on("message", (raw: { toString(): string }) => {
    let msg: ClientCommand;
    try {
      msg = JSON.parse(raw.toString()) as ClientCommand;
    } catch {
      return;
    }
    const cmd = contractToRpc(msg, pending);
    if (cmd) session.send(cmd);
  });

  socket.on("close", () => {
    console.log(`[ws] closed ws=${wsId}`);
    session.close();
  });
}
