import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MOCK_NOTIFS, NOTIF_GROUPS, type NotifKind } from "@/data/home";
import styles from "./home.module.css";

const KIND_CLASS: Record<NotifKind, string> = {
  review: styles.kindReview,
  approval: styles.kindApproval,
  deadline: styles.kindDeadline,
};

// 알림 센터 (DESIGN §9.26): 벨 + 카운트 + 그룹 패널.
export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const count = MOCK_NOTIFS.length;

  return (
    <div className={styles.notifWrap}>
      <button
        type="button"
        className={styles.bell}
        onClick={() => setOpen((v) => !v)}
        aria-label={`알림 ${count}건`}
      >
        <span aria-hidden>🔔</span>
        {count > 0 && <span className={styles.bellCount}>{count}</span>}
      </button>

      {open && (
        <>
          <div className={styles.notifBackdrop} onClick={() => setOpen(false)} />
          <div className={styles.notifPanel} role="dialog" aria-label="알림">
            {NOTIF_GROUPS.map((g) => {
              const items = MOCK_NOTIFS.filter((n) => n.kind === g.kind);
              if (items.length === 0) return null;
              return (
                <div key={g.kind} className={styles.notifGroup}>
                  <p className={`${styles.notifGroupLabel} ${KIND_CLASS[g.kind]}`}>
                    {g.label} <span className={styles.notifGroupCount}>{items.length}</span>
                  </p>
                  {items.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      className={styles.notifItem}
                      onClick={() => {
                        setOpen(false);
                        navigate(`/w/${n.wsId}`);
                      }}
                    >
                      <span className={styles.notifWs}>{n.wsName}</span>
                      <span className={styles.notifMsg}>{n.message}</span>
                      <span className={styles.notifWhen}>{n.when}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
