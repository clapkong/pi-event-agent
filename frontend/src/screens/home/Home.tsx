import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspaces } from "@/store/workspaces";
import { STATUS_DOT, type Workspace } from "@/data/workspaces";
import { fetchBoard, type BoardState } from "@/data/boardState";
import { API_BASE } from "@/config";
import { NOTIF_GROUPS, type ChecklistItem, type Notif, type NotifKind } from "@/data/home";
import { StatusBadge } from "@/components/StatusBadge";
import styles from "./home.module.css";

type WsBoard = { ws: Workspace; board: BoardState };

// 모든 워크스페이스 보드(state.json) → 알림·체크리스트·달력의 실제 출처.
function useAllBoards(workspaces: Workspace[]): WsBoard[] {
  const [boards, setBoards] = useState<WsBoard[]>([]);
  useEffect(() => {
    let alive = true;
    Promise.all(workspaces.map((w) => fetchBoard(w.id).then((board) => ({ ws: w, board })))).then((rs) => {
      if (alive) setBoards(rs.filter((r): r is WsBoard => r.board != null));
    });
    return () => {
      alive = false;
    };
  }, [workspaces]);
  return boards;
}

// 알림: 재검토(보드 replan) + 마감 임박(1주 내 미완료 마일스톤). 실데이터에서 파생.
function deriveNotifs(boards: WsBoard[]): Notif[] {
  const out: Notif[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const { ws, board } of boards) {
    if (board.replan && board.replan.changedInputs.length > 0) {
      out.push({
        id: `${ws.id}-replan`,
        kind: "review",
        wsId: ws.id,
        wsName: ws.name,
        message: `입력 변경 — ${board.replan.changedInputs.slice(0, 2).join(", ")}`,
        when: "재검토",
      });
    }
    for (const m of board.milestones) {
      if (m.status === "done" || !m.due) continue;
      const due = new Date(`${m.due}T00:00:00`);
      if (Number.isNaN(due.getTime())) continue;
      const days = Math.round((due.getTime() - today.getTime()) / 86400000);
      if (days >= 0 && days <= 7) {
        out.push({
          id: `${ws.id}-${m.title}`,
          kind: "deadline",
          wsId: ws.id,
          wsName: ws.name,
          message: m.title,
          when: days === 0 ? "오늘" : `D-${days}`,
        });
      }
    }
  }
  return out;
}

// 체크리스트: 워크스페이스 마일스톤(미완료 우선·날짜순) 상위 8.
function deriveChecklist(boards: WsBoard[]): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  for (const { ws, board } of boards) {
    for (const m of board.milestones) {
      if (!m.due) continue;
      items.push({
        id: `${ws.id}-${m.title}`,
        done: m.status === "done",
        date: m.due.slice(5),
        wsName: ws.name,
        task: m.title,
      });
    }
  }
  return items
    .sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || a.date.localeCompare(b.date))
    .slice(0, 8);
}

