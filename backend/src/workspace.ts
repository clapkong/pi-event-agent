// workspace.ts — 행사 1개 = 워크스페이스 1개 = cwd 1개 = pi 세션 1개.
// id → 작업폴더·세션ID 매핑, 폴더 보장. (나중: 목록·state.json)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./config.ts";

/** 안전한 id (경로 주입 방지). */
export function safeId(raw: string): string {
  return (raw || "demo").replace(/[^a-zA-Z0-9_-]/g, "") || "demo";
}

/** 행사 작업폴더 (pi 의 cwd). 없으면 생성. */
export function workspaceCwd(id: string): string {
  const cwd = join(REPO_ROOT, "workspace", safeId(id));
  mkdirSync(cwd, { recursive: true });
  return cwd;
}

/** 행사 보드 상태파일 경로 (update_state 가 쓰는 곳). 읽기용 — 폴더 생성 안 함. */
export function stateFile(id: string): string {
  return join(REPO_ROOT, "workspace", safeId(id), "state.json");
}

/** 워크스페이스별 고정 pi 세션 ID (resume 용 — 재접속 시 이 대화 이어감). */
export function sessionId(id: string): string {
  return `ws-${safeId(id)}`;
}
