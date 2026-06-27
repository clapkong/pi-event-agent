// pi-session.ts — pi --mode rpc 자식 프로세스 1개를 소유. "pi랑 통신하는 법"만 책임.
// 프런트/contract 는 모름. spawn·send(명령)·onEvent(콜백)·close(정리).
import { spawn, type ChildProcess } from "node:child_process";
import { PI_BASE_ARGS, PI_BIN } from "./config.ts";
import type { RpcCommand, RpcEvent } from "./rpc.ts";

export interface PiSessionOptions {
  cwd: string;
  sessionId: string;
}

export class PiSession {
  private readonly child: ChildProcess;
  private buf = "";
  private readonly onEventCbs = new Set<(ev: RpcEvent) => void>();
  private readonly onExitCbs = new Set<(code: number | null) => void>();

  constructor(opts: PiSessionOptions) {
    // --approve: 프로젝트-로컬 파일(.pi 확장·skill)을 이 런에서 신뢰 → 새 환경(컨테이너 등 trust.json 없는 곳)에서도
    //            event-tools 등 우리 확장이 로드된다. 호스트는 이미 신뢰돼 있어 무해(idempotent).
    // --session-id: 영속 세션 → 재접속 시 resume.
    const args: string[] = [...PI_BASE_ARGS, "--approve", "--session-id", opts.sessionId];

    this.child = spawn(PI_BIN, args, { cwd: opts.cwd, stdio: ["pipe", "pipe", "pipe"] });

    // stdout = JSONL. LF 로만 split (readline 금지 — U+2028/2029 비호환).
    this.child.stdout?.on("data", (chunk: Buffer) => {
      this.buf += chunk.toString();
      let nl: number;
      while ((nl = this.buf.indexOf("\n")) >= 0) {
        const line = this.buf.slice(0, nl).replace(/\r$/, "");
        this.buf = this.buf.slice(nl + 1);
        if (!line) continue;
        let ev: RpcEvent;
        try {
          ev = JSON.parse(line) as RpcEvent;
        } catch {
          continue;
        }
        for (const cb of this.onEventCbs) cb(ev);
      }
    });

    this.child.stderr?.on("data", (d: Buffer) => process.stderr.write(`[pi-stderr] ${d}`));
    this.child.on("exit", (code) => {
      for (const cb of this.onExitCbs) cb(code);
    });
  }

  /** pi 에 명령 전송 (stdin JSON 한 줄). */
  send(cmd: RpcCommand): void {
    if (this.child.stdin?.writable) this.child.stdin.write(`${JSON.stringify(cmd)}\n`);
  }

  /** rpc 이벤트 구독. 해제 함수 반환. */
  onEvent(cb: (ev: RpcEvent) => void): () => void {
    this.onEventCbs.add(cb);
    return () => this.onEventCbs.delete(cb);
  }

  /** 프로세스 종료 알림 구독. */
  onExit(cb: (code: number | null) => void): () => void {
    this.onExitCbs.add(cb);
    return () => this.onExitCbs.delete(cb);
  }

  /** 프로세스가 아직 살아있는가(재부착 가능 여부 판정용). */
  get alive(): boolean {
    return this.child.exitCode === null && !this.child.killed;
  }

  /** 종료(자식 kill). */
  close(): void {
    this.child.kill("SIGTERM");
  }
}
