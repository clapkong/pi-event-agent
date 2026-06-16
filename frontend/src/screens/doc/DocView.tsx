import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Workspace } from "@/data/workspaces";
import { StatusBadge } from "@/components/StatusBadge";
import {
  PROPOSAL_BLOCKS,
  VERSIONS,
  CITATIONS,
  type Version,
} from "@/data/proposal";
import styles from "./doc.module.css";

// S5 결과 문서 + 버전 이력 + 인용 드로어 (F5.1·F5.2). mock.
export function DocView({ ws }: { ws: Workspace }) {
  const nav = useNavigate();
  const [cite, setCite] = useState<number | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [editing, setEditing] = useState(false);
  const [versions, setVersions] = useState<Version[]>(VERSIONS);
  const latest = versions[versions.length - 1];

  const save = () => {
    setVersions((vs) => [
      ...vs,
      {
        v: vs[vs.length - 1].v + 1,
        author: "human",
        at: "방금",
        summary: "사람 직접 수정",
      },
    ]);
    setEditing(false);
  };

  return (
    <div className={styles.screen}>
      <header className={styles.top}>
        <h1 className={styles.wsName}>{ws.name}</h1>
        <StatusBadge status={ws.status} />
        <span className={styles.vBadge}>제안서 v{latest.v}</span>
        <span className={styles.spacer} />
        <button className={styles.action} onClick={() => setShowVersions((v) => !v)}>
          <i className="ti ti-history" aria-hidden /> 버전 이력
        </button>
        {editing ? (
          <button className={styles.actionPrimary} onClick={save}>
            <i className="ti ti-check" aria-hidden /> 저장
          </button>
        ) : (
          <button className={styles.action} onClick={() => setEditing(true)}>
            <i className="ti ti-pencil" aria-hidden /> 편집
          </button>
        )}
        <button className={styles.action} onClick={() => nav(`/w/${ws.id}/board`)}>
          작업공간
        </button>
      </header>

      <div className={styles.body}>
        <div className={styles.docScroll}>
          {showVersions && <VersionHistory versions={versions} />}

          <article className={styles.doc}>
            {PROPOSAL_BLOCKS.map((b) =>
              b.kind === "h" ? (
                <h2
                  key={b.id}
                  className={styles.docH}
                  contentEditable={editing}
                  suppressContentEditableWarning
                >
                  {b.text}
                </h2>
              ) : (
                <p key={b.id} className={styles.docP}>
                  <span contentEditable={editing} suppressContentEditableWarning>
                    {b.text}
                  </span>
                  {b.locks?.map((l) => (
                    <span key={l.label} className={styles.lockChip}>
                      <i className="ti ti-lock" aria-hidden /> {l.label}
                    </span>
                  ))}
                  {b.cites?.map((n) => (
                    <button
                      key={n}
                      className={styles.cite}
                      onClick={() => setCite(n)}
                      title="인용 보기"
                    >
                      #{n}
                    </button>
                  ))}
                </p>
              )
            )}
          </article>
        </div>

        {cite !== null && (
          <CitationDrawer n={cite} onClose={() => setCite(null)} onCase={(id) => nav(`/case/${id}`)} />
        )}
      </div>
    </div>
  );
}

function VersionHistory({ versions }: { versions: Version[] }) {
  return (
    <div className={styles.vh}>
      <div className={styles.banner}>확정값(🔒)은 버전이 바뀌어도 그대로 반영됩니다.</div>
      <ul className={styles.vhList}>
        {versions.map((v) => (
          <li key={v.v} className={styles.vhItem}>
            <span
              className={`${styles.vhDot} ${v.author === "ai" ? styles.vhAi : styles.vhHuman}`}
              aria-hidden
            />
            <span className={styles.vhV}>v{v.v}</span>
            <span className={`${styles.actor} ${v.author === "ai" ? styles.actorAi : styles.actorHuman}`}>
              {v.author === "ai" ? "AI Agent" : "사람"}
            </span>
            <span className={styles.vhSummary}>{v.summary}</span>
            <span className={styles.vhAt}>{v.at}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CitationDrawer({
  n,
  onClose,
  onCase,
}: {
  n: number;
  onClose: () => void;
  onCase: (caseId: string) => void;
}) {
  const c = CITATIONS[n];
  if (!c) return null;
  return (
    <aside className={styles.drawer}>
      <div className={styles.drawerHead}>
        <span className={styles.drawerN}>#{c.n} 인용</span>
        <button className={styles.drawerClose} onClick={onClose} aria-label="닫기">
          <i className="ti ti-x" aria-hidden />
        </button>
      </div>
      <h3 className={styles.drawerTitle}>{c.caseTitle}</h3>
      <p className={styles.drawerMeta}>{c.meta}</p>
      <div className={styles.scores}>
        <Score label="하이브리드" v={c.scores.hybrid} primary />
        <Score label="벡터" v={c.scores.vector} />
        <Score label="BM25" v={c.scores.bm25} />
      </div>
      <p className={styles.excerpt}>{c.excerpt}</p>
      <p className={styles.source}>{c.source}</p>
      <button className={styles.caseLink} onClick={() => onCase(c.caseId)}>
        사례 상세 보기 <i className="ti ti-arrow-right" aria-hidden />
      </button>
    </aside>
  );
}

function Score({ label, v, primary }: { label: string; v: number; primary?: boolean }) {
  return (
    <div className={styles.score}>
      <span className={styles.scoreLabel}>{label}</span>
      <div className={styles.scoreTrack}>
        <div
          className={primary ? styles.scoreFillP : styles.scoreFill}
          style={{ width: `${v * 100}%` }}
        />
      </div>
      <span className={styles.scoreVal}>{v.toFixed(2)}</span>
    </div>
  );
}
