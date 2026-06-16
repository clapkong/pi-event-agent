// 모델 레지스트리 (ARCHITECTURE §3.1·§3.2). 이름 문자열로만 참조한다.

export type Provider = "openrouter" | "claude-sdk";

export interface ModelDef {
  /** 화면에 표시할 이름(현재 모델 뱃지). MODELS 키와 동일. */
  name: string;
  provider: Provider;
  /** 프로바이더별 실제 모델 식별자 (OpenRouter 슬러그 / Claude SDK 모델 id). */
  ref: string;
  free?: boolean;
}

// 이름 → 설정. (OpenRouter 기본, claude-sdk는 복잡 추론 전용)
export const MODELS: Record<string, Omit<ModelDef, "name">> = {
  "gpt-4o-mini": { provider: "openrouter", ref: "openai/gpt-4o-mini" },
  haiku: { provider: "openrouter", ref: "anthropic/claude-3.5-haiku" },
  "free-llama": {
    provider: "openrouter",
    ref: "meta-llama/llama-3.3-70b-instruct:free",
    free: true,
  },
  "free-qwen": {
    provider: "openrouter",
    ref: "qwen/qwen-2.5-72b-instruct:free",
    free: true,
  },
  "claude-sonnet": { provider: "claude-sdk", ref: "claude-sonnet-4-6" }, // 복잡 추론 전용
  "claude-opus": { provider: "claude-sdk", ref: "claude-opus-4-8" },
};

export function getModelDef(name: string): ModelDef {
  const def = MODELS[name];
  if (!def) throw new Error(`unknown model: ${name}`);
  return { name, ...def };
}

// 작업/에이전트별 [선호, 대체…] 체인. 앞이 안되면 뒤로 폴백.
export const MODEL_CHAINS: Record<string, string[]> = {
  default: ["gpt-4o-mini", "free-llama", "free-qwen"],
  "risk-assessment": ["claude-sonnet", "gpt-4o-mini", "free-llama"],
  "emergency-playbook": ["claude-sonnet", "gpt-4o-mini"],
  "proposal-final": ["claude-sonnet", "gpt-4o-mini"],
};
