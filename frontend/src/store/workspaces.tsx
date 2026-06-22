import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { type Workspace, type WorkspaceStatus } from "@/data/workspaces";

// 워크스페이스 store (F3). 새 행사 생성/목록을 공유한다.
// 데이터: 백엔드 REST(GET/POST /api/workspaces ← workspace/<id>/meta.json). mock seed 없음.

const API_BASE = "http://127.0.0.1:8787";

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
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  // 마운트 시 백엔드 목록 로드(없거나 실패면 빈 목록).
  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/api/workspaces`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Workspace[]) => {
        if (alive && Array.isArray(list)) setWorkspaces(list);
      })
      .catch(() => {
        /* 백엔드 미기동 → 빈 목록 유지 */
      });
    return () => {
      alive = false;
    };
  }, []);

  const store = useMemo<WorkspaceStore>(
    () => ({
      workspaces,
      byStatus: (...s) => workspaces.filter((w) => s.includes(w.status)),
      get: (id) => workspaces.find((w) => w.id === id),
      add: ({ name, summary }) => {
        // 프런트가 id 생성 → 낙관적 추가 + POST로 영속(백엔드가 같은 id로 meta.json 기록).
        const ws: Workspace = {
          id: `w-${Date.now().toString(36)}`,
          name: name.trim() || "새 행사",
          status: "planning",
          summary: summary.trim() || "조건 미정",
          progress: 0,
        };
        setWorkspaces((prev) => [ws, ...prev]);
        void fetch(`${API_BASE}/api/workspaces`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(ws),
        }).catch(() => {
          /* 영속 실패는 무시(다음 로드 때 사라짐) — 데모용 */
        });
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
