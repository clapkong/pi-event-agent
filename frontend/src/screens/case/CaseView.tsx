import { useParams, useNavigate } from "react-router-dom";
import { CASES } from "@/data/cases";
import styles from "./case.module.css";

const man = (n: number) => `${Math.round(n / 10000).toLocaleString("ko-KR")}만`;

// S6 사례 상세 + 역추적(citedBy) (F5.3). mock.
export function CaseView() {
  const { id } = useParams();
  const nav = useNavigate();
  const c = id ? CASES[id] : undefined;

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
        <button className={styles.back} onClick={() => nav("/")} aria-label="홈">
          <i className="ti ti-arrow-left" aria-hidden />
        </button>
        <h1 className={styles.title}>사례 · {c.title}</h1>
        <span className={styles.doneBadge}>
          <span className={styles.doneDot} aria-hidden />
          완료
        </span>
        <span className={styles.spacer} />
        <span className={styles.source}>Extension case_get · pgvector</span>
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
            <p className={styles.full}>{c.summary}</p>
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

            <section className={styles.card}>
              <h3 className={styles.cardTitle}>이 사례를 인용한 행사</h3>
              {c.citedBy.length === 0 ? (
                <p className={styles.none}>아직 없음</p>
              ) : (
                <ul className={styles.cited}>
                  {c.citedBy.map((w) => (
                    <li key={w.wsId}>
                      <button onClick={() => nav(`/w/${w.wsId}/board`)}>
                        <i className="ti ti-arrow-back-up" aria-hidden /> {w.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
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
