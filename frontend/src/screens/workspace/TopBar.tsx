import { STATUS_LABEL, type Workspace } from "@/data/workspaces";
import styles from "./s3.module.css";

interface Props {
  ws: Workspace;
  model: string | null;
}

// 상단 바 (DESIGN §9.6 / SCREENS S3): 이름 + 연필 + 상태 뱃지 + 현재 모델 뱃지 + 작업공간.
export function TopBar({ ws, model }: Props) {
  return (
    <header className={styles.top}>
      <h1 className={styles.wsName}>{ws.name}</h1>
      <button type="button" className={styles.pencil} title="이름 수정" aria-label="이름 수정">
        ✎
      </button>
      <span className={styles.statusBadge}>
        <span className={styles.statusDot} aria-hidden />
        {STATUS_LABEL[ws.status]}
      </span>

      <span className={styles.spacer} />

      <span className={styles.modelBadge} title="현재 모델">
        <span className={styles.modelDot} aria-hidden />
        {model ?? "모델 대기"}
      </span>
      <button type="button" className={styles.topAction} disabled title="작업공간 (F4)">
        작업공간
      </button>
    </header>
  );
}