// 홈 · 대시보드. 화면 전체와 그 안에서만 쓰는 부품(타일·알림·달력)을 한 파일에 둔다.
export function Home() {
  const { workspaces, byStatus } = useWorkspaces();
  const navigate = useNavigate();
  const boards = useAllBoards(workspaces);

  // 진행 중 = 진행중+지연 · 진행 예정 = 기획중 · 완료 = done.
  const inProgress = byStatus("active", "late");
  const upcoming = byStatus("planning");
  const completed = byStatus("done");

  const notifs = useMemo(() => deriveNotifs(boards), [boards]);
  const checklist = useMemo(() => deriveChecklist(boards), [boards]);

  // 과거 사례(cases/*.md) 존재 여부 — 있으면 사례 목록(/cases) 버튼 노출.
  const [hasCases, setHasCases] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/api/cases`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && Array.isArray(d?.cases)) setHasCases(d.cases.length > 0);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className={styles.home}>
      <header className={styles.header}>
        <h1 className={styles.title}>홈</h1>
        <span className={styles.headerActions}>
          <NotificationCenter notifs={notifs} />
          <button type="button" className={styles.newBtn} onClick={() => navigate("/new")}>
            <i className="ti ti-plus" aria-hidden /> 새 행사
          </button>
        </span>
      </header>

      {workspaces.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>아직 행사가 없어요</p>
          <button type="button" className={styles.newBtn} onClick={() => navigate("/new")}>
            <i className="ti ti-plus" aria-hidden /> 새 행사 만들기
          </button>
        </div>
      ) : (
        <>
          {inProgress.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>진행 중인 워크스페이스</h2>
              <div className={styles.tileGrid}>
                {inProgress.map((ws) => (
                  <WorkspaceTile key={ws.id} ws={ws} />
                ))}
              </div>
            </section>
          )}

          {/* 진행 중이 없으면 예정 행사를 펼쳐서 바로 보이게 */}
          <CollapsibleRow title="진행 예정" count={upcoming.length} defaultOpen={inProgress.length === 0}>
            {upcoming.map((ws) => (
              <WorkspaceTile key={ws.id} ws={ws} />
            ))}
          </CollapsibleRow>

          <CollapsibleRow title="진행 완료" count={completed.length}>
            {completed.map((ws) => (
              <WorkspaceTile key={ws.id} ws={ws} />
            ))}
          </CollapsibleRow>

          {hasCases && (
            <button type="button" className={styles.caseRow} onClick={() => navigate("/cases")}>
              <span className={styles.caseTitle}>과거 진행 사례 모음</span>
              <span className={styles.caseHint}>완료된 행사를 사례로 재사용 · S6 →</span>
            </button>
          )}

          <div className={styles.bottomGrid}>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>할 일 · 일정 달력</h2>
              <MiniCalendar boards={boards} />
            </section>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>할 일 체크리스트</h2>
              {checklist.length === 0 ? (
                <p className={styles.checkEmpty}>예정된 일정이 없어요.</p>
              ) : (
                <ul className={styles.checklist}>
                  {checklist.map((c) => (
                    <li key={c.id} className={styles.checkRow}>
                      <input type="checkbox" defaultChecked={c.done} className={styles.check} readOnly />
                      <span className={styles.checkDate}>{c.date}</span>
                      <span className={styles.checkWs}>{c.wsName}</span>
                      <span className={c.done ? styles.checkTaskDone : styles.checkTask}>{c.task}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

// 접히는 행 (진행 예정·완료).
function CollapsibleRow({
  title,
  count,
  children,
  defaultOpen = false,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={styles.collapse}>
      <button
        type="button"
        className={styles.collapseHead}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <i className={`ti ti-chevron-${open ? "down" : "right"} ${styles.collapseCaret}`} aria-hidden />
        {title}
        <span className={styles.collapseCount}>{count}</span>
      </button>
      {open && (count > 0 ? <div className={styles.tileGrid}>{children}</div> : <p className={styles.checkEmpty}>없음</p>)}
    </section>
  );
}

// 워크스페이스 타일. 클릭 → 작업 보드.
function WorkspaceTile({ ws }: { ws: Workspace }) {
  const navigate = useNavigate();
  return (
    <button type="button" className={styles.tile} onClick={() => navigate(`/w/${ws.id}/board`)}>
      <div className={styles.tileHead}>
        <span className={styles.tileDot} style={{ background: STATUS_DOT[ws.status] }} aria-hidden />
        <span className={styles.tileName}>{ws.name}</span>
        <StatusBadge status={ws.status} />
      </div>
      <p className={styles.tileSummary}>{ws.summary}</p>
      <div className={styles.meter}>
        <div className={styles.meterTrack}>
          <div className={styles.meterFill} style={{ width: `${ws.progress}%` }} />
        </div>
        <span className={styles.meterPct}>{ws.progress}%</span>
      </div>
    </button>
  );
}

// 알림 센터: 벨 + 카운트 + 그룹 패널. (실데이터 파생 — Home에서 notifs 주입)
const NOTIF_KIND_CLASS: Record<NotifKind, string> = {
  review: styles.kindReview,
  approval: styles.kindApproval,
  deadline: styles.kindDeadline,
};

function NotificationCenter({ notifs }: { notifs: Notif[] }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const count = notifs.length;

  return (
    <div className={styles.notifWrap}>
      <button
        type="button"
        className={styles.bell}
        onClick={() => setOpen((v) => !v)}
        aria-label={`알림 ${count}건`}
      >
        <i className="ti ti-bell" aria-hidden />
        {count > 0 && <span className={styles.bellCount}>{count}</span>}
      </button>

      {open && (
        <>
          <div className={styles.notifBackdrop} onClick={() => setOpen(false)} />
          <div className={styles.notifPanel} role="dialog" aria-label="알림">
            {count === 0 && <p className={styles.checkEmpty}>새 알림이 없어요.</p>}
            {NOTIF_GROUPS.map((g) => {
              const items = notifs.filter((n) => n.kind === g.kind);
              if (items.length === 0) return null;
              return (
                <div key={g.kind} className={styles.notifGroup}>
                  <p className={`${styles.notifGroupLabel} ${NOTIF_KIND_CLASS[g.kind]}`}>
                    {g.label} <span className={styles.notifGroupCount}>{items.length}</span>
                  </p>
                  {items.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      className={styles.notifItem}
                      onClick={() => {
                        setOpen(false);
                        navigate(`/w/${n.wsId}/board`);
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

// 미니 달력: 월 격자 + 범례. 이번 달 실데이터 — 공휴일 API + 워크스페이스 보드 milestones.
const CAL_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
type CalMark = "today" | "holiday" | "event";
const DAY_MARK_CLASS: Record<CalMark, string> = {
  today: styles.dayToday,
  holiday: styles.dayHoliday,
  event: styles.dayEvent,
};
const CAL_LEGEND: { mark: CalMark; label: string }[] = [
  { mark: "today", label: "오늘" },
  { mark: "holiday", label: "공휴일" },
  { mark: "event", label: "행사 일정" },
];

function MiniCalendar({ boards }: { boards: WsBoard[] }) {
  const now = new Date();
  const [view] = useState(() => ({ year: now.getFullYear(), month: now.getMonth() })); // month: 0-based
  const [holidays, setHolidays] = useState<Record<number, string>>({});

  // 공휴일: 해당 연도 KR 공휴일을 받아 이번 달만 추림(Nager.Date 공개 API·키 불필요).
  useEffect(() => {
    let alive = true;
    fetch(`https://date.nager.at/api/v3/PublicHolidays/${view.year}/KR`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: { date: string; localName: string }[]) => {
        if (!alive || !Array.isArray(list)) return;
        const m: Record<number, string> = {};
        for (const h of list) {
          const d = new Date(`${h.date}T00:00:00`);
          if (d.getFullYear() === view.year && d.getMonth() === view.month) m[d.getDate()] = h.localName;
        }
        setHolidays(m);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [view.year, view.month]);

  // 행사 일정: 전달받은 보드들의 milestones 중 이번 달 due.
  const eventDays = useMemo(() => {
    const m: Record<number, string> = {};
    for (const { ws, board } of boards) {
      for (const ms of board.milestones) {
        const d = new Date(`${ms.due}T00:00:00`);
        if (!Number.isNaN(d.getTime()) && d.getFullYear() === view.year && d.getMonth() === view.month) {
          m[d.getDate()] = `${ws.name} · ${ms.title}`;
        }
      }
    }
    return m;
  }, [boards, view.year, view.month]);

  const firstWeekday = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const todayDay = now.getFullYear() === view.year && now.getMonth() === view.month ? now.getDate() : -1;
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const markOf = (day: number): CalMark | null =>
    day === todayDay ? "today" : holidays[day] ? "holiday" : eventDays[day] ? "event" : null;
  const titleOf = (day: number) => holidays[day] ?? eventDays[day] ?? undefined;

  return (
    <div className={styles.calendar}>
      <div className={styles.calHead}>
        <span className={styles.calMonth}>
          {view.year}년 {view.month + 1}월
        </span>
        <span className={styles.calLegend}>
          {CAL_LEGEND.map((l) => (
            <span key={l.mark} className={styles.legendItem}>
              <span className={`${styles.legendDot} ${DAY_MARK_CLASS[l.mark]}`} aria-hidden />
              {l.label}
            </span>
          ))}
        </span>
      </div>
      <div className={styles.calGrid}>
        {CAL_WEEKDAYS.map((d) => (
          <span key={d} className={styles.calWeekday}>
            {d}
          </span>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <span key={`e${i}`} />;
          const mark = markOf(day);
          return (
            <span
              key={day}
              title={titleOf(day)}
              className={`${styles.calDay} ${mark ? DAY_MARK_CLASS[mark] : ""}`}
            >
              {day}
            </span>
          );
        })}
      </div>
    </div>
  );
}
