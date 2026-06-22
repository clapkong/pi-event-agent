// 사례 타입 — 데이터는 백엔드 /api/cases(cases/*.md frontmatter 파싱, pi-local-rag와 같은 소스). mock 없음.

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
  budgetActual: CaseBudgetItem[];
  body: string; // 사례 전문(마크다운)
}
