import { useParams } from "react-router-dom";
import { useWorkspaces } from "@/store/workspaces";
import { S4View } from "@/screens/workspace/S4View";
import styles from "./Page.module.css";

// /w/:id/board → S4 작업공간 (상태 모델).
export function Board() {
  const { id } = useParams();
  const { get } = useWorkspaces();
  const ws = id ? get(id) : undefined;

  if (!ws) {
    return (
      <div className={styles.page}>
        <p className={styles.eyebrow}>작업공간</p>
        <h1 className={styles.display}>행사를 찾을 수 없어요</h1>
      </div>
    );
  }
  return <S4View key={ws.id} ws={ws} />;
}
