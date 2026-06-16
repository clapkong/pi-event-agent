import { useEffect, useRef } from "react";
import type { Workspace } from "@/data/workspaces";
import { useAgentRun } from "@/agent/useAgentRun";
import { TopBar } from "./TopBar";
import { Timeline } from "./Timeline";
import { Composer } from "./Composer";
import { ModelToast } from "./ModelToast";
import styles from "./s3.module.css";

// S3 대화·동작 타임라인 (시그니처). mockClient 구동. (F2/F3)
export function S3View({
  ws,
  autostart = false,
  initialPrompt = "",
}: {
  ws: Workspace;
  autostart?: boolean;
  initialPrompt?: string;
}) {
  const { state, start, answerAsk, approveGate, rejectGate, stop } = useAgentRun(ws.id);
  const autostartedRef = useRef(false);

  // 폼(S2)에서 생성돼 들어온 경우 폼 입력(initialPrompt)으로 1회 자동 시작.
  useEffect(() => {
    if (autostart && !autostartedRef.current) {
      autostartedRef.current = true;
      start(initialPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autostart]);

  const { entries, counts } = state;
  const started = entries.length > 0 || state.running;

  return (
    <div className={styles.screen}>
      <TopBar ws={ws} model={state.model} />

      <div className={styles.scroll}>
        {!started ? (
          <div className={styles.empty}>
            <p className={styles.emptyEyebrow}>대화 · 동작 타임라인</p>
            <h2 className={styles.emptyTitle}>기획을 시작하면 진행 과정이 여기 쌓입니다</h2>
            <p className={styles.emptyLead}>
              에이전트가 사례 검색 · 예산 산정 · 제안서 작성을 단계별로 실행하고, 중간에
              되묻거나 승인을 요청합니다.
            </p>
            <button type="button" className={styles.startBtn} onClick={() => start()}>
              기획 시작
            </button>
          </div>
        ) : (
          <div className={styles.feed}>
            <ElementSummary counts={counts} />
            <Timeline
              entries={entries}
              onAnswerAsk={answerAsk}
              onApprove={approveGate}
              onReject={rejectGate}
            />
            {state.finished && !state.error && (
              <p className={styles.endNote}>런 완료 · 산출물은 작업공간(F4)에서 관리됩니다.</p>
            )}
            {state.error && <p className={styles.errNote}>{state.error}</p>}
          </div>
        )}
      </div>

      <Composer running={state.running} onSend={(text) => start(text)} onStop={stop} />

      {state.toast && <ModelToast toast={state.toast} />}
    </div>
  );
}

// 요소 요약 스트립 — "이번 기획에 쓰인 Pi 요소" (SCREENS S3, PLAN §3).
function ElementSummary({ counts }: { counts: Record<string, number> }) {
  return (
    <p className={styles.summary}>
      <span className={styles.summaryLabel}>이번 기획에 쓰인 Pi 요소</span>
      <span className={styles.summaryItems}>
        MCP ×{counts.MCP} · Extension ×{counts.Extension} · Skill ×{counts.Skill}
      </span>
    </p>
  );
}
