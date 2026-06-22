// S4 작업공간 상태 모델 (F4.1) — ARCHITECTURE §7 (상태 모델).
// 세 겹(입력/가정·기획 산출·실행/확정) + 두 꼬리표(잠금·신선도) + 예산 3상태 + 업체 4단계 + 재기획.
// 데이터: 백엔드 REST(GET /api/workspaces/:id ← update_state state.json). mock seed 없음.

import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "@/config";

export type Stage = "기획" | "진행중" | "정산·완료";

/** 조건 한 항목 — 잠금(확정🔒) 가능 (입력/가정 겹). */
export interface Condition {
  key: string;
  label: string;
  value: string;
  locked: boolean; // 확정🔒 ↔ 계획
}

/** 예산 항목 — 3상태(계획/확정🔒/집행) (ARCHITECTURE §7.2). */
export interface BudgetItem {
  id: string;
  name: string;
  planned: number; // 계획 배분액
  confirmed: boolean; // 확정🔒 (재기획 제외)
  spent: number; // 실제 집행액
  stale: boolean; // 재검토 필요(신선도)
}

/** 업체 — 4단계 state machine (ARCHITECTURE §7.2). */
export type VendorStage = "후보" | "견적" | "확정" | "계약";
export interface Vendor {
  id: string;
  name: string;
  category: string;
  stage: VendorStage;
}
export const VENDOR_STAGES: VendorStage[] = ["후보", "견적", "확정", "계약"];

export interface Milestone {
  dday: number; // D-N (음수면 지남)
  title: string;
  due: string;
  status: "done" | "upcoming" | "late";
  owner: string;
}

export interface BoardState {
  stage: Stage;
  budgetTotal: number;
  proposalVersion: number;
  conditions: Condition[];
  budget: BudgetItem[];
  vendors: Vendor[];
  weather: { label: string; temp: string; pop: number; stale: boolean; source?: "forecast" | "climatology"; basis?: string };
  venue: { name: string; note: string };
  milestones: Milestone[];
  /** 입력 변화로 뜬 재기획 제안(없으면 null). */
  replan: { changedInputs: string[] } | null;
  /** 마지막 '점검'(운영 새로고침) 시각 ISO. 페이지 열 때 1주 넘었으면 자동 점검. */
  checkedAt?: string;
}

// 예산 3상태 합계 (DESIGN §2.6 막대: 집행 │ 확정·미집행 │ 계획 잔여).
export function budgetSegments(b: BudgetItem[]) {
  const spent = b.reduce((s, x) => s + x.spent, 0);
  const committed = b.reduce((s, x) => s + (x.confirmed ? Math.max(x.planned - x.spent, 0) : 0), 0);
  const planned = b.reduce((s, x) => s + (x.confirmed ? 0 : x.planned), 0);
  return { spent, committed, planned, total: spent + committed + planned };
}

/** 빈 보드 — 초기/로딩·부분 응답 보강 기준값. (mock seed 없음: 보드는 백엔드 state.json 만 반영) */
function emptyBoard(): BoardState {
  return {
    stage: "기획",
    budgetTotal: 0,
    proposalVersion: 1,
    conditions: [],
    budget: [],
    vendors: [],
    weather: { label: "", temp: "", pop: 0, stale: false },
    venue: { name: "", note: "" },
    milestones: [],
    replan: null,
  };
}

/** 백엔드 보드 상태(update_state 가 쓴 state.json) 조회. 없거나(404)·실패 시 null. */
export async function fetchBoard(wsId: string): Promise<BoardState | null> {
  try {
    const res = await fetch(`${API_BASE}/api/workspaces/${encodeURIComponent(wsId)}`);
    if (!res.ok) return null;
    return { ...emptyBoard(), ...(await res.json()) } as BoardState;
  } catch {
    return null; // 백엔드 미기동·404 등 → 빈 보드 유지(폴백 없음)
  }
}

