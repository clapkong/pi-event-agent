// Pi Extension — estimate_budget (B3.1). 결정론적 예산 배분(LLM 아님, 코드 계산).
// PI_INTEGRATION §4: defineTool + TypeBox 스키마.

import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";

// 행사 유형별 배분 비율(합 1.0). 데모용 정책.
const RATIOS: Record<string, Record<string, number>> = {
  default: { 장소: 0.3, 케이터링: 0.32, 연사: 0.18, 기념품: 0.1, 예비비: 0.1 },
  밋업: { 장소: 0.28, 케이터링: 0.34, 연사: 0.2, 기념품: 0.08, 예비비: 0.1 },
  워크숍: { 장소: 0.35, 케이터링: 0.3, 강사: 0.2, 교구: 0.07, 예비비: 0.08 },
  채용설명회: { 장소: 0.34, 케이터링: 0.26, 부스: 0.22, 자료: 0.1, 예비비: 0.08 },
};

function pickRatios(eventType: string) {
  const key = Object.keys(RATIOS).find((k) => k !== "default" && eventType.includes(k));
  return RATIOS[key ?? "default"];
}

export const estimateBudget = defineTool({
  name: "estimate_budget",
  label: "예산 산정",
  description:
    "행사 유형·인원·총예산을 받아 항목별 금액으로 결정론적으로 배분한다. 예산 계획·분배가 필요할 때 사용.",
  parameters: Type.Object({
    eventType: Type.String({ description: "행사 유형 (예: 개발자 밋업, 워크숍, 채용설명회)" }),
    headcount: Type.Number({ description: "예상 인원" }),
    totalBudget: Type.Number({ description: "총예산(원)" }),
  }),
  async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
    const { eventType, headcount, totalBudget } = params as {
      eventType: string;
      headcount: number;
      totalBudget: number;
    };
    const ratios = pickRatios(eventType);
    const items = Object.entries(ratios).map(([name, r]) => ({
      name,
      amount: Math.round((totalBudget * r) / 10000) * 10000, // 만원 단위 반올림
      ratio: r,
    }));
    const allocated = items.reduce((s, i) => s + i.amount, 0);
    const result = {
      eventType,
      headcount,
      totalBudget,
      perPerson: Math.round(totalBudget / Math.max(headcount, 1)),
      items,
      allocated,
      diff: totalBudget - allocated,
    };
    // pi 0.79.x AgentToolResult: content = 모델에 돌려줄 블록 배열, details = 구조화 데이터.
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result) }],
      details: result,
    };
  },
});
