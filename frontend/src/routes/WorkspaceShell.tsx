import { useEffect, useRef } from "react";
import { NavLink, Outlet, useLocation, useParams } from "react-router-dom";
import { useWorkspaces } from "@/store/workspaces";
import { useAgentRun } from "@/agent/useAgentRun";
import { AgentRunProvider } from "@/agent/AgentRunContext";
import { StatusBadge } from "@/components/StatusBadge";
import styles from "./Page.module.css";

// 워크스페이스 셸 — 한 행사 안의 패널(AI 에이전트 · 작업공간 · 문서)을 탭으로 전환.
// 에이전트 런(WS 연결)을 여기서 들고 있어, 패널을 바꿔도 연결·진행이 끊기지 않는다.
export function WorkspaceShell() {
  const { id } = useParams();
  // 행사 전환 시 셸을 통째 remount → 새 연결·타임라인 로드.
  return <ShellInner key={id ?? "?"} id={id ?? ""} />;
}

function ShellInner({ id }: { id: string }) {
  const { get } = useWorkspaces();
  const ws = get(id);
  const run = useAgentRun(id); // 연결은 셸 수명 동안 유지(패널 전환에도 안 죽음)
  const location = useLocation();
  const navState = location.state as { autostart?: boolean; prompt?: string } | null;

  // 폼(S2)에서 막 생성돼 들어온 경우에만 1회 자동 시작. 이미 대화가 있으면 무시(재주입 방지).
  const started = useRef(false);
  useEffect(() => {
    if (navState?.autostart && !started.current && run.state.entries.length === 0 && !run.state.running) {
      started.current = true;
      run.start(navState.prompt ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tab = ({ isActive }: { isActive: boolean }) => (isActive ? styles.tabOn : styles.tab);

  return (
    <AgentRunProvider value={run}>
      <div className={styles.wsShell}>
        {/* 한 줄 헤더: 행사명 + 상태 + 모델 + 패널 탭 */}
        <header className={styles.wsTopbar}>
          <h1 className={styles.wsName}>{ws?.name ?? id}</h1>
          {ws && <StatusBadge status={ws.status} />}
          <span className={styles.wsSpacer} />
          {run.state.model && (
            <span className={styles.wsModel} title="현재 모델">
              {run.state.model}
            </span>
          )}
          <nav className={styles.wsTabs}>
            <NavLink to={`/w/${id}`} end className={tab}>
              <i className="ti ti-message-2" aria-hidden /> AI 에이전트
            </NavLink>
            <NavLink to={`/w/${id}/board`} className={tab}>
              <i className="ti ti-layout-dashboard" aria-hidden /> 작업공간
            </NavLink>
            <NavLink to={`/w/${id}/doc`} className={tab}>
              <i className="ti ti-file-text" aria-hidden /> 문서
            </NavLink>
          </nav>
        </header>
        <div className={styles.wsPanel}>
          {ws ? <Outlet /> : <p className={styles.lead}>행사를 찾을 수 없어요.</p>}
        </div>
      </div>
    </AgentRunProvider>
  );
}
