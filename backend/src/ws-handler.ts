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
  // cwd=REPO_ROOT: pi 는 cwd/.pi 만 보고 상위로 안 올라가므로 뇌(.pi·AGENTS.md)가 있는
  // 레포 루트에서 띄운다. 대화는 sessionId(`ws-<wsId>`)로 분리되고, 보드 state.json 도
  // event-tools 가 그 sessionId 로 행사를 식별해 `workspace/<wsId>/state.json` 에 쓴다(cwd 안 건드림).
  // (proposal.md 등 다른 cwd-상대 산출물의 완전 격리는 후속.)
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
