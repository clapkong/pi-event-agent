/**
 * event-tools — 행사 기획 Pi Extension (과제 "Pi Extension" 요건)
 *
 * 팩토리 모듈 1개에 결정론적 도구 3개 + 가드 훅 3개를 묶음.
 * (검증: pi 0.79.8 — `export default function(pi: ExtensionAPI)`, `defineTool`+`pi.registerTool`,
 *  `pi.on("tool_call", (e,ctx)=>{block,reason})`, `ctx.ui.select`, `ctx.hasUI`, 결과 `{content,details}`.)
 *
 * 상태 계약: `<cwd>/state.json` = frontend/src/data/boardState.ts 의 `BoardState` 모양.
 *   → backend는 이 파일을 읽어 프런트에 서빙하면 됨 (코드 의존 없음).
 *   update_state 가 이 파일의 **유일한 쓰기 통로**이며, 잠금/집행 가드 훅이 쓰기를 강제 검사.
 */

import { promises as fs } from "node:fs";
import { join } from "node:path";
import { StringEnum } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
// ── 상태 타입 (boardState.ts 미러) ───────────────────────────────
interface Condition {
	key: string;
	label: string;
	value: string;
	locked: boolean;
}
interface BudgetItem {
	id: string;
	name: string;
	planned: number;
	confirmed: boolean;
	spent: number;
	stale: boolean;
}
interface Vendor {
	id: string;
	name: string;
	category: string;
	stage: string;
}
interface BoardState {
	stage: "기획" | "진행중" | "정산·완료";
	budgetTotal: number;
	proposalVersion: number;
	conditions: Condition[];
	budget: BudgetItem[];
	vendors: Vendor[];
	weather: { label: string; temp: string; pop: number; stale: boolean };
	venue: { name: string; note: string };
	milestones: { dday: number; title: string; due: string; status: string; owner: string }[];
	replan: { changedInputs: string[] } | null;
}

const KRW = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;

/** patch가 잠금🔒·집행·계약 규칙을 어기면 위반 메시지 목록 반환(빈 배열=통과). */
function guardViolations(cur: BoardState, patch: Partial<BoardState>): string[] {
	const v: string[] = [];
	if (patch.budget) {
		for (const curItem of cur.budget) {
			const next = patch.budget.find((b) => b.id === curItem.id);
			if (!next) continue;
			if (curItem.confirmed && next.planned !== curItem.planned)
				v.push(`잠금 가드: 확정🔒 예산 "${curItem.name}"의 계획액은 변경 불가 (${KRW(curItem.planned)} 유지)`);
			if (curItem.spent > 0 && next.spent < curItem.spent)
				v.push(`집행 가드: 이미 집행된 "${curItem.name}"의 집행액은 줄일 수 없음 (${KRW(curItem.spent)})`);
			if (curItem.spent > 0 && next.planned < curItem.spent)
				v.push(`집행 가드: "${curItem.name}" 계획액이 집행액(${KRW(curItem.spent)})보다 작을 수 없음`);
		}
	}
	if (patch.conditions) {
		for (const curC of cur.conditions) {
			const next = patch.conditions.find((c) => c.key === curC.key);
			if (next && curC.locked && next.value !== curC.value)
				v.push(`잠금 가드: 확정🔒 조건 "${curC.label}"의 값은 변경 불가 ("${curC.value}" 유지)`);
		}
	}
	if (patch.vendors) {
		for (const curV of cur.vendors) {
			const next = patch.vendors.find((x) => x.id === curV.id);
			if (next && curV.stage === "계약" && next.stage !== "계약")
				v.push(`집행 가드: 계약 완료 업체 "${curV.name}"는 이전 단계로 되돌릴 수 없음`);
		}
	}
	return v;
}

// ── 상태 스키마 (boardState.ts 미러) ─────────────────────────────
const VENDOR_STAGES = ["후보", "견적", "확정", "계약"] as const;

const ConditionT = Type.Object({
	key: Type.String(),
	label: Type.String(),
	value: Type.String(),
	locked: Type.Boolean({ description: "확정🔒 여부" }),
});
const BudgetItemT = Type.Object({
	id: Type.String(),
	name: Type.String(),
	planned: Type.Number({ description: "계획 배분액(원)" }),
	confirmed: Type.Boolean({ description: "확정🔒(재기획 제외)" }),
	spent: Type.Number({ description: "집행액(원)" }),
	stale: Type.Boolean({ description: "재검토 필요" }),
});
const VendorT = Type.Object({
	id: Type.String(),
	name: Type.String(),
	category: Type.String(),
	stage: StringEnum(VENDOR_STAGES),
});

const STATE_FILE = (cwd: string) => join(cwd, "state.json");

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

