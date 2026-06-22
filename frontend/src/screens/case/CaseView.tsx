import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { Case } from "@/data/cases";
import { Md } from "@/components/Md";
import { API_BASE } from "@/config";
import styles from "./case.module.css";

const man = (n: number) => `${Math.round(n / 10000).toLocaleString("ko-KR")}만`;

// S6 사례 상세 (pi-local-rag와 같은 cases/*.md). 백엔드 /api/cases/:id 에서 읽음.
export function CaseView() {
  const { id } = useParams();
  const nav = useNavigate();
  const [c, setC] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`${API_BASE}/api/cases/${encodeURIComponent(id ?? "")}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        setC(d && !d.error ? (d as Case) : null);
        setLoading(false);
      })
      .catch(() => {
        if (alive) {
          setC(null);
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyEyebrow}>사례</p>
        <h1 className={styles.emptyTitle}>불러오는 중…</h1>
      </div>
    );
  }
  if (!c) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyEyebrow}>사례</p>
        <h1 className={styles.emptyTitle}>사례를 찾을 수 없어요</h1>
      </div>
    );
  }

  const total = c.budgetActual.reduce((s, b) => s + b.amount, 0);

  return (
    <div className={styles.screen}>
      <header className={styles.top}>
        <button className={styles.back} onClick={() => nav("/cases")} aria-label="사례 목록">
          <i className="ti ti-arrow-left" aria-hidden />
        </button>
        <h1 className={styles.title}>사례 · {c.title}</h1>
        <span className={styles.doneBadge}>
          <span className={styles.doneDot} aria-hidden />
          완료
        </span>
        <span className={styles.spacer} />
        <span className={styles.source}>pi-local-rag · cases/{c.id}.md</span>
      </header>

      <div className={styles.scroll}>
        <div className={styles.grid}>
          <div className={styles.main}>
            <div className={styles.metaRow}>
              <Meta label="유형" value={c.type} />
              <Meta label="인원" value={`${c.headcount}명`} />
              <Meta label="장소" value={c.venue} />
              <Meta label="일자" value={c.date} />
              <Meta label="만족도" value={`★ ${c.satisfaction}`} />
            </div>
            <h2 className={styles.sectionTitle}>사례 전문</h2>
            <div className={styles.full}>
              <Md>{c.body}</Md>
            </div>
          </div>

          <aside className={styles.side}>
            <section className={styles.card}>
              <h3 className={styles.cardTitle}>실집행 예산</h3>
              <ul className={styles.budget}>
                {c.budgetActual.map((b) => (
                  <li key={b.name}>
                    <span>{b.name}</span>
                    <span className={styles.amount}>{man(b.amount)}</span>
                  </li>
                ))}
                <li className={styles.budgetTotal}>
                  <span>합계</span>
                  <span className={styles.amount}>{man(total)}</span>
                </li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span className={styles.meta}>
      <span className={styles.metaLabel}>{label}</span>
      <span className={styles.metaValue}>{value}</span>
    </span>
  );
}
