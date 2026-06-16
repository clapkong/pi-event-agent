import type { ModelToast as Toast } from "@/agent/useAgentRun";
import styles from "./s3.module.css";

// 모델 전환 토스트 (SCREENS S3 · ARCHITECTURE §3): "○○ 한도 → ○○로 전환".
export function ModelToast({ toast }: { toast: Toast }) {
  return (
    <div className={styles.toast} role="status">
      <span className={styles.toastSwap} aria-hidden>
        ⇄
      </span>
      <div>
        <p className={styles.toastTitle}>
          {toast.from ? `${toast.from} → ` : ""}
          <strong>{toast.to}</strong>로 전환
        </p>
        <p className={styles.toastReason}>{toast.reason}</p>
      </div>
    </div>
  );
}
