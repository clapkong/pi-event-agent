import { useParams } from "react-router-dom";
import { MOCK_WORKSPACES, STATUS_DOT, STATUS_LABEL } from "@/data/workspaces";
import styles from "./Page.module.css";

// S3/S4 워크스페이스 — F0에선 빈 라우트(헤더만). 대화·타임라인은 F2, 작업공간은 F4.
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

  return (
    <div className={styles.page}>
      <div className={styles.wsHead}>
        <span
          className={styles.wsDot}
          style={{ background: STATUS_DOT[ws.status] }}
          aria-hidden
        />
        <h1 className={styles.h1}>{ws.name}</h1>
        <span className={styles.badge}>{STATUS_LABEL[ws.status]}</span>
      </div>
      <p className={styles.lead}>
        동작 타임라인과 컴포저는 <code className="mono">F2</code>, 작업공간·상태
        모델은 <code className="mono">F4</code>에서 채워집니다.
      </p>
    </div>
  );
}
