import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import styles from "./AppShell.module.css";

// 앱 프레임: 캔버스 위에 흰 프레임, 좌측 사이드바 + 우측 콘텐츠 (DESIGN §4·§5).
export function AppShell() {
  return (
    <div className={styles.canvas}>
      <div className={styles.frame}>
        <Sidebar />
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
