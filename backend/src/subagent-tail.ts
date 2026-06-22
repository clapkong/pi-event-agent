// subagent-tail.ts — 서브에이전트(researcher/writer/critic)의 내부 출력을 흘려보낸다.
// pi-subagents 는 서브 대화를 tmp 의 <agentId>.output(JSONL)로 turn 마다 append 한다.
// 그 폴더를 watch 해서 새 줄을 파싱→텍스트만 뽑아 콜백으로 전달(부모 rpc 엔 안 오는 정보).
// 경로·포맷은 pi-subagents output-file.ts 를 그대로 복제(버전 바뀌면 깨질 수 있음 → 실패해도 무해).
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, watch } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** pi-subagents encodeCwd 동일 구현. */
function encodeCwd(cwd: string): string {
  return cwd
    .replace(/[/\\]/g, "-")
    .replace(/^[A-Za-z]:-/, "")
    .replace(/^-+/, "");
}

/** 서브에이전트 출력 폴더: tmp/pi-subagents-<uid>/<encoded-cwd>/<sessionId>/tasks */
export function tasksDir(cwd: string, sessionId: string): string {
  return join(tmpdir(), `pi-subagents-${process.getuid?.() ?? 0}`, encodeCwd(cwd), sessionId, "tasks");
}

/** JSONL 한 줄에서 보여줄 텍스트만 추출(assistant 본문·tool 호출명). */
function extractText(entry: unknown): string {
  const m = (entry as { message?: { content?: unknown } })?.message;
  const c = m?.content;
  if (typeof c === "string") return c.trim();
  if (Array.isArray(c)) {
    return c
      .map((b) => {
        const blk = b as { type?: string; text?: string; name?: string; thinking?: string };
        if (blk.type === "text") return blk.text ?? "";
        if (blk.type === "thinking") return blk.thinking ?? "";
        if (blk.type === "tool_use") return `→ ${blk.name ?? "tool"}`;
        return "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();
  }
  return "";
}

/**
 * 워크스페이스의 서브에이전트 출력 폴더를 watch. 새로 append 된 줄만 onText 로 흘린다.
 * 시작 시점의 기존 파일은 offset 을 끝으로 잡아 과거 출력은 재전송하지 않는다.
 * 반환: 정리 함수.
 */
export function watchSubagents(
  cwd: string,
  sessionId: string,
  onText: (agentId: string, text: string) => void,
): () => void {
  const dir = tasksDir(cwd, sessionId);
  const offsets = new Map<string, number>(); // 파일명 → 소비한 바이트
  try {
    mkdirSync(dir, { recursive: true });
    // 기존 파일은 끝부터(과거 출력 무시)
    for (const f of readdirSync(dir)) {
      if (f.endsWith(".output")) offsets.set(f, statSync(join(dir, f)).size);
    }
  } catch {
    /* 폴더 못 만듦/접근 불가 → 그냥 watch 시도 */
  }

  const pump = (file: string) => {
    if (!file.endsWith(".output")) return;
    const full = join(dir, file);
    if (!existsSync(full)) return;
    let content: string;
    try {
      content = readFileSync(full, "utf-8");
    } catch {
      return;
    }
    const from = offsets.get(file) ?? 0;
    if (content.length <= from) return;
    offsets.set(file, content.length);
    const agentId = file.replace(/\.output$/, "");
    for (const line of content.slice(from).split("\n")) {
      if (!line.trim()) continue;
      let entry: unknown;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      const text = extractText(entry);
      if (text) onText(agentId, text);
    }
  };

  let watcher: ReturnType<typeof watch> | null = null;
  try {
    watcher = watch(dir, (_evt, filename) => {
      if (filename) pump(filename.toString());
    });
  } catch {
    /* watch 미지원 → 폴링이 받쳐줌 */
  }

  // ⭐ fs.watch 는 macOS 에서 파일 append 를 자주 못 잡는다(생성만 알리거나 누락).
  //    그래서 폴링으로 보강 — offset 기반이라 중복 전송 없음. 서브에이전트 출력이 확실히 흐른다.
  const poll = setInterval(() => {
    try {
      for (const f of readdirSync(dir)) pump(f);
    } catch {
      /* 폴더 아직 없음 등 → 다음 틱에 재시도 */
    }
  }, 700);

  return () => {
    clearInterval(poll);
    try {
      watcher?.close();
    } catch {
      /* 이미 닫힘 */
    }
  };
}
