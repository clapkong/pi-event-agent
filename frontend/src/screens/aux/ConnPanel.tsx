import { useState } from "react";
import { CONNECTIONS, type ConnStatus } from "@/data/aux";
import styles from "./aux.module.css";

const STATUS: Record<ConnStatus, { cls: string; label: string }> = {
  connected: { cls: styles.sConnected, label: "연결됨" },
  off: { cls: styles.sOff, label: "꺼짐" },
  reconnect: { cls: styles.sReconnect, label: "재연결" },
};

// S7 연결 상태 패널 (DESIGN §9.27). 사이드바 "연결됨 N/M" → 팝오버. 현재 모델 표시.
export function ConnPanel() {
  const [open, setOpen] = useState(false);
  const connected = CONNECTIONS.filter((c) => c.status === "connected").length;

  return (
    <div className={styles.wrap}>
      <button className={styles.trigger} onClick={() => setOpen((v) => !v)}>
        <span className={styles.dot} aria-hidden />
        연결됨 <span className="mono">{connected}/{CONNECTIONS.length}</span>
      </button>

      {open && (
        <>
          <div className={styles.backdrop} onClick={() => setOpen(false)} />
          <div className={styles.panel} role="dialog" aria-label="연결 상태">
            <p className={styles.panelTitle}>연결 상태</p>
            {CONNECTIONS.map((c) => (
              <div key={c.name} className={styles.row}>
                <span className={`${styles.rowDot} ${STATUS[c.status].cls}`} aria-hidden />
                <span className={styles.rowName}>
                  {c.name}
                  {c.kind === "MCP" && <span className={styles.etMcp}>MCP</span>}
                </span>
                <span className={styles.rowSub}>{c.sub}</span>
                <span className={`${styles.rowStatus} ${STATUS[c.status].cls}`}>
                  {STATUS[c.status].label}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
