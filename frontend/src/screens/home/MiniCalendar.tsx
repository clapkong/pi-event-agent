import { CALENDAR_MARKS, CALENDAR_MONTH, type DayMark } from "@/data/home";
import styles from "./home.module.css";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const MARK_CLASS: Record<DayMark, string> = {
  today: styles.dayToday,
  event: styles.dayEvent,
  milestone: styles.dayMilestone,
  rehearsal: styles.dayRehearsal,
};
const LEGEND: { mark: DayMark; label: string }[] = [
  { mark: "today", label: "오늘" },
  { mark: "event", label: "행사일" },
  { mark: "milestone", label: "마일스톤" },
  { mark: "rehearsal", label: "리허설" },
];

// 달력 (DESIGN §9.21) — 월 격자, 모노 숫자, 범례 병행. (2026년 6월 고정 mock)
export function MiniCalendar() {
  const firstWeekday = new Date(2026, 5, 1).getDay();
  const daysInMonth = new Date(2026, 6, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className={styles.calendar}>
      <div className={styles.calHead}>
        <span className={styles.calMonth}>{CALENDAR_MONTH}</span>
        <span className={styles.calLegend}>
          {LEGEND.map((l) => (
            <span key={l.mark} className={styles.legendItem}>
              <span className={`${styles.legendDot} ${MARK_CLASS[l.mark]}`} aria-hidden />
              {l.label}
            </span>
          ))}
        </span>
      </div>
      <div className={styles.calGrid}>
        {WEEKDAYS.map((d) => (
          <span key={d} className={styles.calWeekday}>
            {d}
          </span>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <span key={`e${i}`} />;
          const mark = CALENDAR_MARKS[day];
          return (
            <span
              key={day}
              className={`${styles.calDay} ${mark ? MARK_CLASS[mark] : ""}`}
            >
              {day}
            </span>
          );
        })}
      </div>
    </div>
  );
}
