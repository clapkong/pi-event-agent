import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  SEED_WORKSPACES,
  type Workspace,
  type WorkspaceStatus,
} from "@/data/workspaces";

// 워크스페이스 store (F3). 새 행사 생성/목록을 공유한다.
// ⚠️ mock — Phase B에서 백엔드/영속 스토어로 교체 (CLAUDE.md). F4가 상태 모델로 확장.

interface NewWorkspaceInput {
  name: string;
  summary: string;
}

interface WorkspaceStore {
  workspaces: Workspace[];
  byStatus: (...s: WorkspaceStatus[]) => Workspace[];
  get: (id: string) => Workspace | undefined;
  add: (input: NewWorkspaceInput) => Workspace;
}

const Ctx = createContext<WorkspaceStore | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(SEED_WORKSPACES);

  const store = useMemo<WorkspaceStore>(
    () => ({
      workspaces,
      byStatus: (...s) => workspaces.filter((w) => s.includes(w.status)),
      get: (id) => workspaces.find((w) => w.id === id),
      add: ({ name, summary }) => {
        const ws: Workspace = {
          id: `w-${Date.now().toString(36)}`,
          name: name.trim() || "새 행사",
          status: "planning",
          summary: summary.trim() || "조건 미정",
          progress: 0,
        };
        setWorkspaces((prev) => [ws, ...prev]);
        return ws;
      },
    }),
    [workspaces]
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useWorkspaces() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWorkspaces must be used within WorkspaceProvider");
  return ctx;
}
