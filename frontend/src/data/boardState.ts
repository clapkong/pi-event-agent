// S4 작업공간 상태 모델 (F4.1) — DATA_MODEL §1·§2.
// 세 겹(입력/가정·기획 산출·실행/확정) + 두 꼬리표(잠금·신선도) + 예산 3상태 + 업체 4단계 + 재기획.
// ⚠️ mock — 실제 데이터는 백엔드(B3 도구 출력)로 교체.

import { useState } from "react";

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

const won = (n: number) => n;

function seed(): BoardState {
  return {
    stage: "진행중",
    budgetTotal: won(5_000_000),
    proposalVersion: 2,
    conditions: [
      { key: "type", label: "유형", value: "개발자 밋업", locked: true },
      { key: "headcount", label: "인원", value: "200명", locked: true },
      { key: "venue", label: "장소", value: "서울 성수 (야외 가능)", locked: false },
      { key: "date", label: "날짜", value: "가을 (10월 중)", locked: false },
    ],
    budget: [
      { id: "b1", name: "장소 대여", planned: won(1_400_000), confirmed: true, spent: won(1_400_000), stale: false },
      { id: "b2", name: "케이터링", planned: won(1_600_000), confirmed: true, spent: 0, stale: false },
      { id: "b3", name: "연사 사례비", planned: won(1_000_000), confirmed: false, spent: 0, stale: false },
      { id: "b4", name: "기념품·자료", planned: won(600_000), confirmed: false, spent: 0, stale: false },
      { id: "b5", name: "예비비", planned: won(400_000), confirmed: false, spent: 0, stale: false },
    ],
    vendors: [
      { id: "v1", name: "성수 이벤트홀", category: "장소", stage: "계약" },
      { id: "v2", name: "데일리케이터링", category: "케이터링", stage: "확정" },
      { id: "v3", name: "프린트팜", category: "인쇄", stage: "견적" },
      { id: "v4", name: "사운드렌탈", category: "음향", stage: "후보" },
    ],
    weather: { label: "맑음", temp: "21°", pop: 20, stale: false },
    venue: { name: "서울 성수동 이벤트홀", note: "야외 마당 + 실내 홀 동시" },
    milestones: [
      { dday: -12, title: "장소 계약", due: "09-18", status: "done", owner: "기획팀" },
      { dday: -3, title: "케이터링 인원 확정", due: "09-27", status: "upcoming", owner: "기획팀" },
      { dday: 0, title: "행사 당일", due: "09-30", status: "upcoming", owner: "전체" },
      { dday: 7, title: "정산·사례 적립", due: "10-07", status: "upcoming", owner: "에이전트" },
    ],
    replan: null,
  };
}

// 예산 3상태 합계 (DESIGN §2.6 막대: 집행 │ 확정·미집행 │ 계획 잔여).
export function budgetSegments(b: BudgetItem[]) {
  const spent = b.reduce((s, x) => s + x.spent, 0);
  const committed = b.reduce((s, x) => s + (x.confirmed ? Math.max(x.planned - x.spent, 0) : 0), 0);
  const planned = b.reduce((s, x) => s + (x.confirmed ? 0 : x.planned), 0);
  return { spent, committed, planned, total: spent + committed + planned };
}

/** 보드 상태 + 액션 (mock 인터랙션: 잠금 토글·입력 변경·재기획). */
export function useBoard(_wsId: string) {
  const [board, setBoard] = useState<BoardState>(seed);

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
