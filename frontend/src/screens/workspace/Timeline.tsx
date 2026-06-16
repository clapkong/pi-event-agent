import type { TimelineEntry, ToolEntry } from "@/agent/useAgentRun";
import { ElementTag } from "./markers";
import styles from "./s3.module.css";

interface Props {
  entries: TimelineEntry[];
  onAnswerAsk: (choice: string) => void;
  onApprove: () => void;
  onReject: () => void;
}

// 동작 타임라인 (run-of-show) — DESIGN §9.9. 세로 척추선 + 스텝.
export function Timeline({ entries, onAnswerAsk, onApprove, onReject }: Props) {
  return (
    <ol className={styles.timeline}>
      {entries.map((e) => (
        <li key={e.id} className={styles.step}>
          <span className={styles.gutter}>{node(e)}</span>
          <div className={styles.body}>
            {e.kind === "user" && (
              <div className={styles.userMsg}>
                <span className={styles.userTag}>나</span>
                <span className={styles.userText}>{e.text}</span>
              </div>
            )}
            {e.kind === "tool" && <ToolStep entry={e} />}
            {/* 에이전트 대화는 본문 산세리프 (명조는 문서에만) */}
            {e.kind === "text" && (
              <p className={styles.stream}>
                {e.text}
                {e.streaming && <span className={styles.caret} aria-hidden />}
              </p>
            )}
            {e.kind === "ask" && (
              <div className={styles.ask}>
                <p className={styles.askQ}>{e.question}</p>
                {e.answer === undefined ? (
                  <>
                    <p className={styles.askWait}>답변 대기 중</p>
                    <div className={styles.chips}>
                      {e.options.map((o) => (
                        <button
                          key={o}
                          type="button"
                          className={styles.chip}
                          onClick={() => onAnswerAsk(o)}
                        >
                          {o}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className={styles.askDone}>
                    답변: <strong>{e.answer}</strong>
                  </p>
                )}
              </div>
            )}
            {e.kind === "gate" && (
              <div className={styles.gate}>
                <p className={styles.gateQ}>{e.question}</p>
                {e.decision === undefined ? (
                  <div className={styles.gateActions}>
                    <button type="button" className={styles.btnApprove} onClick={onApprove}>
                      승인하고 진행
                    </button>
                    <button type="button" className={styles.btnReject} onClick={onReject}>
                      수정 요청
                    </button>
                  </div>
                ) : (
                  <p className={e.decision === "approved" ? styles.gateOk : styles.gateNo}>
                    {e.decision === "approved" ? "승인됨 · 진행" : "수정 요청 · 중단"}
                  </p>
                )}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function ToolStep({ entry }: { entry: ToolEntry }) {
  return (
    <>
      <div className={styles.toolHead}>
        <span className={styles.toolLabel}>{entry.label}</span>
        <ElementTag element={entry.element} />
        <code className={styles.toolTag}>{entry.tool}</code>
        <time className={styles.ts}>{entry.ts}</time>
      </div>
      {entry.result && (
        <p className={styles.toolResult}>
          {entry.result}
          {entry.citation !== undefined && (
            <button type="button" className={styles.cite} title="출처 보기">
              #{entry.citation}
            </button>
          )}
        </p>
      )}
    </>
  );
}

// 노드 (DESIGN §9.9): done 채움 · active 맥동 링 · gate 앰버 마름모 · stopped 중립 · error 빨강.
function node(e: TimelineEntry) {
  if (e.kind === "user") {
    return <span className={`${styles.node} ${styles.nodeUser}`} aria-hidden />;
  }
  if (e.kind === "gate") {
    return <span className={`${styles.node} ${styles.nodeGate}`} aria-hidden />;
  }
  if (e.kind === "ask") {
    return <span className={`${styles.node} ${styles.nodeAsk}`} aria-hidden />;
  }
  if (e.kind === "text") {
    return <span className={`${styles.node} ${styles.nodeText}`} aria-hidden />;
  }
  const cls =
    e.status === "active"
      ? styles.nodeActive
      : e.status === "error"
        ? styles.nodeError
        : e.status === "stopped"
          ? styles.nodeStopped
          : styles.nodeDone;
  return <span className={`${styles.node} ${cls}`} aria-hidden />;
}
