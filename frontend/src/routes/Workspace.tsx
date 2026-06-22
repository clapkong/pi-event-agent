import { Navigate, useParams } from "react-router-dom";
import { useWorkspaces } from "@/store/workspaces";
import { S3View } from "@/screens/workspace/S3View";
import styles from "./Page.module.css";

// 이 워크스페이스에 화면용 타임라인 캐시(localStorage)가 있나 — useAgentRun 의 STORE_KEY 와 동일 규칙.
function hasTimeline(id: string): boolean {
  try {
    const parsed = JSON.parse(localStorage.getItem(`agentRun:${id}`) ?? "null");
    return Array.isArray(parsed?.entries) && parsed.entries.length > 0;
  } catch {
    return false;
  }
}

// AI 에이전트 패널 (워크스페이스 셸의 index). 런은 셸 컨텍스트에서 가져온다(autostart도 셸이 처리).
export function Workspace() {
  const { id } = useParams();
  const { get } = useWorkspaces();
  const ws = id ? get(id) : undefined;

  if (!ws) {
    return (
      <div className={styles.page}>
        <p className={styles.eyebrow}>워크스페이스</p>
        <h1 className={styles.display}>행사를 찾을 수 없어요</h1>
      </div>
    );
  }
  // 운영 단계(진행중/지연/완료)인데 AI 타임라인이 없으면(=시딩·다른 기기) 빈 AI 탭 대신 보드로.
  // 라이브로 돌린 워크스페이스는 타임라인이 있어 AI 탭 유지, 새 행사(planning)는 바로 기획 시작.
  if (id && !hasTimeline(id) && (ws.status === "active" || ws.status === "late" || ws.status === "done")) {
    return <Navigate to="board" replace />;
  }
  return <S3View />;
}
