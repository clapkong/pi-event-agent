import { createContext, useContext } from "react";
import type { useAgentRun } from "./useAgentRun";

// 에이전트 런(=WS 연결)을 워크스페이스 셸이 소유하고, 패널(S3View 등)이 소비한다.
// 연결이 셸에 묶여 있어 패널(AI·작업공간·문서) 전환 시 끊기지 않는다.
type AgentRun = ReturnType<typeof useAgentRun>;

const Ctx = createContext<AgentRun | null>(null);
export const AgentRunProvider = Ctx.Provider;

export function useAgentRunCtx(): AgentRun {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAgentRunCtx must be used within WorkspaceShell");
  return ctx;
}
