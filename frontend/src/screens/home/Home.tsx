import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspaces } from "@/store/workspaces";
import { MOCK_CHECKLIST } from "@/data/home";
import { WorkspaceTile } from "./WorkspaceTile";
import { NotificationCenter } from "./NotificationCenter";
import { MiniCalendar } from "./MiniCalendar";
import styles from "./home.module.css";

// S1 홈 · 대시보드 (F3.2).
export function Home() {
  const { byStatus } = useWorkspaces();
  const navigate = useNavigate();

  // 진행 중 = 진행중(active)+지연(late) · 진행 예정 = 기획중(planning) · 완료 = done.
  // (중복·누락 방지: 각 워크스페이스는 정확히 한 버킷)
  const inProgress = byStatus("active", "late");
  const upcoming = byStatus("planning");
  const completed = byStatus("done");

  return (
    <div className={styles.home}>
      <header className={styles.header}>
        <h1 className={styles.title}>홈</h1>
        <span className={styles.headerActions}>
          <NotificationCenter />
          <button type="button" className={styles.newBtn} onClick={() => navigate("/new")}>
            <i className="ti ti-plus" aria-hidden /> 새 행사
          </button>
        </span>
      </header>

      {inProgress.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>아직 진행 중인 행사가 없어요</p>
          <button type="button" className={styles.newBtn} onClick={() => navigate("/new")}>
            <i className="ti ti-plus" aria-hidden /> 새 행사 만들기
          </button>
        </div>
      ) : (
        <>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>진행 중인 워크스페이스</h2>
            <div className={styles.tileGrid}>
              {inProgress.map((ws) => (
                <WorkspaceTile key={ws.id} ws={ws} />
              ))}
            </div>
          </section>

          <CollapsibleRow title="진행 예정" count={upcoming.length}>
            {upcoming.map((ws) => (
              <WorkspaceTile key={ws.id} ws={ws} />
            ))}
          </CollapsibleRow>

          <CollapsibleRow title="진행 완료" count={completed.length}>
            {completed.map((ws) => (
              <WorkspaceTile key={ws.id} ws={ws} />
            ))}
          </CollapsibleRow>

          <button
            type="button"
            className={styles.caseRow}
            onClick={() => navigate("/case/c-meetup-2024")}
          >
            <span className={styles.caseTitle}>과거 진행 사례 모음</span>
            <span className={styles.caseHint}>완료된 행사를 사례로 재사용 · S6 →</span>
          </button>

          <div className={styles.bottomGrid}>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>할 일 · 일정 달력</h2>
              <MiniCalendar />
            </section>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>할 일 체크리스트</h2>
              <ul className={styles.checklist}>
                {MOCK_CHECKLIST.map((c) => (
                  <li key={c.id} className={styles.checkRow}>
                    <input type="checkbox" defaultChecked={c.done} className={styles.check} />
                    <span className={styles.checkDate}>{c.date}</span>
                    <span className={styles.checkWs}>{c.wsName}</span>
                    <span className={c.done ? styles.checkTaskDone : styles.checkTask}>
                      {c.task}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

// 접히는 행 (진행 예정·완료) — 기본 접힘 (시안: toggle off).
function CollapsibleRow({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className={styles.collapse}>
      <button
        type="button"
        className={styles.collapseHead}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <i
          className={`ti ti-chevron-${open ? "down" : "right"} ${styles.collapseCaret}`}
          aria-hidden
        />
        {title}
        <span className={styles.collapseCount}>{count}</span>
      </button>
      {open && <div className={styles.tileGrid}>{children}</div>}
    </section>
  );
}