async function readState(cwd: string): Promise<BoardState> {
	try {
		return { ...emptyBoard(), ...JSON.parse(await fs.readFile(STATE_FILE(cwd), "utf-8")) };
	} catch {
		return emptyBoard();
	}
}
async function writeState(cwd: string, s: BoardState): Promise<void> {
	await fs.writeFile(STATE_FILE(cwd), `${JSON.stringify(s, null, 2)}\n`, "utf-8");
}

const round10k = (n: number) => Math.round(n / 10000) * 10000;

// ── 도구 1: estimate_budget (결정론적 배분 + 재배분) ──────────────
const DEFAULT_RATIOS: Record<string, number> = {
	"장소 대여": 0.2,
	케이터링: 0.4,
	"연사·프로그램": 0.2,
	"기념품·자료": 0.1,
	예비비: 0.1,
};

const estimateBudget = defineTool({
	name: "estimate_budget",
	label: "예산 산정",
	description:
		"행사 유형·인원·총예산을 받아 항목별로 결정론적으로 배분한다. mode='replan'이면 state.json의 확정🔒·집행 항목은 보존하고 계획(planned) 항목만 잔여 예산 안에서 재배분한다. 숫자는 LLM이 지어내지 말고 이 도구를 쓸 것.",
	parameters: Type.Object({
		eventType: Type.String({ description: "행사 유형 (예: 사내 워크숍)" }),
		headcount: Type.Number({ description: "참여 인원" }),
		totalBudget: Type.Number({ description: "총예산(원)" }),
		mode: Type.Optional(
			StringEnum(["new", "replan"] as const, {
				description: "new=신규 배분(기본), replan=계획분만 재배분(state.json 필요)",
			}),
		),
	}),
	async execute(_id, params, _signal, _onUpdate, ctx) {
		const { eventType, headcount, totalBudget, mode = "new" } = params;

		if (mode === "replan") {
			const s = await readState(ctx.cwd);
			const reserved = s.budget.reduce((sum, b) => sum + (b.confirmed ? b.planned : Math.max(b.spent, 0)), 0);
			const pool = Math.max(s.budgetTotal - reserved, 0); // 잔여 = 전체 − (확정 + 집행)
			const planItems = s.budget.filter((b) => !b.confirmed);
			const weightTotal = planItems.reduce((sum, b) => sum + Math.max(b.planned, 1), 0);
			const breakdown = planItems.map((b) => ({
				name: b.name,
				planned: round10k((pool * Math.max(b.planned, 1)) / weightTotal),
			}));
			return {
				content: [
					{
						type: "text" as const,
						text: `재배분(잔여 ${KRW(pool)}, 확정·집행 보존):\n${breakdown
							.map((x) => `- ${x.name}: ${KRW(x.planned)}`)
							.join("\n")}\n\n※ 확정🔒·집행 항목은 그대로. update_state로 반영하면 가드가 재검증.`,
					},
				],
				details: { mode, pool, breakdown },
			};
		}

		const breakdown = Object.entries(DEFAULT_RATIOS).map(([name, r]) => ({
			name,
			planned: round10k(totalBudget * r),
			ratio: r,
		}));
		const sum = breakdown.reduce((a, b) => a + b.planned, 0);
		return {
			content: [
				{
					type: "text" as const,
					text: `${eventType} ${headcount}명 / 총 ${KRW(totalBudget)} 배분:\n${breakdown
						.map((x) => `- ${x.name}: ${KRW(x.planned)} (${Math.round(x.ratio * 100)}%)`)
						.join("\n")}\n합계 ${KRW(sum)}${sum !== totalBudget ? ` (반올림 차 ${KRW(totalBudget - sum)})` : ""}\n1인당 ${KRW(totalBudget / headcount)}`,
				},
			],
			details: { mode, totalBudget, headcount, breakdown, sum },
		};
	},
});

// ── 도구 2: build_checklist (결정론적 날짜 계산) ──────────────────
const CHECKLIST = [
	{ dday: 30, title: "장소·예산 확정, 업체 견적 요청" },
	{ dday: 14, title: "업체 계약, 케이터링 메뉴 확정" },
	{ dday: 7, title: "인원 확정, 공지·초청 발송, 보험·신고 확인" },
	{ dday: 1, title: "최종 리허설·물품 점검" },
	{ dday: 0, title: "행사 당일" },
	{ dday: -7, title: "정산·만족도 조사·사례 적립" },
];
const DOW = ["일", "월", "화", "수", "목", "금", "토"];

