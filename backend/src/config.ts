// config.ts — 상수 한 곳. 바뀌는 값은 여기서만.
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** 레포 루트 (backend/src 에서 두 단계 위). .pi/ 의 기준. */
export const REPO_ROOT = resolve(__dirname, "..", "..");

/** 데이터 루트 — 행사 작업폴더(workspace/)와 공용 사례(cases/)의 공통 부모: `data/`. */
export const DATA_ROOT = resolve(REPO_ROOT, "data");

// 레포 루트 .env 로드 → OPENROUTER·GOOGLE_MAPS 키가 process.env 에 들어가고,
// pi 자식 프로세스가 이를 상속한다. maps MCP 의 ${GOOGLE_MAPS_API_KEY} 치환이 여기 의존 —
// 백엔드가 .env 를 안 읽으면 maps 서버가 키 없이 떠서 "Connection closed" 로 죽는다.
try {
  const envPath = resolve(REPO_ROOT, ".env");
  if (existsSync(envPath)) process.loadEnvFile(envPath);
} catch {
  /* .env 없음/미지원 → 셸 env 그대로 사용 */
}

export const PORT = Number(process.env.PORT ?? 8787);

/** 바인딩 호스트. 로컬은 127.0.0.1(기본), 컨테이너는 HOST=0.0.0.0 로 외부 포워딩 수신. */
export const HOST = process.env.HOST ?? "127.0.0.1";

/** pi 실행 인자. 워크스페이스별 cwd + 세션은 ws-handler 에서 --session-id 로 붙인다. */
export const PI_BIN = "pi";
export const PI_BASE_ARGS = ["--mode", "rpc"] as const;
