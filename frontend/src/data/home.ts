// 홈 대시보드 mock 데이터 (F3.2) — 알림·체크리스트·달력 마크.
// ⚠️ mock — Phase B에서 신선도(S4)·승인 게이트(S3)·D-레일(S4) 등 실제 출처로 교체.

export type NotifKind = "review" | "approval" | "deadline";

export interface Notif {
  id: string;
  kind: NotifKind;
  wsId: string;
  wsName: string;
  message: string;
  when: string; // 시각 또는 D-N
}

export const NOTIF_GROUPS: { kind: NotifKind; label: string }[] = [
  { kind: "review", label: "재검토 필요" },
  { kind: "approval", label: "승인 대기" },
  { kind: "deadline", label: "마감 임박" },
];

export const MOCK_NOTIFS: Notif[] = [
  {
    id: "n1",
    kind: "review",
    wsId: "w-workshop",
    wsName: "팀 워크숍 (양양)",
    message: "날씨 예보 변동 — 강수확률 ↑10%",
    when: "2시간 전",
  },
  {
    id: "n2",
    kind: "approval",
    wsId: "w-meetup-200",
    wsName: "프론트엔드 밋업 200명",
    message: "초청 메일 발송 승인 대기",
    when: "오늘 10:24",
  },
  {
    id: "n3",
    kind: "deadline",
    wsId: "w-workshop",
    wsName: "팀 워크숍 (양양)",
    message: "버스 예약 마감",
    when: "D-3",
  },
];

export interface ChecklistItem {
  id: string;
  done: boolean;
  date: string;
  wsName: string;
  task: string;
}

export const MOCK_CHECKLIST: ChecklistItem[] = [
  { id: "c1", done: false, date: "06-18", wsName: "밋업 200명", task: "연사 확정 메일" },
  { id: "c2", done: false, date: "06-19", wsName: "워크숍 (양양)", task: "버스 예약" },
  { id: "c3", done: true, date: "06-15", wsName: "채용설명회", task: "장소 후보 3곳 답사" },
  { id: "c4", done: false, date: "06-22", wsName: "밋업 200명", task: "케이터링 견적 비교" },
];

// 달력: 이번 달 마크된 날짜 (오늘/행사일/마일스톤/리허설) — DESIGN §9.21.
export type DayMark = "today" | "event" | "milestone" | "rehearsal";
export const CALENDAR_MONTH = "2026년 6월";
export const CALENDAR_MARKS: Record<number, DayMark> = {
  16: "today",
  18: "milestone",
  19: "milestone",
  22: "rehearsal",
  28: "event",
};
