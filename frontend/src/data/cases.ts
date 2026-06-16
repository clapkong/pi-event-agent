// S6 사례 DB + 역추적 (F5.3) — mock. DATA_MODEL §4.
// ⚠️ mock — 실제는 B3 pgvector 사례 DB(case_get/case_search)로 교체.

export interface CaseBudgetItem {
  name: string;
  amount: number;
}
export interface Case {
  id: string;
  title: string;
  type: string;
  headcount: number;
  venue: string;
  date: string;
  satisfaction: number;
  summary: string; // 사례 전문(명조)
  budgetActual: CaseBudgetItem[];
  /** 이 사례를 인용한 행사들(역추적) — workspace id·name */
  citedBy: { wsId: string; name: string }[];
}

export const CASES: Record<string, Case> = {
  "c-meetup-2024": {
    id: "c-meetup-2024",
    title: "2024 가을 개발자 밋업",
    type: "개발자 밋업",
    headcount: 180,
    venue: "서울 성수",
    date: "2024-10-12",
    satisfaction: 4.6,
    summary:
      "야외 네트워킹을 중심으로 구성한 180명 규모 밋업. 우천 대비 천막과 실내 백업 공간을 미리 확보해 당일 비에도 차질이 없었다. 케이터링 비중을 높이고 기념품은 최소화한 예산 배분이 만족도(4.6)에 긍정적이었다. 교훈: 야외는 반드시 우천 백업, 케이터링이 만족도 핵심.",
    budgetActual: [
      { name: "장소·천막", amount: 1_300_000 },
      { name: "케이터링", amount: 1_800_000 },
      { name: "연사", amount: 900_000 },
      { name: "기념품", amount: 400_000 },
    ],
    citedBy: [{ wsId: "w-meetup-200", name: "프론트엔드 밋업 200명" }],
  },
  "c-hire-2024": {
    id: "c-hire-2024",
    title: "2024 채용설명회",
    type: "채용설명회",
    headcount: 150,
    venue: "서울 강남",
    date: "2024-09-03",
    satisfaction: 4.2,
    summary:
      "실내 단독 운영 150명 채용설명회. 우천에 안전했지만 네트워킹 동선이 좁아 후반부 혼잡. 교훈: 실내는 동선·휴게 공간을 넉넉히.",
    budgetActual: [
      { name: "장소", amount: 2_000_000 },
      { name: "케이터링", amount: 1_500_000 },
      { name: "부스·자료", amount: 1_200_000 },
    ],
    citedBy: [
      { wsId: "w-meetup-200", name: "프론트엔드 밋업 200명" },
      { wsId: "w-hire-day", name: "하반기 채용설명회" },
    ],
  },
};

export const CASE_LIST = Object.values(CASES);
