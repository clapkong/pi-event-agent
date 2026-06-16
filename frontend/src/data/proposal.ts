// S5 제안서 문서 + 버전 이력 + 인용 (F5.1·F5.2) — mock. DATA_MODEL §2·§4.
// ⚠️ mock — 실제는 B3 proposal-writer Skill 산출물 + pgvector 인용으로 교체.

export interface LockChip {
  label: string; // 예: "인원 200명"
}
export type Block =
  | { id: string; kind: "h"; text: string }
  | { id: string; kind: "p"; text: string; locks?: LockChip[]; cites?: number[] };

// 노션식 편집 블록. 확정값은 inline 잠금 칩, 인용은 위첨자 #N.
export const PROPOSAL_BLOCKS: Block[] = [
  { id: "t", kind: "h", text: "프론트엔드 밋업 200명 — 행사 제안서" },
  {
    id: "p1",
    kind: "p",
    text: "본 행사는 개발자 커뮤니티 네트워킹과 기술 공유를 목적으로 한다. 규모와 형식은 작년 가을 야외 밋업 사례를 근거로 설계했다.",
    cites: [1],
  },
  {
    id: "p2",
    kind: "p",
    text: "참석 규모는 확정값으로 고정하며, 장소는 우천에 대비해 실내·외 동시 운영이 가능한 곳으로 선정한다.",
    locks: [{ label: "인원 200명" }, { label: "장소 성수 이벤트홀" }],
    cites: [2],
  },
  { id: "h2", kind: "h", text: "예산 개요" },
  {
    id: "p3",
    kind: "p",
    text: "총 예산 500만원을 장소·케이터링·연사·기념품으로 배분한다. 장소·케이터링은 확정, 나머지는 계획 단계로 우천 시나리오에 따라 재배분될 수 있다.",
    locks: [{ label: "총예산 500만원" }],
    cites: [3],
  },
];

export type Author = "ai" | "human";
export interface Version {
  v: number;
  author: Author;
  at: string;
  summary: string;
}
export const VERSIONS: Version[] = [
  { v: 1, author: "ai", at: "09-12 14:20", summary: "초안 생성 (사례 #1 기반)" },
  { v: 2, author: "human", at: "09-14 10:05", summary: "인원·장소 확정🔒, 문구 수정" },
  { v: 3, author: "ai", at: "09-27 16:40", summary: "우천 재기획 반영 (계획 예산 재배분)" },
];

export interface Citation {
  n: number;
  caseId: string;
  caseTitle: string;
  meta: string;
  scores: { hybrid: number; vector: number; bm25: number };
  excerpt: string;
  source: string;
}
export const CITATIONS: Record<number, Citation> = {
  1: {
    n: 1,
    caseId: "c-meetup-2024",
    caseTitle: "2024 가을 개발자 밋업",
    meta: "야외 · 180명 · 성수 · 만족도 4.6",
    scores: { hybrid: 0.89, vector: 0.85, bm25: 0.71 },
    excerpt: "야외 네트워킹 중심 구성이 만족도를 끌어올렸다. 우천 대비 천막을 미리 확보한 것이 주효.",
    source: "Extension case_get · pgvector",
  },
  2: {
    n: 2,
    caseId: "c-hire-2024",
    caseTitle: "2024 채용설명회",
    meta: "실내 · 150명 · 강남 · 만족도 4.2",
    scores: { hybrid: 0.74, vector: 0.78, bm25: 0.55 },
    excerpt: "실내 단독 운영은 우천엔 안전했으나 네트워킹 동선이 좁았다.",
    source: "Extension case_get · pgvector",
  },
  3: {
    n: 3,
    caseId: "c-meetup-2024",
    caseTitle: "2024 가을 개발자 밋업",
    meta: "야외 · 180명 · 성수 · 만족도 4.6",
    scores: { hybrid: 0.81, vector: 0.8, bm25: 0.64 },
    excerpt: "예산은 케이터링 비중을 높인 배분이 호평. 기념품은 최소화해도 만족도 영향 적음.",
    source: "Extension case_get · pgvector",
  },
};
