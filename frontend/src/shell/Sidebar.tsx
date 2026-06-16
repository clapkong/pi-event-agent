import { NavLink, useNavigate } from "react-router-dom";
import { STATUS_DOT } from "@/data/workspaces";
import { useWorkspaces } from "@/store/workspaces";
import styles from "./Sidebar.module.css";

// S0 전역 셸 사이드바 (DESIGN §9.5).
// 브랜드 마크 + 홈 + 행사 목록(상태 점) + ＋ 새 행사 + 연결 인디케이터.
export function Sidebar() {
  const navigate = useNavigate();
  const { workspaces } = useWorkspaces();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.brandMark} aria-hidden />
        <span className={styles.brandName}>행사 기획</span>
      </div>

      <nav className={styles.nav}>
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            isActive ? `${styles.item} ${styles.active}` : styles.item
          }
        >
          홈
        </NavLink>
      </nav>

      <div className={styles.sectionLabel}>행사</div>
      <nav className={styles.nav}>
        {workspaces.map((w) => (
          <NavLink
            key={w.id}
            to={`/w/${w.id}`}
            className={({ isActive }) =>
              isActive ? `${styles.item} ${styles.active}` : styles.item
            }
          >
            <span
              className={styles.dot}
              style={{ background: STATUS_DOT[w.status] }}
              aria-hidden
            />
            <span className={styles.itemLabel}>{w.name}</span>
          </NavLink>
        ))}
      </nav>

      <button
        type="button"
        className={styles.newBtn}
        onClick={() => navigate("/new")}
      >
        <span className={styles.plus} aria-hidden>
          ＋
        </span>
        새 행사
      </button>

      {/* 연결 인디케이터 (DESIGN §9.5) — F0에선 정적 표시 */}
      <div className={styles.conn} title="필수 5요소 중 연결됨">
        <span className={styles.connDot} aria-hidden />
        연결됨 <span className="mono">4/5</span>
      </div>
    </aside>
  );
}
