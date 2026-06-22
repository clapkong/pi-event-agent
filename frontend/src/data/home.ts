// 홈 대시보드 타입 — 알림·체크리스트는 실제 보드(state.json)에서 파생한다(Home.tsx). mock 없음.

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

export interface ChecklistItem {
  id: string;
  done: boolean;
  date: string;
  wsName: string;
  task: string;
}
