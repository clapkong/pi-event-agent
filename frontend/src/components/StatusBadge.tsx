import { STATUS_BADGE, STATUS_LABEL, type WorkspaceStatus } from "@/data/workspaces";
import styles from "./StatusBadge.module.css";

// 상태 뱃지 (DESIGN §9.1) — 연배경 + 진글씨 + 선행 점. 전 화면 공용.
const VARIANT = {
  progress: styles.progress,
  done: styles.done,
  late: styles.late,
} as const;

export function StatusBadge({ status }: { status: WorkspaceStatus }) {
  return (
    <span className={`${styles.badge} ${VARIANT[STATUS_BADGE[status]]}`}>
      <span className={styles.dot} aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}