/** 보드 상태 + 액션. 빈 보드로 시작해 백엔드 state.json 으로 채운다(없으면 빈 채로 — mock 폴백 없음). */
export function useBoard(wsId: string) {
  const [board, setBoard] = useState<BoardState>(emptyBoard);

  // 백엔드에 실제 보드 상태가 있으면 채운다.
  useEffect(() => {
    let alive = true;
    fetchBoard(wsId).then((b) => {
      if (alive && b) setBoard(b);
    });
    return () => {
      alive = false;
    };
  }, [wsId]);

  // 점검(에이전트 런)이 state.json 을 바꾼 뒤 다시 읽기 위한 재로드.
  const reload = useCallback(() => {
    fetchBoard(wsId).then((b) => {
      if (b) setBoard(b);
    });
  }, [wsId]);

  // 사람이 작업공간에서 직접 편집(잠금 등) → 낙관적 반영 + 백엔드 PATCH로 저장(state.json).
  // (잠금·확정은 사람의 권한. 에이전트는 잠긴 항목을 못 바꾸지만 사람은 바꿀 수 있다.)
  const persist = (patch: Partial<BoardState>) => {
    void fetch(`${API_BASE}/api/workspaces/${encodeURIComponent(wsId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => {
      /* 저장 실패는 무시(다음 로드 때 서버값) */
    });
  };

  const toggleConditionLock = (key: string) =>
    setBoard((s) => {
      const conditions = s.conditions.map((c) => (c.key === key ? { ...c, locked: !c.locked } : c));
      persist({ conditions });
      return { ...s, conditions };
    });

  // ⑦ 사람이 입력(조건·예산)을 바꾸면, 무엇이 바뀌었는지 재기획 배너에 누적 → "재검토 필요" 신호.
  // (세션 내·사용자 액션 기반 — 백그라운드 트리거 없음. 실제 재기획은 배너 버튼으로 에이전트가.)
  const withReplan = (s: BoardState, desc: string): { changedInputs: string[] } => {
    const prev = s.replan?.changedInputs ?? [];
    return { changedInputs: prev.includes(desc) ? prev : [...prev, desc] };
  };
  const man = (n: number) => `${Math.round(n / 10000).toLocaleString("ko-KR")}만`;

  const editConditionValue = (key: string, value: string) =>
    setBoard((s) => {
      const prev = s.conditions.find((c) => c.key === key);
      const conditions = s.conditions.map((c) => (c.key === key ? { ...c, value } : c));
      const replan = prev && prev.value !== value ? withReplan(s, `${prev.label} ${prev.value} → ${value}`) : s.replan;
      persist({ conditions, replan });
      return { ...s, conditions, replan };
    });

  const toggleBudgetLock = (id: string) =>
    setBoard((s) => {
      const budget = s.budget.map((x) => (x.id === id ? { ...x, confirmed: !x.confirmed } : x));
      persist({ budget });
      return { ...s, budget };
    });

  const editBudget = (id: string, field: "planned" | "spent", value: number) =>
    setBoard((s) => {
      const prev = s.budget.find((x) => x.id === id);
      const budget = s.budget.map((x) => (x.id === id ? { ...x, [field]: value } : x));
      const replan =
        prev && prev[field] !== value
          ? withReplan(s, `${prev.name} ${field === "planned" ? "계획" : "집행"} ${man(prev[field])} → ${man(value)}`)
          : s.replan;
      persist({ budget, replan });
      return { ...s, budget, replan };
    });

  const editBudgetTotal = (budgetTotal: number) =>
    setBoard((s) => {
      const replan = s.budgetTotal !== budgetTotal ? withReplan(s, `총예산 ${man(s.budgetTotal)} → ${man(budgetTotal)}`) : s.replan;
      persist({ budgetTotal, replan });
      return { ...s, budgetTotal, replan };
    });

  // 업체 단계 순환(후보→견적→확정→계약→후보).
  const cycleVendorStage = (id: string) =>
    setBoard((s) => {
      const vendors = s.vendors.map((v) => {
        if (v.id !== id) return v;
        const i = VENDOR_STAGES.indexOf(v.stage);
        return { ...v, stage: VENDOR_STAGES[(i + 1) % VENDOR_STAGES.length] };
      });
      persist({ vendors });
      return { ...s, vendors };
    });

  // ── 일정(마일스톤) 편집 — 사람이 추가·수정·완료체크. 전부 PATCH 저장. ──
  const setMilestones = (s: BoardState, milestones: Milestone[]) => {
    persist({ milestones });
    return { ...s, milestones };
  };
  const toggleMilestoneDone = (i: number) =>
    setBoard((s) =>
      setMilestones(
        s,
        s.milestones.map((m, idx) => (idx === i ? { ...m, status: m.status === "done" ? "upcoming" : "done" } : m)),
      ),
    );
  const editMilestone = (i: number, patch: Partial<Milestone>) =>
    setBoard((s) => {
      const eventDue = s.milestones.find((m) => m.dday === 0)?.due;
      const milestones = s.milestones.map((m, idx) => {
        if (idx !== i) return m;
        const next = { ...m, ...patch };
        // due 를 바꾸면 D-day(행사일 기준)도 다시 계산.
        if (patch.due && eventDue) {
          next.dday = Math.round((new Date(`${patch.due}T00:00:00`).getTime() - new Date(`${eventDue}T00:00:00`).getTime()) / 86400000);
        }
        return next;
      });
      return setMilestones(s, milestones);
    });
  const addMilestone = () =>
    setBoard((s) => setMilestones(s, [...s.milestones, { dday: 0, title: "새 일정", due: "", status: "upcoming", owner: "" }]));
  const removeMilestone = (i: number) => setBoard((s) => setMilestones(s, s.milestones.filter((_, idx) => idx !== i)));

  // '점검' 시각 기록 — 주기 자동 점검(페이지 열 때 1주 경과) 판단용.
  const markChecked = () =>
    setBoard((s) => {
      const checkedAt = new Date().toISOString();
      persist({ checkedAt });
      return { ...s, checkedAt };
    });

  // 진행 단계(기획→진행중→정산·완료)도 사람이 직접 변경.
  const setStage = (stage: Stage) =>
    setBoard((s) => {
      persist({ stage });
      return { ...s, stage };
    });

  // 재기획 배너 닫기 — 로컬 + 백엔드 반영(다시 로드해도 안 돌아오게). 실제 재기획은 AI 에이전트가 수행.
  const dismissReplan = () =>
    setBoard((s) => {
      persist({ replan: null });
      return { ...s, replan: null };
    });

  return {
    board,
    reload,
    dismissReplan,
    toggleConditionLock,
    editConditionValue,
    toggleBudgetLock,
    editBudget,
    editBudgetTotal,
    cycleVendorStage,
    setStage,
    markChecked,
    toggleMilestoneDone,
    editMilestone,
    addMilestone,
    removeMilestone,
  };
}
