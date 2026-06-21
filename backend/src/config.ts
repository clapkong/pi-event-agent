// config.ts — 상수 한 곳. 바뀌는 값은 여기서만.
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** 레포 루트 (backend/src 에서 두 단계 위). .pi/ · workspace/ 의 기준. */
export const REPO_ROOT = resolve(__dirname, "..", "..");

export const PORT = Number(process.env.PORT ?? 8787);

/** pi 실행 인자. 워크스페이스별 cwd + 세션은 ws-handler 에서 --session-id 로 붙인다. */
export const PI_BIN = "pi";
export const PI_BASE_ARGS = ["--mode", "rpc"] as const;

/** 배관만 싸게 테스트할 때(PI_SMOKE=1): 풀 에이전트(.pi/ 컨텍스트·확장·skill) 끔. */
export const SMOKE = process.env.PI_SMOKE === "1";
