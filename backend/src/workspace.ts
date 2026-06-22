// workspace.ts — 행사 1개 = 워크스페이스 1개 = cwd 1개 = pi 세션 1개.
// 파일은 행사당 하나: workspace/<id>/state.json (보드 + 이름). 목록 타일은 거기서 파생.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./config.ts";

/** 안전한 id (경로 주입 방지). */
export function safeId(raw: string): string {
  return (raw || "demo").replace(/[^a-zA-Z0-9_-]/g, "") || "demo";
}

const WORKSPACES_ROOT = join(REPO_ROOT, "workspace");

/** 행사 보드 상태파일 (update_state·생성이 쓰는 단일 파일). */
export function stateFile(id: string): string {
  return join(WORKSPACES_ROOT, safeId(id), "state.json");
}

/** 행사 제안서(결과 리포트) 파일 (save_report 가 씀). */
export function proposalFile(id: string): string {
  return join(WORKSPACES_ROOT, safeId(id), "proposal.md");
}

/** 행사 통신(메일 분류·회의록) 파일 (save_comms 가 씀). */
export function commsFile(id: string): string {
  return join(WORKSPACES_ROOT, safeId(id), "comms.json");
}

/** 워크스페이스 폴더의 문서(.md) 산출물 목록 (proposal·체크리스트·가이드 등). */
export function listArtifacts(id: string): string[] {
  try {
    return readdirSync(join(WORKSPACES_ROOT, safeId(id)))
      .filter((f) => f.endsWith(".md"))
      .sort();
  } catch {
    return [];
  }
}

/** 파일명 안전화(경로 탈출 차단) — 한글 파일명 허용. */
function safeName(name: string): string {
  const base = (name || "").replace(/[/\\]/g, "").replace(/\.\./g, "");
  return base.endsWith(".md") ? base : `${base}.md`;
}

/** 워크스페이스 내 특정 산출물 파일 경로. */
export function workspaceFile(id: string, name: string): string {
  return join(WORKSPACES_ROOT, safeId(id), safeName(name));
}

/** 행사 작업폴더 (pi 의 cwd 후보). 없으면 생성. */
export function workspaceCwd(id: string): string {
  const cwd = join(WORKSPACES_ROOT, safeId(id));
  mkdirSync(cwd, { recursive: true });
  return cwd;
}

/** 워크스페이스별 고정 pi 세션 ID (resume 용 — 재접속 시 이 대화 이어감). */
export function sessionId(id: string): string {
  return `ws-${safeId(id)}`;
}

// ── 목록 타일 (프런트 Workspace 모양) — state.json 에서 파생 ──────────
export interface WorkspaceTile {
  id: string;
  name: string;
  status: "planning" | "active" | "done" | "late";
  summary: string;
  progress: number;
}

const STATUS_BY_STAGE: Record<string, WorkspaceTile["status"]> = {
  기획: "planning",
  진행중: "active",
  "정산·완료": "done",
};

interface StoredState {
  name?: string;
  summary?: string; // 생성 시 입력한 브리프(조건 채워지면 파생 요약이 우선)
  createdAt?: number;
  stage?: string;
  budgetTotal?: number;
  conditions?: { key?: string; label?: string; value?: string }[];
  milestones?: { due?: string; status?: string }[];
}

const man = (n: number) => `${Math.round(n / 10000).toLocaleString("ko-KR")}만원`;

/** state.json 한 건 → 목록 타일. status·summary·progress 는 보드에서 파생. */
function deriveTile(id: string, s: StoredState): WorkspaceTile {
  const conds = Array.isArray(s.conditions) ? s.conditions : [];
  const cond = (test: (c: NonNullable<StoredState["conditions"]>[number]) => boolean) =>
    conds.find(test)?.value;
  const type = cond((c) => c.key === "eventType" || !!c.label?.includes("유형"));
  const head = cond((c) => c.key === "headcount" || !!c.label?.includes("인원"));

  // status: stage 기준 + 마감 지난 미완료 마일스톤 있으면 late.
  let status = STATUS_BY_STAGE[s.stage ?? "기획"] ?? "planning";
  const ms = Array.isArray(s.milestones) ? s.milestones : [];
  if (status !== "done") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdue = ms.some(
      (m) => m.status !== "done" && m.due && new Date(`${m.due}T00:00:00`) < today
    );
    if (overdue) status = "late";
  }

  // summary: 유형·인원·예산 파생. 조건이 없으면 생성 브리프 → "조건 미정".
  const derived = [type, head, s.budgetTotal ? man(s.budgetTotal) : null].filter(Boolean).join(" · ");
  const summary = derived || s.summary?.trim() || "조건 미정";

  // progress: 마일스톤 완료 비율, 없으면 stage 기준 대략.
  const progress =
    ms.length > 0
      ? Math.round((ms.filter((m) => m.status === "done").length / ms.length) * 100)
      : status === "done"
        ? 100
        : status === "planning"
          ? 10
          : 55;

  return { id, name: s.name?.trim() || type || id, status, summary, progress };
}

/** 모든 워크스페이스 목록(최신순). state.json 있는 폴더 = 행사. */
export function listWorkspaces(): WorkspaceTile[] {
  let dirs: string[];
  try {
    dirs = readdirSync(WORKSPACES_ROOT, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return []; // workspace/ 없음
  }
  const rows: { tile: WorkspaceTile; createdAt: number }[] = [];
  for (const id of dirs) {
    try {
      const s = JSON.parse(readFileSync(join(WORKSPACES_ROOT, id, "state.json"), "utf-8")) as StoredState;
      rows.push({ tile: deriveTile(id, s), createdAt: s.createdAt ?? 0 });
    } catch {
      /* state.json 없는 폴더 skip */
    }
  }
  return rows.sort((a, b) => b.createdAt - a.createdAt).map((r) => r.tile);
}

/** 빈 보드 + 행사 식별(name). 생성 시 state.json 초기값. update_state 가 보드 필드를 병합·보존. */
function initialState(name: string, summary: string): StoredState & Record<string, unknown> {
  return {
    name,
    summary,
    createdAt: Date.now(),
    stage: "기획",
    budgetTotal: 0,
    proposalVersion: 1,
    conditions: [],
    budget: [],
    vendors: [],
    weather: { label: "", temp: "", pop: 0, stale: false },
    venue: { name: "", note: "" },
    milestones: [],
    replan: null,
  };
}

/** 워크스페이스 생성: 폴더 + 초기 state.json(이름 포함). id 미지정이면 생성. */
export function createWorkspace(input: { id?: string; name: string; summary?: string }): WorkspaceTile {
  const id = safeId(input.id || `w-${Date.now().toString(36)}`);
  const s = initialState(input.name.trim() || "새 행사", input.summary?.trim() || "");
  mkdirSync(join(WORKSPACES_ROOT, id), { recursive: true });
  writeFileSync(stateFile(id), `${JSON.stringify(s, null, 2)}\n`, "utf-8");
  return deriveTile(id, s);
}
