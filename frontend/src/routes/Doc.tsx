import { useParams } from "react-router-dom";
import { useWorkspaces } from "@/store/workspaces";
import { DocView } from "@/screens/doc/DocView";
import styles from "./Page.module.css";

// /w/:id/doc → S5 결과 문서.
export function Doc() {
  const { id } = useParams();
  const { get } = useWorkspaces();
  const ws = id ? get(id) : undefined;
  if (!ws) {
    return (
      <div className={styles.page}>
        <p className={styles.eyebrow}>문서</p>
        <h1 className={styles.display}>행사를 찾을 수 없어요</h1>
      </div>
    );
  }
  return <DocView key={ws.id} ws={ws} />;
}
