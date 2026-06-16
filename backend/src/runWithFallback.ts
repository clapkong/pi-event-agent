// 간단한 폴백 실행기 (ARCHITECTURE §3.3). 체인을 순서대로 시도, 실패 시 다음 모델 + 알림.
// 복잡한 라우팅 엔진 아님 — 작은 try-loop. Claude 구독 토큰 없으면 건너뛰고 OpenRouter로.

import { MODEL_CHAINS, getModelDef, type ModelDef } from "./models.ts";

export interface FallbackNotify {
  /** 현재 사용 모델 통지 (프런트 모델 뱃지). */
  current: (name: string) => void;
  /** 모델 전환 통지 (프런트 토스트). */
  switched: (from: string | undefined, to: string, reason: string) => void;
}

/**
 * 작업 체인을 따라 run(model)을 시도한다.
 * - claude-sdk인데 CLAUDE_CODE_OAUTH_TOKEN 없으면 건너뜀(다음으로 전환 알림).
 * - run 실패 시 다음 모델로 폴백(전환 알림). 마지막까지 실패하면 throw.
 */
export async function runWithFallback<T>(
  task: string,
  run: (model: ModelDef) => Promise<T>,
  notify: FallbackNotify
): Promise<T> {
  const chain = MODEL_CHAINS[task] ?? MODEL_CHAINS.default;
  let prev: string | undefined;
  let lastErr: unknown;

  for (let i = 0; i < chain.length; i++) {
    const name = chain[i];
    const def = getModelDef(name);
    const next = chain[i + 1];

    if (def.provider === "claude-sdk" && !process.env.CLAUDE_CODE_OAUTH_TOKEN) {
      if (next) notify.switched(prev, next, `${name} 사용 불가(구독 토큰 없음)`);
      prev = name;
      continue; // Claude 토큰 없으면 건너뜀
    }

    notify.current(name); // 현재 모델 표시
    try {
      return await run(def);
    } catch (e) {
      lastErr = e;
      if (next) notify.switched(name, next, `${name} 실패 — 폴백`);
      prev = name;
    }
  }
  throw lastErr ?? new Error(`no model available for task: ${task}`);
}
