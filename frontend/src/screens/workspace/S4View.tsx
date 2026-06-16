import { useNavigate } from "react-router-dom";
import type { Workspace } from "@/data/workspaces";
import { StatusBadge } from "@/components/StatusBadge";
import {
  budgetSegments,
  useBoard,
  VENDOR_STAGES,
  type BudgetItem,
  type Vendor,
} from "@/data/boardState";
import styles from "./s4.module.css";

const man = (n: number) => `${Math.round(n / 10000).toLocaleString("ko-KR")}만`;
const STAGES = ["기획", "진행중", "정산·완료"] as const;

// S4 작업공간 · 상태 모델 (F4.2–F4.4). mock 구동.
export function S4View({ ws }: { ws: Workspace }) {
  const nav = useNavigate();
  const {
    board,
    toggleConditionLock,
    toggleBudgetLock,
    changeWeather,
    doReplan,
    dismissReplan,
  } = useBoard(ws.id);

  const seg = budgetSegments(board.budget);
  const lockedCount = board.budget.filter((b) => b.confirmed).length;
  const spentPct = Math.round((seg.spent / board.budgetTotal) * 100);
  const nextMs = board.milestones.find((m) => m.dday >= 0);

  return (
    <div className={styles.screen}>
      {/* 상단 바 (§9.6) */}
      <header className={styles.top}>
        <h1 className={styles.wsName}>{ws.name}</h1>
        <button className={styles.pencil} title="이름 수정" aria-label="이름 수정">
          <i className="ti ti-pencil" aria-hidden />
        </button>
        <StatusBadge status={ws.status} />
        <span className={styles.spacer} />
        <button className={styles.agentBtn} onClick={() => nav(`/w/${ws.id}`)}>
          <i className="ti ti-message-2" aria-hidden /> AI Agent
        </button>
      </header>

      <div className={styles.scroll}>
        <div className={styles.col}>
          {/* 상태 스트립 (§9.7) */}
          <section className={styles.statusStrip}>
            <div className={styles.stepper}>
              {STAGES.map((st) => (
                <span
                  key={st}
                  className={`${styles.step} ${st === board.stage ? styles.stepCur : ""}`}
                >
                  {st}
                </span>
              ))}
            </div>
            <div className={styles.summaryChips}>
              <Chip>제안서 <b className="mono">v{board.proposalVersion}</b></Chip>
              <Chip>확정 <b className="mono">{lockedCount}</b><i className="ti ti-lock" aria-hidden /></Chip>
              <Chip>집행 <b className="mono">{spentPct}%</b></Chip>
              {nextMs && <Chip>다음 마감 <b className="mono">D-{nextMs.dday === 0 ? "0" : nextMs.dday}</b></Chip>}
            </div>
          </section>

          {/* 재기획 배너 (§9.16) */}
          {board.replan && (
            <section className={styles.replan}>
              <div className={styles.replanHead}>
                <i className="ti ti-refresh-alert" aria-hidden />
                <strong>입력이 바뀌어 재검토가 필요합니다</strong>
              </div>
              <ul className={styles.replanList}>
                {board.replan.changedInputs.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <p className={styles.replanNote}>
                재기획은 <b>계획 항목만</b> 재배분합니다 — 확정🔒·집행 항목은 잠겨 안 바뀝니다.
              </p>
              <div className={styles.replanActions}>
                <button className={styles.btnPrimary} onClick={doReplan}>
                  다시 기획
                </button>
                <button className={styles.btnGhost} onClick={dismissReplan}>
                  무시
                </button>
              </div>
            </section>
          )}

          {/* 조건 (입력/가정 겹, 잠금 가능) */}
          <Card title="행사 조건">
            <div className={styles.conds}>
              {board.conditions.map((c) => (
                <button
                  key={c.key}
                  className={`${styles.cond} ${c.locked ? styles.condLocked : ""}`}
                  onClick={() => toggleConditionLock(c.key)}
                  title={c.locked ? "확정 해제" : "확정🔒"}
                >
                  <span className={styles.condLabel}>{c.label}</span>
                  <span className={styles.condValue}>{c.value}</span>
                  {c.locked && <i className="ti ti-lock" aria-hidden />}
                </button>
              ))}
            </div>
          </Card>

          {/* 2열: 좌(예산·업체) / 우(지도·날씨·산출물) */}
          <div className={styles.twoCol}>
            <div className={styles.colMain}>
              <Card title="예산">
                <BudgetBar seg={seg} total={board.budgetTotal} />
                <table className={styles.budgetTable}>
                  <thead>
                    <tr>
                      <th>항목</th>
                      <th className={styles.num}>계획</th>
                      <th>상태</th>
                      <th className={styles.num}>집행</th>
                    </tr>
                  </thead>
                  <tbody>
                    {board.budget.map((b) => (
                      <BudgetRow key={b.id} b={b} onToggle={() => toggleBudgetLock(b.id)} />
                    ))}
                  </tbody>
                </table>
                <p className={styles.tableNote}>재기획은 계획만 재배분, 확정·집행 유지.</p>
              </Card>

              <Card title="업체">
                <div className={styles.vendors}>
                  {board.vendors.map((v) => (
                    <VendorRow key={v.id} v={v} />
                  ))}
                </div>
              </Card>
            </div>

            <div className={styles.colSide}>
              <Card title="장소">
                <div className={styles.mapCard}>
                  <i className={`ti ti-map-pin ${styles.mapPin}`} aria-hidden />
                  <div>
                    <p className={styles.mapName}>{board.venue.name}</p>
                    <p className={styles.mapNote}>{board.venue.note}</p>
                  </div>
                </div>
              </Card>

              <Card title="날씨">
                <div className={styles.weather}>
                  <i
                    className={`ti ${board.weather.pop >= 50 ? "ti-cloud-rain" : "ti-sun"} ${styles.wIcon}`}
                    aria-hidden
                  />
                  <div className={styles.wInfo}>
                    <p className={styles.wLabel}>
                      {board.weather.label} {board.weather.temp}
                      {board.weather.stale && <span className={styles.staleTag}>변동</span>}
                    </p>
                    <p className={styles.wPop}>
                      강수확률 <span className="mono">{board.weather.pop}%</span>
                    </p>
                  </div>
                </div>
                {!board.replan && (
                  <button className={styles.btnGhostSm} onClick={changeWeather}>
                    예보 변경(우천) 시뮬레이션
                  </button>
                )}
              </Card>

              <Card title="산출물">
                <ul className={styles.outputs}>
                  <li><i className="ti ti-file-text" aria-hidden /> 제안서 v{board.proposalVersion}<span className={styles.outMeta}>편집 → S5</span></li>
                  <li><i className="ti ti-table" aria-hidden /> 업체 비교표</li>
                  <li><i className="ti ti-alert-triangle" aria-hidden /> 우천 대비 리스크{board.weather.stale && <span className={styles.staleTag}>재검토</span>}</li>
                </ul>
              </Card>
            </div>
          </div>

          {/* 일정: D-레일 (§9.20) */}
          <Card title="일정">
            <div className={styles.drail}>
              {board.milestones.map((m) => (
                <div key={m.title} className={styles.drailNode}>
                  <span
                    className={`${styles.drailDot} ${
                      m.dday === 0 ? styles.drailToday : m.status === "done" ? styles.drailDone : ""
                    }`}
                    aria-hidden
                  />
                  <span className={styles.drailD}>{m.dday === 0 ? "당일" : `D${m.dday > 0 ? "+" : ""}${m.dday}`}</span>
                </div>
              ))}
            </div>
            <ul className={styles.scheduleList}>
              {board.milestones.map((m) => (
                <li key={m.title} className={styles.schedRow}>
                  <span className={`${styles.schedTag} ${m.status === "late" ? styles.schedLate : ""}`}>
                    {m.dday === 0 ? "당일" : `D${m.dday > 0 ? "+" : ""}${m.dday}`}
                  </span>
                  <span className={styles.schedTitle}>{m.title}</span>
                  <span className={styles.schedOwner}>{m.owner}</span>
                  <span className={styles.schedDue}>{m.due}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>{title}</h2>
      {children}
    </section>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className={styles.chip}>{children}</span>;
}

function BudgetBar({ seg, total }: { seg: ReturnType<typeof budgetSegments>; total: number }) {
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className={styles.bbarWrap}>
      <div className={styles.bbar}>
        <span className={styles.bSpent} style={{ width: pct(seg.spent) }} />
        <span className={styles.bCommitted} style={{ width: pct(seg.committed) }} />
        <span className={styles.bPlanned} style={{ width: pct(seg.planned) }} />
      </div>
      <div className={styles.bLegend}>
        <span><i className={styles.dotSpent} />집행 <b className="mono">{man(seg.spent)}</b></span>
        <span><i className={styles.dotCommitted} />확정·미집행 <b className="mono">{man(seg.committed)}</b></span>
        <span><i className={styles.dotPlanned} />계획 잔여 <b className="mono">{man(seg.planned)}</b></span>
      </div>
    </div>
  );
}

function BudgetRow({ b, onToggle }: { b: BudgetItem; onToggle: () => void }) {
  return (
    <tr className={b.stale ? styles.rowStale : undefined}>
      <td>
        {b.name}
        {b.stale && <span className={styles.staleTag}>재검토</span>}
      </td>
      <td className={`${styles.num} mono`}>{man(b.planned)}</td>
      <td>
        <button
          className={b.confirmed ? styles.lockOn : styles.lockOff}
          onClick={onToggle}
          title={b.confirmed ? "확정 해제" : "확정🔒"}
        >
          {b.confirmed ? (
            <><i className="ti ti-lock" aria-hidden /> 확정</>
          ) : (
            "계획"
          )}
        </button>
      </td>
      <td className={`${styles.num} mono`}>{b.spent ? man(b.spent) : "—"}</td>
    </tr>
  );
}

function VendorRow({ v }: { v: Vendor }) {
  const curIdx = VENDOR_STAGES.indexOf(v.stage);
  return (
    <div className={styles.vendorRow}>
      <span className={styles.vendorName}>{v.name}</span>
      <span className={styles.vendorCat}>{v.category}</span>
      <span className={styles.miniStepper}>
        {VENDOR_STAGES.map((st, i) => (
          <span
            key={st}
            className={`${styles.miniDot} ${i < curIdx ? styles.miniDone : ""} ${
              i === curIdx ? styles.miniCur : ""
            }`}
            title={st}
          >
            {st === "확정" && i <= curIdx ? <i className="ti ti-lock" aria-hidden /> : null}
          </span>
        ))}
        <span className={styles.vendorStage}>{v.stage}</span>
      </span>
    </div>
  );
}
