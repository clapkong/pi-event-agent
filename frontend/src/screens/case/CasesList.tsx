import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Case } from "@/data/cases";
import { API_BASE } from "@/config";
import styles from "./case.module.css";

const man = (n: number) => `${Math.round(n / 10000).toLocaleString("ko-KR")}만`;

// S6 사례 목록 — pi-local-rag가 인덱싱하는 cases/*.md 전체를 표로. 행 클릭 → 상세.
export function CasesList() {
  const nav = useNavigate();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/api/cases`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        setCases(Array.isArray(d?.cases) ? d.cases : []);
        setLoading(false);
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className={styles.screen}>
      <header className={styles.top}>
        <button className={styles.back} onClick={() => nav("/")} aria-label="홈">
          <i className="ti ti-arrow-left" aria-hidden />
        </button>
        <h1 className={styles.title}>과거 진행 사례</h1>
        <span className={styles.spacer} />
        <span className={styles.source}>pi-local-rag · cases/*.md</span>
      </header>

      <div className={styles.scroll}>
        {loading ? (
          <p className={styles.listNote}>불러오는 중…</p>
        ) : cases.length === 0 ? (
          <p className={styles.listNote}>아직 적립된 사례가 없어요. 행사를 완료하면 사례로 쌓입니다.</p>
        ) : (
          <table className={styles.caseTable}>
            <thead>
              <tr>
                <th>사례</th>
                <th>유형</th>
                <th className={styles.num}>인원</th>
                <th>장소</th>
                <th>일자</th>
                <th className={styles.num}>만족도</th>
                <th className={styles.num}>실집행</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => {
                const total = c.budgetActual.reduce((s, b) => s + b.amount, 0);
                return (
                  <tr key={c.id} className={styles.caseRow} onClick={() => nav(`/case/${c.id}`)}>
                    <td className={styles.caseTitleCell}>{c.title}</td>
                    <td>{c.type}</td>
                    <td className={`${styles.num} mono`}>{c.headcount}명</td>
                    <td>{c.venue}</td>
                    <td className="mono">{c.date}</td>
                    <td className={`${styles.num} mono`}>★ {c.satisfaction}</td>
                    <td className={`${styles.num} mono`}>{man(total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
