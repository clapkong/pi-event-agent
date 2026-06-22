// S4 작업공간 상태 모델 (F4.1) — DATA_MODEL §1·§2.
// 세 겹(입력/가정·기획 산출·실행/확정) + 두 꼬리표(잠금·신선도) + 예산 3상태 + 업체 4단계 + 재기획.
// 데이터: 백엔드 REST(GET /api/workspaces/:id ← update_state state.json). mock seed 없음.

import { useEffect, useState } from "react";

export type Stage = "기획" | "진행중" | "정산·완료";

/** 조건 한 항목 — 잠금(확정🔒) 가능 (입력/가정 겹). */
export interface Condition {
  key: string;
  label: string;
  value: string;
  locked: boolean; // 확정🔒 ↔ 계획
}

/** 예산 항목 — 3상태(계획/확정🔒/집행) (DATA_MODEL §1.4). */
export interface BudgetItem {
  id: string;
  name: string;
  planned: number; // 계획 배분액
  confirmed: boolean; // 확정🔒 (재기획 제외)
  spent: number; // 실제 집행액
  stale: boolean; // 재검토 필요(신선도)
}

/** 업체 — 4단계 state machine (DATA_MODEL §1.5). */
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
  weather: { label: string; temp: string; pop: number; stale: boolean };
  venue: { name: string; note: string };
  milestones: Milestone[];
  /** 입력 변화로 뜬 재기획 제안(없으면 null). */
  replan: { changedInputs: string[] } | null;
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

const API_BASE = "http://127.0.0.1:8787";

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

  const toggleConditionLock = (key: string) =>
    setBoard((s) => ({
      ...s,
      conditions: s.conditions.map((c) =>
        c.key === key ? { ...c, locked: !c.locked } : c
      ),
    }));

  const toggleBudgetLock = (id: string) =>
    setBoard((s) => ({
      ...s,
      budget: s.budget.map((x) =>
        x.id === id ? { ...x, confirmed: !x.confirmed } : x
      ),
    }));

  // 입력(날씨) 변경 → 영향 산출물 stale + 재기획 배너 (DATA_MODEL §1.6).
  const changeWeather = () =>
    setBoard((s) => ({
      ...s,
      weather: { label: "비", temp: "16°", pop: 70, stale: true },
      budget: s.budget.map((x) =>
        x.confirmed ? x : { ...x, stale: true } // 확정 항목은 안 건드림
      ),
      replan: { changedInputs: ["날씨(강수확률 ↑50%)", "장소(우천 대비 동선)"] },
    }));

  // 재기획: 계획(미확정) 항목만 재배분, 확정·집행 유지 + stale 해제 + vN+1.
  const doReplan = () =>
    setBoard((s) => {
      const planPool = s.budget
        .filter((x) => !x.confirmed)
        .reduce((sum, x) => sum + x.planned, 0);
      let i = 0;
      const reweights = [0.42, 0.28, 0.3]; // 재배분 비율(데모)
      const nonConfirmed = s.budget.filter((x) => !x.confirmed);
      return {
        ...s,
        proposalVersion: s.proposalVersion + 1,
        weather: { ...s.weather, stale: false },
        replan: null,
        budget: s.budget.map((x) => {
          if (x.confirmed) return { ...x, stale: false }; // 확정 유지
          const w = reweights[i % reweights.length] ?? 1 / nonConfirmed.length;
          i += 1;
          return { ...x, planned: Math.round((planPool * w) / 10000) * 10000, stale: false };
        }),
      };
    });

  const dismissReplan = () => setBoard((s) => ({ ...s, replan: null }));

  return { board, toggleConditionLock, toggleBudgetLock, changeWeather, doReplan, dismissReplan };
}
