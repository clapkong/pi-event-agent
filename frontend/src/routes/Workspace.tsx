import { useParams } from "react-router-dom";
import { useWorkspaces } from "@/store/workspaces";
import { S3View } from "@/screens/workspace/S3View";
import styles from "./Page.module.css";

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
  return <S3View />;
}
