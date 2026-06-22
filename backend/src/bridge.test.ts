// bridge.test.ts — 순수 변환 검증 (pi 없이). 실행: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyElement, contractToRpc, rpcToContract } from "./bridge.ts";
import type { PendingUi } from "./rpc.ts";

const noop = (_p: PendingUi | null) => {};

test("rpc → contract: text_delta", () => {
  const out = rpcToContract(
    { type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "안녕" } },
    noop,
  );
  assert.deepEqual(out, { type: "text_delta", delta: "안녕" });
});

test("rpc → contract: thinking_delta", () => {
  const out = rpcToContract(
    { type: "message_update", assistantMessageEvent: { type: "thinking_delta", delta: "생각" } },
    noop,
  );
  assert.deepEqual(out, { type: "thinking_delta", delta: "생각" });
});

test("rpc → contract: model_current (assistant message_start)", () => {
  const out = rpcToContract(
    { type: "message_start", message: { role: "assistant", model: "google/gemini-2.5-flash" } },
    noop,
  );
  assert.deepEqual(out, { type: "model_current", name: "google/gemini-2.5-flash" });
});

test("rpc → contract: tool_start + element 분류", () => {
  assert.deepEqual(rpcToContract({ type: "tool_execution_start", toolName: "rag_query" }, noop), {
    type: "tool_start",
    label: "rag_query",
    tool: "rag_query",
    element: "Extension",
  });
  assert.equal(classifyElement("web_search"), "MCP");
  assert.equal(classifyElement("researcher"), "Tool");
});

test("rpc → contract: 서브에이전트 스폰(Agent)은 subagent_type 으로 라벨", () => {
  const out = rpcToContract(
    { type: "tool_execution_start", toolName: "Agent", args: { subagent_type: "critic" } },
    noop
  );
  assert.deepEqual(out, { type: "tool_start", label: "critic · 검토", tool: "Agent", element: "Tool" });
});

test("rpc → contract: ask(select) 가 pending 설정", () => {
  let pending: PendingUi | null = null;
  const out = rpcToContract(
    { type: "extension_ui_request", id: "x7", method: "select", title: "장소", options: ["A", "B"] },
    (p) => (pending = p),
  );
  assert.deepEqual(out, { type: "ask", question: "장소", options: ["A", "B"] });
  assert.deepEqual(pending, { id: "x7", method: "select" });
});

test("rpc → contract: gate(confirm)", () => {
  let pending: PendingUi | null = null;
  const out = rpcToContract(
    { type: "extension_ui_request", id: "g1", method: "confirm", title: "발송할까요?" },
    (p) => (pending = p),
  );
  assert.deepEqual(out, { type: "gate", question: "발송할까요?" });
  assert.deepEqual(pending, { id: "g1", method: "confirm" });
});

test("rpc → contract: 표시용 ui 요청(setStatus/notify)은 무시(ask 아님)", () => {
  assert.equal(rpcToContract({ type: "extension_ui_request", id: "s1", method: "setStatus" }, noop), null);
  assert.equal(rpcToContract({ type: "extension_ui_request", id: "n1", method: "notify", message: "hi" }, noop), null);
});

test("rpc → contract: agent_end→done, error, 무시", () => {
  assert.deepEqual(rpcToContract({ type: "agent_end" }, noop), { type: "done" });
  assert.deepEqual(rpcToContract({ type: "response", command: "prompt", success: false, error: "boom" }, noop), {
    type: "error",
    message: "boom",
  });
  assert.equal(rpcToContract({ type: "agent_start" }, noop), null);
  assert.equal(rpcToContract({ type: "response", command: "prompt", success: true }, noop), null);
});

test("contract → rpc: prompt / abort", () => {
  assert.deepEqual(contractToRpc({ kind: "prompt", text: "행사 기획" }, null), {
    type: "prompt",
    message: "행사 기획",
  });
  assert.deepEqual(contractToRpc({ kind: "abort" }, null), { type: "abort" });
});

test("contract → rpc: answer 는 pending.method 에 따라 value/confirmed", () => {
  assert.deepEqual(contractToRpc({ kind: "answer", choice: "성수홀" }, { id: "x7", method: "select" }), {
    type: "extension_ui_response",
    id: "x7",
    value: "성수홀",
  });
  assert.deepEqual(contractToRpc({ kind: "answer", choice: "승인" }, { id: "g1", method: "confirm" }), {
    type: "extension_ui_response",
    id: "g1",
    confirmed: true,
  });
  assert.deepEqual(contractToRpc({ kind: "answer", choice: "거절" }, { id: "g1", method: "confirm" }), {
    type: "extension_ui_response",
    id: "g1",
    confirmed: false,
  });
  // 대기 없으면 버림
  assert.equal(contractToRpc({ kind: "answer", choice: "x" }, null), null);
});
