// 워크스페이스 = 행사 1개 (PLAN §1 불변 원칙). F0 단계에선 mock 목록만.
// 상태는 DESIGN §2.2 / §9.5 사이드바 점 색에 매핑된다.

export type WorkspaceStatus = "planning" | "active" | "done" | "late";

export interface Workspace {
  id: string;
  name: string;
  status: WorkspaceStatus;
}

// 사이드바 점 색 = 상태 (DESIGN §9.5)
export const STATUS_DOT: Record<WorkspaceStatus, string> = {
  planning: "var(--badge-progress-dot)", // 기획중 — 진행중과 같은 티얼
  active: "var(--badge-progress-dot)", // 진행중 — teal
  done: "var(--badge-done-dot)", // 완료 — green
  late: "var(--badge-late-dot)", // 지연 — red
};

export const STATUS_LABEL: Record<WorkspaceStatus, string> = {
  planning: "기획중",
  active: "진행중",
  done: "완료",
  late: "지연",
};

export const MOCK_WORKSPACES: Workspace[] = [
  { id: "w-meetup-200", name: "프론트엔드 밋업 200명", status: "active" },
  { id: "w-hire-day", name: "하반기 채용설명회", status: "planning" },
  { id: "w-workshop", name: "팀 워크숍 (양양)", status: "late" },
  { id: "w-seminar-q1", name: "1분기 기술 세미나", status: "done" },
];
