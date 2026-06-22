import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { STATUS_LABEL, type Workspace } from "@/data/workspaces";
import type { ElementType } from "@/agent/contract.ts";
import { useAgentRunCtx } from "@/agent/AgentRunContext";
import type {
  TimelineEntry,
  ToolEntry,
  ModelToast as Toast,
} from "@/agent/useAgentRun";
import styles from "./s3.module.css";

// 대화·동작 타임라인 (시그니처 화면). realClient(WS)로 실제 백엔드 구동.
// 이 화면과 그 안에서만 쓰는 부품(상단바·타임라인·컴포저·토스트)을 한 파일에 둔다.
export function S3View({ ws }: { ws: Workspace }) {
  // 런(WS 연결)은 워크스페이스 셸이 소유 — 패널 전환에도 유지된다. autostart 는 셸이 처리.
  const { state, start, answerAsk, approveGate, rejectGate, stop } = useAgentRunCtx();

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
              에이전트가 사례 검색 · 예산 산정 · 제안서 작성을 단계별로 실행하고, 중간에 되묻거나
              승인을 요청합니다.
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
              <p className={styles.endNote}>런 완료 · 산출물은 작업공간에서 관리됩니다.</p>
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

// 요소 요약 스트립 — "이번 기획에 쓰인 Pi 요소".
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

// 상단 바: 이름 + 연필 + 상태 뱃지 + 현재 모델 뱃지 + 작업공간.
function TopBar({ ws, model }: { ws: Workspace; model: string | null }) {
  const nav = useNavigate();
  return (
    <header className={styles.top}>
      <h1 className={styles.wsName}>{ws.name}</h1>
      <button type="button" className={styles.pencil} title="이름 수정" aria-label="이름 수정">
        <i className="ti ti-pencil" aria-hidden />
      </button>
      <span className={styles.statusBadge}>
        <span className={styles.statusDot} aria-hidden />
        {STATUS_LABEL[ws.status]}
      </span>

      <span className={styles.spacer} />

      <span className={styles.modelBadge} title="현재 모델">
        <span className={styles.modelDot} aria-hidden />
        {model ?? "모델 대기"}
      </span>
      <button
        type="button"
        className={styles.topAction}
        onClick={() => nav(`/w/${ws.id}/board`)}
        title="작업공간"
      >
        작업공간
      </button>
    </header>
  );
}

// 컴포저: 입력 + 중지(개입) + 전송.
function Composer({
  running,
  onSend,
  onStop,
}: {
  running: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const [text, setText] = useState("");

  const send = () => {
    onSend(text.trim());
    setText("");
  };

  return (
    <div className={styles.composer}>
      <div className={styles.composerInner}>
        <textarea
          className={styles.input}
          rows={1}
          placeholder="행사 조건이나 수정 요청을 입력하세요"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !running) {
              e.preventDefault();
              send();
            }
          }}
        />
        {running ? (
          <button
            type="button"
            className={styles.stopBtn}
            onClick={onStop}
            aria-label="중지"
            title="중지(개입)"
          >
            <span className={styles.stopGlyph} aria-hidden />
            중지
          </button>
        ) : (
          <button type="button" className={styles.sendBtn} onClick={send} aria-label="전송" title="전송">
            <i className="ti ti-send" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}

// 모델 전환 토스트: "○○ 한도 → ○○로 전환".
function ModelToast({ toast }: { toast: Toast }) {
  return (
    <div className={styles.toast} role="status">
      <i className={`ti ti-arrows-exchange ${styles.toastSwap}`} aria-hidden />
      <div>
        <p className={styles.toastTitle}>
          {toast.from ? `${toast.from} → ` : ""}
          <strong>{toast.to}</strong>로 전환
        </p>
        <p className={styles.toastReason}>{toast.reason}</p>
      </div>
    </div>
  );
}

// 요소 타입 마커 — 5요소(MCP/Extension/Skill) + 평범한 커스텀 도구(Tool).
const ELEMENT_CLASS: Record<ElementType, string> = {
  MCP: styles.etMcp,
  Extension: styles.etExt,
  Skill: styles.etSkill,
  Tool: styles.etTool,
};

function ElementTag({ element }: { element: ElementType }) {
  return <span className={`${styles.et} ${ELEMENT_CLASS[element]}`}>{element}</span>;
}

// 동작 타임라인 (run-of-show): 세로 척추선 + 스텝.
function Timeline({
  entries,
  onAnswerAsk,
  onApprove,
  onReject,
}: {
  entries: TimelineEntry[];
  onAnswerAsk: (choice: string) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
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
              <AskBlock
                question={e.question}
                options={e.options}
                answer={e.answer}
                onAnswer={onAnswerAsk}
              />
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

// 되묻기/선택 — 옵션이 있으면 카드 버튼(라벨 — 설명 분리), 비어 있으면 자유입력(기타).
function AskBlock({
  question,
  options,
  answer,
  onAnswer,
}: {
  question: string;
  options: string[];
  answer?: string;
  onAnswer: (choice: string) => void;
}) {
  const [text, setText] = useState("");
  const freeText = options.length === 0;
  return (
    <div className={styles.ask}>
      <p className={styles.askQ}>{question}</p>
      {answer !== undefined ? (
        <p className={styles.askDone}>
          답변: <strong>{answer}</strong>
        </p>
      ) : freeText ? (
        <form
          className={styles.askForm}
          onSubmit={(ev) => {
            ev.preventDefault();
            const v = text.trim();
            if (v) onAnswer(v);
          }}
        >
          <input
            className={styles.askInput}
            value={text}
            onChange={(ev) => setText(ev.target.value)}
            placeholder="직접 입력…"
            autoFocus
          />
          <button type="submit" className={styles.askSend} disabled={!text.trim()}>
            보내기
          </button>
        </form>
      ) : (
        <>
          <p className={styles.askWait}>선택해 주세요</p>
          <div className={styles.chips}>
            {options.map((o) => {
              const [label, ...rest] = o.split(" — ");
              const desc = rest.join(" — ");
              return (
                <button
                  key={o}
                  type="button"
                  className={styles.chip}
                  onClick={() => onAnswer(o)}
                >
                  <span className={styles.chipLabel}>{label}</span>
                  {desc && <span className={styles.chipDesc}>{desc}</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
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

// 타임라인 노드: done 채움 · active 맥동 링 · gate 앰버 마름모 · stopped 중립 · error 빨강.
function node(e: TimelineEntry) {
  if (e.kind === "user") return <span className={`${styles.node} ${styles.nodeUser}`} aria-hidden />;
  if (e.kind === "gate") return <span className={`${styles.node} ${styles.nodeGate}`} aria-hidden />;
  if (e.kind === "ask") return <span className={`${styles.node} ${styles.nodeAsk}`} aria-hidden />;
  if (e.kind === "text") return <span className={`${styles.node} ${styles.nodeText}`} aria-hidden />;
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
