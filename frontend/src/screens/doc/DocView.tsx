import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { Workspace } from "@/data/workspaces";
import { Md } from "@/components/Md";
import { API_BASE } from "@/config";
import styles from "./doc.module.css";

interface VersionEntry {
  v: number;
  author: "ai" | "human";
  at: string;
  summary: string;
}

interface Source {
  text: string;
  caseId?: string; // cases/*.md 사례 id
  url?: string; // 외부 조사 링크
}

// 제안서 본문에서 "## 출처/참고/References" 섹션을 파싱 → [n] 매핑. (없으면 빈 맵)
function parseSources(md: string): Record<number, Source> {
  const m = md.match(/\n#{1,6}\s*(출처|참고\s*자료|참고|references|sources)\b[\s\S]*$/i);
  if (!m) return {};
  const out: Record<number, Source> = {};
  for (const line of m[0].split("\n")) {
    const lm = line.match(/\[(\d+)\]:?\s*(.+)/);
    if (!lm) continue;
    const text = lm[2].trim();
    out[Number(lm[1])] = {
      text,
      caseId: text.match(/\b(c-[a-z0-9-]+)\b/)?.[1],
      url: text.match(/https?:\/\/\S+/)?.[0],
    };
  }
  return out;
}

// S5 결과 문서 — 기본은 제안서(proposal.md, 편집·버전 이력). `?doc=<파일명>` 이면 그 산출물(읽기 전용).
export function DocView({ ws }: { ws: Workspace }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const docName = params.get("doc"); // null = 제안서
  const isProposal = !docName;

  const [cite, setCite] = useState<number | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const load = (alive: () => boolean) => {
    const url = isProposal
      ? `${API_BASE}/api/workspaces/${encodeURIComponent(ws.id)}/proposal`
      : `${API_BASE}/api/workspaces/${encodeURIComponent(ws.id)}/file?name=${encodeURIComponent(docName)}`;
    fetch(url)
      .then((r) => r.json().catch(() => null))
      .then((d) => {
        if (!alive()) return;
        setMarkdown(typeof d?.markdown === "string" ? d.markdown : null);
        setVersions(Array.isArray(d?.versions) ? d.versions : []);
        setLoading(false);
      })
      .catch(() => {
        if (alive()) {
          setMarkdown(null);
          setLoading(false);
        }
      });
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setEditing(false);
    setShowVersions(false);
    load(() => alive);
    return () => {
      alive = false;
    };
  }, [ws.id, docName]);

  const startEdit = () => {
    setDraft(markdown ?? "");
    setEditing(true);
  };
  const save = async () => {
    setSaving(true);
    try {
      await fetch(`${API_BASE}/api/workspaces/${encodeURIComponent(ws.id)}/proposal`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ markdown: draft }),
      });
      setMarkdown(draft);
      setEditing(false);
      load(() => true); // 버전 이력 갱신
    } catch {
      /* 저장 실패 — 편집 유지 */
    } finally {
      setSaving(false);
    }
  };

  const sources = useMemo(() => parseSources(markdown ?? ""), [markdown]);
  const citeSource = cite !== null ? sources[cite] : undefined;

  return (
    <div className={styles.screen}>
      <div className={styles.docScroll}>
        {/* 비-제안서 문서는 파일명 표시 */}
        {!isProposal && <div className={styles.docFileName}>{docName}</div>}

        {/* 도구막대: 제안서만 편집/버전 */}
        {!loading && isProposal && (
          <div className={styles.docBar}>
            {editing ? (
              <>
                <button className={styles.barPrimary} onClick={save} disabled={saving}>
                  <i className="ti ti-check" aria-hidden /> {saving ? "저장 중…" : "저장"}
                </button>
                <button className={styles.barGhost} onClick={() => setEditing(false)} disabled={saving}>
                  취소
                </button>
              </>
            ) : (
              markdown !== null && (
                <>
                  {versions.length > 0 && (
                    <button
                      className={styles.barGhost}
                      onClick={() => setShowVersions((v) => !v)}
                      aria-expanded={showVersions}
                    >
                      <i className="ti ti-history" aria-hidden /> 버전 이력 ({versions.length})
                    </button>
                  )}
                  <button className={styles.barGhost} onClick={startEdit}>
                    <i className="ti ti-pencil" aria-hidden /> 편집
                  </button>
                </>
              )
            )}
          </div>
        )}

        {showVersions && !editing && versions.length > 0 && (
          <ul className={styles.versions}>
            {[...versions].reverse().map((ver) => (
              <li key={ver.v} className={styles.versionRow}>
                <span className={styles.versionV}>v{ver.v}</span>
                <span className={ver.author === "ai" ? styles.actorAi : styles.actorHuman}>
                  {ver.author === "ai" ? "AI" : "사람"}
                </span>
                <span className={styles.versionSummary}>{ver.summary}</span>
                <span className={styles.versionAt}>{new Date(ver.at).toLocaleString("ko-KR")}</span>
              </li>
            ))}
          </ul>
        )}

        {loading ? (
          <p className={styles.empty}>불러오는 중…</p>
        ) : editing ? (
          <textarea
            className={styles.editor}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
          />
        ) : markdown !== null ? (
          <article className={styles.doc}>
            <Md onCite={isProposal ? setCite : undefined}>{markdown}</Md>
          </article>
        ) : (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>{isProposal ? "아직 제안서가 없어요" : "문서를 찾을 수 없어요"}</p>
            <p className={styles.emptyHint}>
              {isProposal ? "AI 에이전트에서 기획을 완료하면 제안서가 여기 표시됩니다." : "산출물 목록에서 다시 선택해 주세요."}
            </p>
          </div>
        )}
      </div>

      {/* 인용 드로어 (§9.14) — [n] 클릭 시 출처 표시 */}
      {cite !== null && (
        <>
          <div className={styles.citeBackdrop} onClick={() => setCite(null)} />
          <aside className={styles.citeDrawer} role="dialog" aria-label="출처">
            <div className={styles.citeHead}>
              <span className={styles.citeN}>출처 [{cite}]</span>
              <button className={styles.citeClose} onClick={() => setCite(null)} aria-label="닫기">
                <i className="ti ti-x" aria-hidden />
              </button>
            </div>
            {citeSource ? (
              <>
                <p className={styles.citeText}>{citeSource.text}</p>
                {citeSource.caseId && (
                  <button className={styles.citeLink} onClick={() => navigate(`/case/${citeSource.caseId}`)}>
                    <i className="ti ti-archive" aria-hidden /> 사례 {citeSource.caseId} 열기
                  </button>
                )}
                {citeSource.url && (
                  <a className={styles.citeLink} href={citeSource.url} target="_blank" rel="noreferrer">
                    <i className="ti ti-external-link" aria-hidden /> 원문 링크
                  </a>
                )}
              </>
            ) : (
              <p className={styles.citeText}>
                이 번호의 출처를 본문 ‘출처’ 섹션에서 찾지 못했어요. (제안서에 “## 출처” 목록이 필요합니다)
              </p>
            )}
          </aside>
        </>
      )}
    </div>
  );
}
