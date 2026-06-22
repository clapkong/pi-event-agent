import { useEffect, useState } from "react";
import { type Connection, type ConnStatus } from "@/data/aux";
import { API_BASE } from "@/config";
import styles from "./aux.module.css";

const STATUS: Record<ConnStatus, { cls: string; label: string }> = {
  configured: { cls: styles.sConnected, label: "구성됨" },
  off: { cls: styles.sOff, label: "미설정" },
};

// S7 연결 상태 패널 (DESIGN §9.27). 사이드바 "연결됨 N/M" → 팝오버.
// 실데이터: 백엔드 /api/connections(실제 .pi/settings.json·mcp.json 파생). 하드코딩 더미 없음.
export function ConnPanel() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Connection[]>([]);

  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/api/connections`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && Array.isArray(d?.items)) setItems(d.items);
      })
      .catch(() => {});
  }, []);

  const configured = items.filter((c) => c.status === "configured").length;

  return (
    <div className={styles.wrap}>
      <button className={styles.trigger} onClick={() => setOpen((v) => !v)}>
        <span className={styles.dot} aria-hidden />
        구성됨 <span className="mono">{configured}</span>
      </button>

      {open && (
        <>
          <div className={styles.backdrop} onClick={() => setOpen(false)} />
          <div className={styles.panel} role="dialog" aria-label="연결 상태">
            <p className={styles.panelTitle}>연결 구성 (.pi 설정 기준 · 실시간 연결 확인 아님)</p>
            {items.length === 0 && <p className={styles.rowSub}>백엔드 미연결 — 상태를 불러올 수 없어요.</p>}
            {items.map((c) => (
              <div key={c.name} className={styles.row}>
                <span className={`${styles.rowDot} ${STATUS[c.status].cls}`} aria-hidden />
                <span className={styles.rowName}>
                  {c.name}
                  {c.kind !== "LLM" && <span className={styles.etMcp}>{c.kind === "MCP" ? "MCP" : "Ext"}</span>}
                </span>
                <span className={styles.rowSub}>{c.sub}</span>
                <span className={`${styles.rowStatus} ${STATUS[c.status].cls}`}>{STATUS[c.status].label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