const buildChecklist = defineTool({
	name: "build_checklist",
	label: "체크리스트 생성",
	description: "행사일(YYYY-MM-DD)을 받아 D-30/14/7/1/당일/D+7 준비 체크리스트와 각 마감일을 결정론적으로 계산한다. 주말 마감은 표시한다.",
	parameters: Type.Object({
		eventDate: Type.String({ description: "행사일 YYYY-MM-DD" }),
	}),
	async execute(_id, params, _signal, _onUpdate, _ctx) {
		const base = new Date(`${params.eventDate}T00:00:00`);
		if (Number.isNaN(base.getTime()))
			return { content: [{ type: "text" as const, text: `날짜 형식 오류: "${params.eventDate}" (YYYY-MM-DD 필요)` }], details: { error: "bad_date" } };
		const fmt = (d: Date) =>
			`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
		const items = CHECKLIST.map((c) => {
			const d = new Date(base);
			d.setDate(d.getDate() - c.dday);
			const iso = fmt(d); // 로컬 기준 (toISOString은 UTC라 KST에서 하루 밀림)
			const dow = DOW[d.getDay()];
			const weekend = d.getDay() === 0 || d.getDay() === 6;
			return { dday: c.dday, title: c.title, due: iso, dow, weekend };
		});
		return {
			content: [
				{
					type: "text" as const,
					text: `행사일 ${params.eventDate} 기준 체크리스트:\n${items
						.map((i) => `- ${i.dday >= 0 ? `D-${i.dday}` : `D+${-i.dday}`} (${i.due} ${i.dow})${i.weekend ? " ⚠️주말" : ""}: ${i.title}`)
						.join("\n")}`,
				},
			],
			details: { eventDate: params.eventDate, items },
		};
	},
});

// ── 도구 3: update_state (보드 쓰기 유일 통로) ────────────────────
const updateState = defineTool({
	name: "update_state",
	label: "상태 업데이트",
	description:
		"행사 보드 상태(state.json)를 변경하는 **유일한 통로**. 제공한 필드만 병합 저장한다. 잠금🔒·집행·계약 규칙 위반은 가드 훅이 자동 차단하므로, 차단되면 reason을 사용자에게 보고할 것. (잠금/집행 항목은 건드리지 말 것.)",
	parameters: Type.Object({
		reason: Type.String({ description: "이 변경의 이유(감사 로그용)" }),
		stage: Type.Optional(StringEnum(["기획", "진행중", "정산·완료"] as const)),
		budgetTotal: Type.Optional(Type.Number()),
		proposalVersion: Type.Optional(Type.Number()),
		conditions: Type.Optional(Type.Array(ConditionT)),
		budget: Type.Optional(Type.Array(BudgetItemT)),
		vendors: Type.Optional(Type.Array(VendorT)),
		venue: Type.Optional(Type.Object({ name: Type.String(), note: Type.String() })),
		weather: Type.Optional(
			Type.Object({ label: Type.String(), temp: Type.String(), pop: Type.Number(), stale: Type.Boolean() }),
		),
	}),
	async execute(_id, params, _signal, _onUpdate, ctx) {
		const cur = await readState(ctx.cwd);
		const { reason: _reason, ...patch } = params;
		const next: BoardState = { ...cur, ...(patch as Partial<BoardState>) };
		await writeState(ctx.cwd, next);
		const changed = Object.keys(patch);
		return {
			content: [{ type: "text" as const, text: `state.json 갱신: [${changed.join(", ")}] (v${next.proposalVersion})` }],
			details: { changed, state: next },
		};
	},
});

// ── Extension 팩토리 ─────────────────────────────────────────────
const APPROVAL_TOOLS = new Set(["send_email", "rag_index"]); // 발송·사례 적립

export default function (pi: ExtensionAPI) {
	pi.registerTool(estimateBudget);
	pi.registerTool(buildChecklist);
	pi.registerTool(updateState);

	// 훅 ①② 잠금·집행 가드 — update_state 쓰기를 가로채 강제 검사
	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName !== "update_state") return undefined;
		const cur = await readState(ctx.cwd);
		const violations = guardViolations(cur, event.input as Partial<BoardState>);
		if (violations.length > 0) {
			return { block: true, reason: `상태 가드 차단:\n- ${violations.join("\n- ")}` };
		}
		return undefined;
	});

	// 훅 ③ 승인 게이트 — 발송·적립 직전 사람 승인 없으면 차단
	pi.on("tool_call", async (event, ctx) => {
		if (!APPROVAL_TOOLS.has(event.toolName)) return undefined;
		if (!ctx.hasUI) return { block: true, reason: `승인 게이트: UI 없는 모드에서 ${event.toolName} 차단(사람 승인 불가)` };
		const choice = await ctx.ui.select(`⚠️ 외부로 나가는 작업입니다: ${event.toolName}\n승인하시겠습니까?`, ["승인", "거부"]);
		if (choice !== "승인") return { block: true, reason: "승인 게이트: 사용자가 거부함" };
		return undefined;
	});
}
