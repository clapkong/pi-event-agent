import { useNavigate } from "react-router-dom";
import { STATUS_DOT, type Workspace } from "@/data/workspaces";
import { StatusBadge } from "@/components/StatusBadge";
import styles from "./home.module.css";

// 워크스페이스 타일 (DESIGN §9.8). 클릭 → 워크스페이스(S4 예정, 현재 S3).
export function WorkspaceTile({ ws }: { ws: Workspace }) {
  const navigate = useNavigate();
  return (
    <button type="button" className={styles.tile} onClick={() => navigate(`/w/${ws.id}/board`)}>
      <div className={styles.tileHead}>
        <span
          className={styles.tileDot}
          style={{ background: STATUS_DOT[ws.status] }}
          aria-hidden
        />
        <span className={styles.tileName}>{ws.name}</span>
        <StatusBadge status={ws.status} />
      </div>
      <p className={styles.tileSummary}>{ws.summary}</p>
      <div className={styles.meter}>
        <div className={styles.meterTrack}>
          <div className={styles.meterFill} style={{ width: `${ws.progress}%` }} />
        </div>
        <span className={styles.meterPct}>{ws.progress}%</span>
      </div>
    </button>
  );
}
