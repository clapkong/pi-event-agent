// 워크스페이스 = 행사 1개 (PLAN §1 불변 원칙). F3 단계까지는 mock 시드.
// ⚠️ mock — Phase B에서 스토어/백엔드 조회로 교체 (CLAUDE.md 참고).

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

export const SEED_WORKSPACES: Workspace[] = [
  {
    id: "w-meetup-200",
    name: "프론트엔드 밋업 200명",
    status: "active",
    summary: "개발 밋업 · 200명 · 500만원 · D-18",
    progress: 62,
  },
  {
    id: "w-hire-day",
    name: "하반기 채용설명회",
    status: "planning",
    summary: "채용설명회 · 150명 · 700만원 · D-40",
    progress: 15,
  },
  {
    id: "w-workshop",
    name: "팀 워크숍 (양양)",
    status: "late",
    summary: "팀 워크숍 · 30명 · 300만원 · D-7",
    progress: 45,
  },
  {
    id: "w-seminar-q1",
    name: "1분기 기술 세미나",
    status: "done",
    summary: "기술 세미나 · 80명 · 250만원 · 완료",
    progress: 100,
  },
];
