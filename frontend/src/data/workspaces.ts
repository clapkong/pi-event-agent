// 워크스페이스 = 행사 1개 (PLAN §1 불변 원칙). 타입·상태 매핑만 — 데이터는 store/workspaces.tsx 가 백엔드 REST 로 로드.

export type WorkspaceStatus = "planning" | "active" | "done" | "late";

export interface Workspace {
  id: string;
  name: string;
  status: WorkspaceStatus;
  /** 타일 조건 한 줄: "유형 · 인원 · 예산 · D-N" (DESIGN §9.8) */
  summary: string;
  /** 진행 미터 0–100 */
  progress: number;
}

// 사이드바/타일 점 색 = 상태 (DESIGN §9.5 / §2.2)
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

// 상태 뱃지 색 클래스 매핑용 키 (컴포넌트에서 사용)
export const STATUS_BADGE: Record<WorkspaceStatus, "progress" | "done" | "late"> = {
  planning: "progress",
  active: "progress",
  done: "done",
  late: "late",
};
