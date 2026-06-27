// ws-handler.ts — 교환원. 한 워크스페이스 = pi-session 1개를 소유하고 socket ↔ bridge ↔ session 연결.
// ⭐ 런 유지: WS가 끊겨도(패널 이동·새로고침·네트워크 blip) pi 를 즉시 죽이지 않는다.
//    세션을 레지스트리에 살려두고, grace 안에 재연결하면 소켓만 갈아끼워 **재부착**(reattach).
//    grace 동안 재연결 없으면 그때 정리. → 작업공간 내 어느 탭을 가도 런은 계속 돈다.
import type { WebSocket } from "@fastify/websocket";
import { REPO_ROOT } from "./config.ts";
import type { ClientCommand } from "./contract.ts";
import { contractToRpc, rpcToContract } from "./bridge.ts";
import { PiSession } from "./pi-session.ts";
import type { PendingUi } from "./rpc.ts";
import { watchSubagents } from "./subagent-tail.ts";
import { sessionId } from "./workspace.ts";

interface SessionEntry {
  session: PiSession;
  socket: WebSocket; // 현재 붙은 소켓(재부착 시 갈아끼움)
  pending: PendingUi | null; // ask/gate 대기 상태 — 재연결에도 보존
  stopTail: () => void;
  grace?: ReturnType<typeof setTimeout>;
}

// 워크스페이스별 살아있는 세션. WS가 끊겨도 여기 남아 런이 유지된다.
const sessions = new Map<string, SessionEntry>();
const GRACE_MS = 90_000; // 끊긴 뒤 이 시간 안에 재연결 없으면 세션 종료

export function handleConnection(socket: WebSocket, wsId: string): void {
  let entry = sessions.get(wsId);

  if (entry?.session.alive) {
    // ── 재부착: pi 는 그대로 돌고, 소켓만 새 것으로 교체 ──
    if (entry.grace) {
      clearTimeout(entry.grace);
      entry.grace = undefined;
    }
    entry.socket = socket;
    console.log(`[ws] reattached ws=${wsId} (런 유지)`);
  } else {
    // ── 새 세션 생성 ──
    if (entry) sessions.delete(wsId); // 죽은 잔여 정리
    // cwd=REPO_ROOT: pi 는 cwd/.pi 만 보고 상위로 안 올라가므로 뇌(.pi·AGENTS.md)가 있는 레포 루트에서.
    // 대화는 sessionId(`ws-<wsId>`)로 분리, 보드 state.json 은 event-tools 가 그 id 로 행사 식별해 씀.
    const session = new PiSession({ cwd: REPO_ROOT, sessionId: sessionId(wsId) });
    const e: SessionEntry = { session, socket, pending: null, stopTail: () => {} };
    sessions.set(wsId, e);
    entry = e;

    // pi → (통역) → 현재 소켓 (e.socket 은 재부착 시 갱신됨)
    session.onEvent((ev) => {
      console.log(`[pi:${wsId}]`, ev.type);
      const out = rpcToContract(ev, (p) => {
        e.pending = p;
      });
      if (out && e.socket.readyState === e.socket.OPEN) e.socket.send(JSON.stringify(out));
    });
    session.onExit(() => {
      if (e.socket.readyState === e.socket.OPEN) e.socket.close();
      e.stopTail();
      sessions.delete(wsId);
    });
    // 서브에이전트 내부 출력(.output) tail → 현재 소켓으로.
    e.stopTail = watchSubagents(REPO_ROOT, sessionId(wsId), (agentId, delta) => {
      if (e.socket.readyState === e.socket.OPEN)
        e.socket.send(JSON.stringify({ type: "subagent_delta", agentId, delta }));
    });
  }

  const cur = entry;

  // 브라우저 → (통역) → pi
  socket.on("message", (raw: { toString(): string }) => {
    let msg: ClientCommand;
    try {
      msg = JSON.parse(raw.toString()) as ClientCommand;
    } catch {
      return;
    }
    const cmd = contractToRpc(msg, cur.pending);
    if (cmd) cur.session.send(cmd);
  });

  socket.on("close", () => {
    // ⭐ 끊겨도 pi 안 죽임 — grace 동안 재연결 대기(재부착이면 위에서 타이머 취소).
    console.log(`[ws] closed ws=${wsId} — grace ${GRACE_MS / 1000}s 대기(런 유지)`);
    cur.grace = setTimeout(() => {
      console.log(`[ws] grace 만료 ws=${wsId} → 세션 종료`);
      cur.stopTail();
      cur.session.close();
      sessions.delete(wsId);
    }, GRACE_MS);
  });
}
