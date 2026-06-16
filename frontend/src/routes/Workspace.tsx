import { useParams } from "react-router-dom";
import { MOCK_WORKSPACES } from "@/data/workspaces";
import { S3View } from "@/screens/workspace/S3View";
import styles from "./Page.module.css";

// 워크스페이스 = 행사 1개. F2: S3 대화·동작 타임라인을 mock 으로 구동.
export function Workspace() {
  const { id } = useParams();
  const ws = MOCK_WORKSPACES.find((w) => w.id === id);

  if (!ws) {
    return (
      <div className={styles.page}>
        <p className={styles.eyebrow}>워크스페이스</p>
        <h1 className={styles.display}>행사를 찾을 수 없어요</h1>
        <p className={styles.lead}>
          <code className="mono">{id}</code> 에 해당하는 행사가 없습니다.
        </p>
      </div>
    );
  }

  // key={ws.id}: 행사 전환 시 S3 상태(타임라인·세션)를 초기화한다.
  return <S3View key={ws.id} ws={ws} />;
}
