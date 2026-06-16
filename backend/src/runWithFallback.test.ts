// 폴백 단위 테스트 (B1 완료 기준): 토큰 없으면 Claude 건너뛰고 OpenRouter로, 전환 시 notify.
// 실행: npm test  (node --test)

import { test } from "node:test";
import assert from "node:assert/strict";
import { runWithFallback, type FallbackNotify } from "./runWithFallback.ts";
import type { ModelDef } from "./models.ts";

function recorder() {
  const currents: string[] = [];
  const switches: { from?: string; to: string; reason: string }[] = [];
  const notify: FallbackNotify = {
    current: (name) => currents.push(name),
    switched: (from, to, reason) => switches.push({ from, to, reason }),
  };
  return { currents, switches, notify };
}

test("Claude 토큰 없으면 claude-sdk 건너뛰고 OpenRouter로 폴백 + 전환 통지", async () => {
  delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
  const { currents, switches, notify } = recorder();
  let used: ModelDef | undefined;

  const result = await runWithFallback(
    "risk-assessment", // [claude-sonnet, gpt-4o-mini, free-llama]
    async (m) => {
      used = m;
      return `ok:${m.name}`;
    },
    notify
  );

  assert.equal(result, "ok:gpt-4o-mini"); // claude 건너뛰고 gpt-4o-mini 사용
  assert.equal(used?.provider, "openrouter");
  assert.deepEqual(currents, ["gpt-4o-mini"]); // 실제 사용된 현재 모델
  assert.equal(switches.length, 1);
  assert.equal(switches[0].to, "gpt-4o-mini");
  assert.match(switches[0].reason, /구독 토큰 없음/);
});

test("run 실패 시 다음 모델로 폴백", async () => {
  delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
  const { currents, switches, notify } = recorder();

  const result = await runWithFallback(
    "default", // [gpt-4o-mini, free-llama, free-qwen]
    async (m) => {
      if (m.name === "gpt-4o-mini") throw new Error("rate limit");
      return `ok:${m.name}`;
    },
    notify
  );

  assert.equal(result, "ok:free-llama");
  assert.deepEqual(currents, ["gpt-4o-mini", "free-llama"]);
  assert.equal(switches.length, 1);
  assert.equal(switches[0].from, "gpt-4o-mini");
  assert.equal(switches[0].to, "free-llama");
});

test("Claude 토큰 있으면 claude-sonnet 먼저 사용", async () => {
  process.env.CLAUDE_CODE_OAUTH_TOKEN = "test-token";
  const { currents, notify } = recorder();

  const result = await runWithFallback(
    "proposal-final", // [claude-sonnet, gpt-4o-mini]
    async (m) => `ok:${m.name}`,
    notify
  );

  assert.equal(result, "ok:claude-sonnet");
  assert.deepEqual(currents, ["claude-sonnet"]);
  delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
});
