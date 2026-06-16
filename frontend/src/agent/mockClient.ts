// agent/mockClient.ts — 스크립트 런 재생 (TASKS F1.3).
//
// 시퀀스: case_search(Extension) → ask(되묻기) → estimate_budget(Extension)
//        → gate(승인) → proposal-writer(Skill) 스트리밍, 중간 model_switch 1회.
// 실제 Pi 없이 계약(contract.ts) 형태로만 이벤트를 흘린다. 백엔드(B2)가 같은
// 형태를 구현하면 프런트는 무수정.

import type { AgentClient, AgentEvent, AgentEventHandler } from "./contract.ts";

export function createMockClient(): AgentClient {
  const handlers = new Set<AgentEventHandler>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let aborted = false;
  let resolvePending: ((choice: string) => void) | null = null;

  const emit = (e: AgentEvent) => {
    for (const h of handlers) h(e);
  };

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      const t = setTimeout(() => {
        timers.delete(t);
        resolve();
      }, ms);
      timers.add(t);
    });

  // 되묻기/게이트에서 사용자 응답을 기다린다.
  const waitForAnswer = () =>
    new Promise<string>((resolve) => {
      resolvePending = resolve;
    });

  // 텍스트를 글자 묶음 단위로 흘려 스트리밍을 흉내낸다.
  async function streamText(text: string, chunk = 3, delay = 28) {
    for (let i = 0; i < text.length; i += chunk) {
      if (aborted) return;
      emit({ type: "text_delta", delta: text.slice(i, i + chunk) });
      await sleep(delay);
    }
  }

  async function run() {
    emit({ type: "model_current", name: "claude-3.5-haiku" });
    await sleep(180);

    // 1) 과거 사례 검색 (Extension)
    emit({
      type: "tool_start",
      label: "과거 사례 검색",
      tool: "case_search",
      element: "Extension",
    });
    await sleep(520);
    if (aborted) return;
    emit({ type: "tool_end", result: "관련 사례 3건 · 야외 200명", citation: 1 });
    await streamText("작년 가을 야외 밋업과 규모가 비슷한 사례를 찾았어요. ");

    // 2) 되묻기 (ask)
    if (aborted) return;
    emit({
      type: "ask",
      question: "장소는 실내·실외 중 어디로 진행할까요?",
      options: ["실내", "실외", "상관없음"],
    });
    const place = await waitForAnswer();
    if (aborted) return;
    await streamText(`${place}(으)로 잡고 예산을 짜볼게요. `);

    // 3) 예산 산정 (Extension)
    emit({
      type: "tool_start",
      label: "예산 산정",
      tool: "estimate_budget",
      element: "Extension",
    });
    await sleep(520);
    if (aborted) return;
    emit({ type: "tool_end", result: "총 500만원 항목별 배분", citation: 2 });

    // 중간 모델 전환 토스트 1회 (잠정, V0 확인 대상)
    emit({
      type: "model_switch",
      from: "claude-3.5-haiku",
      to: "gpt-4o-mini",
      reason: "Claude 사용량 한도 — 자동 폴백",
    });
    emit({ type: "model_current", name: "gpt-4o-mini" });
    await sleep(180);

    // 4) 승인 게이트 (gate) — 통과 전 제안서 작성으로 못 넘어감
    if (aborted) return;
    emit({ type: "gate", question: "이 예산안으로 제안서를 작성할까요?" });
    await waitForAnswer();
    if (aborted) return;

    // 5) 제안서 작성 (Skill)
    emit({
      type: "tool_start",
      label: "제안서 작성",
      tool: "proposal-writer",
      element: "Skill",
    });
    await sleep(420);
    await streamText(
      "제안서 초안을 작성합니다. 행사 개요 · 예산 · 진행 타임라인 순으로 정리할게요. "
    );
    if (aborted) return;
    emit({ type: "tool_end", result: "proposal-v1.md 생성", citation: 3 });

    if (aborted) return;
    emit({ type: "done" });
  }

  return {
    subscribe(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    prompt() {
      aborted = false;
      void run();
    },
    answer(choice) {
      const resolve = resolvePending;
      resolvePending = null;
      resolve?.(choice);
    },
    abort() {
      aborted = true;
      for (const t of timers) clearTimeout(t);
      timers.clear();
      resolvePending = null;
    },
  };
}
