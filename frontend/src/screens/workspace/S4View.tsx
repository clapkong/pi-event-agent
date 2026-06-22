import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Workspace } from "@/data/workspaces";
import { useAgentRunCtx } from "@/agent/AgentRunContext";
import { useWorkspaces } from "@/store/workspaces";
import type { WorkspaceStatus } from "@/data/workspaces";
import {
  budgetSegments,
  useBoard,
  VENDOR_STAGES,
  type BudgetItem,
  type Milestone,
  type Vendor,
} from "@/data/boardState";
import { API_BASE } from "@/config";
import styles from "./s4.module.css";

// 사용자 Google Calendar ID(이메일 등). 설정 시 실제 GCal 임베드, 없으면 미니 달력 폴백.
// frontend/.env.local 에 VITE_GCAL_ID=you@gmail.com (커밋 금지 — 개인 정보).
const GCAL_ID = (import.meta.env as Record<string, string | undefined>).VITE_GCAL_ID;
const man = (n: number) => `${Math.round(n / 10000).toLocaleString("ko-KR")}만`;
const STAGES = ["기획", "진행중", "정산·완료"] as const;
// 보드 단계 → 헤더 상태 뱃지 매핑.
const STAGE_TO_STATUS: Record<(typeof STAGES)[number], WorkspaceStatus> = {
  기획: "planning",
  진행중: "active",
  "정산·완료": "done",
};

interface Comm {
  from: string;
  subject: string;
  date?: string;
  relevant: boolean;
  reason?: string;
  insight?: string;
  channel?: string; // 출처 채널(예: 메일). 기본 "메일"(Gmail MCP).
}

// S4 작업공간 · 상태 모델 (F4.2–F4.4). mock 구동.
export function S4View({ ws }: { ws: Workspace }) {
  const nav = useNavigate();
  const { state, start } = useAgentRunCtx();
  const { setStatus } = useWorkspaces();
  const {
    board,
    dismissReplan,
    toggleConditionLock,
    editConditionValue,
    toggleBudgetLock,
    editBudget,
    cycleVendorStage,
    setStage,
    reload,
    markChecked,
    toggleMilestoneDone,
    editMilestone,
    addMilestone,
    removeMilestone,
  } = useBoard(ws.id);

  // 진행 상태 자동 갱신: 지난(due < 오늘) 미완료 마일스톤은 '지연'으로 표시(저장값 아님, 표시용).
  const todayStr = new Date().toISOString().slice(0, 10);
  const effStatus = (m: { status: string; due: string }): "done" | "late" | "upcoming" =>
    m.status === "done" ? "done" : m.due && m.due < todayStr ? "late" : "upcoming";

  // 산출물 — 워크스페이스의 모든 문서(.md) + 적립된 사례.
  const [artifacts, setArtifacts] = useState<{ docs: string[]; caseId?: string }>({ docs: [] });
  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/api/workspaces/${encodeURIComponent(ws.id)}/artifacts`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d) setArtifacts({ docs: Array.isArray(d.docs) ? d.docs : [], caseId: d.caseId });
      })
      .catch(() => {});
  }, [ws.id]);
  const docLabel = (name: string) =>
    name === "proposal.md" ? "제안서" : name.replace(/\.md$/, "").replace(/_/g, " ");

  // 통신(메일 분류·회의록) — save_comms 가 쓴 comms.json.
  const [comms, setComms] = useState<Comm[]>([]);
  const loadComms = useCallback(() => {
    fetch(`${API_BASE}/api/workspaces/${encodeURIComponent(ws.id)}/comms`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setComms(Array.isArray(d?.comms) ? d.comms : []))
      .catch(() => {});
  }, [ws.id]);
  useEffect(() => {
    loadComms();
  }, [loadComms]);

  // 단계 변경 — 헤더 상태도 동기화. '정산·완료'는 확인 후 사례 적립 흐름을 트리거(되돌리기 어려움).
  const changeStage = (st: (typeof STAGES)[number]) => {
    if (st === "정산·완료" && board.stage !== "정산·완료") {
      const ok = window.confirm(
        "이 행사를 '정산·완료'로 바꾸시겠습니까?\n완료하면 회고를 수집하고 사례로 적립합니다(되돌리기 번거로움).",
      );
      if (!ok) return;
      setStage(st);
      setStatus(ws.id, "done");
      start(
        `행사 "${ws.name}"가 완료됐어. AGENTS.md '행사 완료 — 사례 적립' 절차대로: ① ask_user_question으로 회고(잘된 점·개선점·만족도)를 받고, ② 이 행사를 사례로 정리해 save_case로 cases/에 저장한 뒤 ③ rag_index로 적립해줘.`,
      );
      nav(`/w/${ws.id}`); // 회고 질문에 답해야 하므로 AI 에이전트 탭으로
      return;
    }
    setStage(st);
    setStatus(ws.id, STAGE_TO_STATUS[st]);
  };

  // "작업공간 점검" — 운영 점검을 에이전트에 위임하되 **작업공간에 머문다**(AI 탭으로 안 넘어감).
  // 백그라운드로 돌고(런은 셸이 소유), 끝나면 보드·통신을 다시 읽어 결과(재기획 배너 등)를 보여준다.
  // secretary(새 메일 분류) → 날씨 확인 → monitor 관점 변경 판단 → 필요 시 재기획 배너(update_state replan).
  const refresh = () => {
    markChecked(); // 점검 시각 기록(주기 자동 점검 기준)
    start(
      `작업공간 운영 점검을 해줘(사용자에게 즉답 필요 없음, 끝나면 보드만 갱신): ① secretary로 받은 편지함에서 "${ws.name}" 행사 관련 보낸/받은 메일을 검토·분류해 save_comms로 저장, ② get_weather로 행사일 날씨를 확인해 변동 시 update_state, ③ 통신·날씨 변경이 기획(예산·장소·동선)에 영향을 주는지 monitor 관점으로 판단해서, 재기획이 필요하면 update_state의 replanChangedInputs로 **재기획 배너만 올리고**(실제 재기획은 사용자가 배너에서 요청), 영향 없으면 그대로 둬.`,
    );
  };

  // 일정을 사용자 실제 Google Calendar에 등록(calendar MCP write). 진행을 보러 AI 탭으로.
  const registerToCalendar = () => {
    start(
      `이 행사 "${ws.name}"의 일정(마일스톤)을 내 Google Calendar에 등록해줘. calendar MCP로 각 마일스톤을 **마감일 종일 이벤트**(제목="[${ws.name}] {마일스톤}", 설명에 담당 포함)로 primary 캘린더에 생성하고, **같은 제목 이벤트가 이미 있으면 건너뛰어** 중복을 피해줘. 끝나면 등록된 개수를 알려줘.`,
    );
    nav(`/w/${ws.id}`);
  };

  // ⑥ 주기 점검 — 운영 단계 워크스페이스를 열었는데 마지막 점검이 1주 넘었으면 자동 1회 점검(백그라운드).
  const autoChecked = useRef(false);
  useEffect(() => {
    // 이미 점검함 / 런 진행 중 / **이 세션에 대화·런이 있음**(기획·점검 중) 이면 자동 점검 안 함.
    // → 자동 점검은 "운영 워크스페이스를 콜드로 열었을 때"만. 진행 중 런을 가로채지 않는다.
    if (autoChecked.current || state.running || state.entries.length > 0) return;
    if (board.stage === "기획") return; // 운영 단계(진행중/완료)만 — 기획 중엔 점검 안 함
    const WEEK = 7 * 24 * 60 * 60 * 1000;
    const stale = !board.checkedAt || Date.now() - new Date(board.checkedAt).getTime() > WEEK;
    if (stale) {
      autoChecked.current = true;
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.stage, board.checkedAt, state.running, state.entries.length]);

  // 점검(런)이 끝나면 보드·통신을 다시 읽어 결과 반영. running 이 true→false 로 떨어질 때.
  const prevRunning = useRef(false);
  useEffect(() => {
    if (prevRunning.current && !state.running) {
      reload();
      loadComms();
    }
    prevRunning.current = state.running;
  }, [state.running, reload, loadComms]);

  const seg = budgetSegments(board.budget);
  const lockedCount = board.budget.filter((b) => b.confirmed).length;
  // 날씨 "언제 기준" — 행사일 조건 값에서 날짜(YYYY-MM-DD)만, 없으면 전체 값.
  const eventDateRaw = board.conditions.find((c) => c.key === "eventDate")?.value;
  const weatherWhen = eventDateRaw?.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? eventDateRaw;
  const spentPct = board.budgetTotal > 0 ? Math.round((seg.spent / board.budgetTotal) * 100) : 0;
  // 다음 마감 = 오늘 이후 가장 가까운 미완료 마일스톤(행사일 기준 dday가 아니라 today 기준).
  const nextDeadline = board.milestones
    .filter((m) => m.status !== "done" && m.due && m.due >= todayStr)
    .sort((a, b) => a.due.localeCompare(b.due))[0];
  const nextDday = nextDeadline
    ? Math.round(
        (new Date(`${nextDeadline.due}T00:00:00`).getTime() - new Date(`${todayStr}T00:00:00`).getTime()) /
          86400000,
      )
    : null;

  return (
    <div className={styles.screen}>

      <div className={styles.scroll}>
        <div className={styles.col}>
          {/* 상태 스트립 (§9.7) */}
          <section className={styles.statusStrip}>
            <div className={styles.stepper}>
              {STAGES.map((st) => (
                <button
                  key={st}
                  type="button"
                  className={`${styles.step} ${st === board.stage ? styles.stepCur : ""}`}
                  onClick={() => changeStage(st)}
                  title={`${st}(으)로 변경`}
                >
                  {st}
                </button>
              ))}
            </div>
            <button
              className={styles.refreshBtn}
              onClick={refresh}
              disabled={state.running}
              title="메일·날씨를 점검하고 재기획이 필요한지 확인 (작업공간에서 진행)"
            >
              <i className={`ti ti-refresh ${state.running ? styles.spin : ""}`} aria-hidden />
              {state.running ? "점검 중…" : "점검"}
            </button>
            <div className={styles.summaryChips}>
              <Chip>제안서 <b className="mono">v{board.proposalVersion}</b></Chip>
              <Chip>확정 <b className="mono">{lockedCount}</b><i className="ti ti-lock" aria-hidden /></Chip>
              <Chip>집행 <b className="mono">{spentPct}%</b></Chip>
              {nextDeadline && (
                <Chip>
                  다음 마감 <b className="mono">{nextDday === 0 ? "오늘" : `D-${nextDday}`}</b>
                </Chip>
              )}
            </div>
          </section>

          {/* 재기획 배너 (§9.16) */}
          {board.replan && (
            <section className={styles.replan}>
              <div className={styles.replanHead}>
                <i className="ti ti-refresh-alert" aria-hidden />
                <strong>입력이 바뀌어 재검토가 필요합니다</strong>
              </div>
              <ul className={styles.replanList}>
                {board.replan.changedInputs.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <p className={styles.replanNote}>
                재기획은 <b>계획 항목만</b> 재배분합니다 — 확정🔒·집행 항목은 잠겨 안 바뀝니다.
                재기획은 AI 에이전트가 수행합니다.
              </p>
              <div className={styles.replanActions}>
                <button className={styles.btnPrimary} onClick={() => nav(`/w/${ws.id}`)}>
                  AI 에이전트에서 재기획
                </button>
                <button className={styles.btnGhost} onClick={dismissReplan}>
                  무시
                </button>
              </div>
            </section>
          )}

          {/* 조건 (입력/가정 겹) — 사람이 값 편집 + 잠금 토글, 백엔드에 저장. */}
          <Card title="행사 조건">
            <div className={styles.conds}>
              {board.conditions.map((c) => (
                <div key={c.key} className={`${styles.cond} ${c.locked ? styles.condLocked : ""}`}>
                  <span className={styles.condLabel}>{c.label}</span>
                  <input
                    className={styles.condValueInput}
                    defaultValue={c.value}
                    onBlur={(e) => {
                      if (e.target.value !== c.value) editConditionValue(c.key, e.target.value);
                    }}
                  />
                  <button
                    type="button"
                    className={styles.condLock}
                    onClick={() => toggleConditionLock(c.key)}
                    title={c.locked ? "확정 해제" : "확정🔒"}
                  >
                    <i className={`ti ${c.locked ? "ti-lock" : "ti-lock-open"}`} aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          </Card>

          {/* 2열: 좌(예산·업체) / 우(지도·날씨·산출물) */}
          <div className={styles.twoCol}>
            <div className={styles.colMain}>
              <Card title="예산">
                <BudgetBar seg={seg} total={board.budgetTotal} />
                <table className={styles.budgetTable}>
                  <thead>
                    <tr>
                      <th>항목</th>
                      <th className={styles.num}>계획</th>
                      <th>상태</th>
                      <th className={styles.num}>집행</th>
                    </tr>
                  </thead>
                  <tbody>
                    {board.budget.map((b) => (
                      <BudgetRow
                        key={b.id}
                        b={b}
                        onToggle={() => toggleBudgetLock(b.id)}
                        onEditPlanned={(n) => editBudget(b.id, "planned", n)}
                        onEditSpent={(n) => editBudget(b.id, "spent", n)}
                      />
                    ))}
                  </tbody>
                </table>
                <p className={styles.tableNote}>재기획은 계획만 재배분, 확정·집행 유지.</p>
              </Card>

              <Card title="업체">
                <div className={styles.vendors}>
                  {board.vendors.map((v) => (
                    <VendorRow key={v.id} v={v} onCycle={() => cycleVendorStage(v.id)} />
                  ))}
                </div>
              </Card>

              {/* 일정 (§9.20) — 달력 + D-레일(축소) + 마일스톤 리스트 */}
              <Card title="일정">
                <div className={styles.schedActions}>
                  <button
                    type="button"
                    className={styles.calRegBtn}
                    onClick={registerToCalendar}
                    disabled={state.running || board.milestones.length === 0}
                    title="마일스톤을 내 Google Calendar에 이벤트로 등록"
                  >
                    <i className="ti ti-calendar-plus" aria-hidden /> 캘린더에 등록
                  </button>
                </div>
                <div className={styles.scheduleWrap}>
                  <CalendarPane milestones={board.milestones} />
                  <div className={styles.scheduleMain}>
                    <div className={styles.drail}>
                      {board.milestones.map((m, i) => (
                        <div key={`${m.title}-${i}`} className={styles.drailNode}>
                          <span
                            className={`${styles.drailDot} ${
                              m.dday === 0
                                ? styles.drailToday
                                : effStatus(m) === "done"
                                  ? styles.drailDone
                                  : ""
                            }`}
                            aria-hidden
                          />
                          <span className={styles.drailD}>
                            {m.dday === 0 ? "당일" : `D${m.dday > 0 ? "+" : ""}${m.dday}`}
                          </span>
                        </div>
                      ))}
                    </div>
                    <ul className={styles.scheduleList}>
                      {board.milestones.map((m, i) => {
                        const st = effStatus(m);
                        return (
                          <li key={`${m.title}-${i}`} className={styles.schedRow}>
                            <button
                              type="button"
                              className={`${styles.schedCheck} ${st === "done" ? styles.schedDoneChk : ""}`}
                              onClick={() => toggleMilestoneDone(i)}
                              title={st === "done" ? "완료 해제" : "완료 표시"}
                            >
                              <i className={`ti ${st === "done" ? "ti-circle-check-filled" : "ti-circle"}`} aria-hidden />
                            </button>
                            <span className={`${styles.schedTag} ${st === "late" ? styles.schedLate : ""}`}>
                              {m.dday === 0 ? "당일" : `D${m.dday > 0 ? "+" : ""}${m.dday}`}
                            </span>
                            <input
                              className={`${styles.schedTitleInput} ${st === "done" ? styles.schedStrike : ""}`}
                              defaultValue={m.title}
                              onBlur={(e) => e.target.value !== m.title && editMilestone(i, { title: e.target.value })}
                            />
                            <input
                              className={styles.schedOwnerInput}
                              defaultValue={m.owner}
                              placeholder="담당"
                              onBlur={(e) => e.target.value !== m.owner && editMilestone(i, { owner: e.target.value })}
                            />
                            <input
                              type="date"
                              className={styles.schedDueInput}
                              defaultValue={m.due}
                              onBlur={(e) => e.target.value !== m.due && editMilestone(i, { due: e.target.value })}
                            />
                            <button
                              type="button"
                              className={styles.schedDel}
                              onClick={() => removeMilestone(i)}
                              title="삭제"
                            >
                              <i className="ti ti-x" aria-hidden />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    <button type="button" className={styles.schedAdd} onClick={addMilestone}>
                      <i className="ti ti-plus" aria-hidden /> 마일스톤 추가
                    </button>
                  </div>
                </div>
              </Card>
            </div>

            <div className={styles.colSide}>
              <Card title="장소">
                <div className={styles.mapCard}>
                  <i className={`ti ti-map-pin ${styles.mapPin}`} aria-hidden />
                  <div>
                    <p className={styles.mapName}>{board.venue.name || "장소 미정"}</p>
                    <p className={styles.mapNote}>{board.venue.note}</p>
                  </div>
                </div>
                {board.venue.name && (
                  // Google Maps 임베드(키 불필요). venue 이름으로 지오코딩.
                  <iframe
                    title={`${board.venue.name} 지도`}
                    src={`https://www.google.com/maps?q=${encodeURIComponent(board.venue.name)}&output=embed`}
                    style={{ width: "100%", height: 180, border: 0, borderRadius: 8, marginTop: 8, display: "block" }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                )}
              </Card>

              <Card title="날씨">
                <div className={styles.weather}>
                  <i
                    className={`ti ${board.weather.pop >= 50 ? "ti-cloud-rain" : "ti-sun"} ${styles.wIcon}`}
                    aria-hidden
                  />
                  <div className={styles.wInfo}>
                    <p className={styles.wLabel}>
                      {board.weather.label} {board.weather.temp}
                      {board.weather.stale && <span className={styles.staleTag}>변동</span>}
                    </p>
                    <p className={styles.wPop}>
                      강수확률 <span className="mono">{board.weather.pop}%</span>
                    </p>
                    {/* 언제·어디 기준인지 — 행사일 + 장소(일 단위 예보라 시각은 없음) */}
                    {(weatherWhen || board.venue.name) && (
                      <p className={styles.wWhen}>
                        {weatherWhen && (
                          <span>
                            <i className="ti ti-calendar" aria-hidden /> {weatherWhen}
                          </span>
                        )}
                        {board.venue.name && (
                          <span>
                            <i className="ti ti-map-pin" aria-hidden /> {board.venue.name}
                          </span>
                        )}
                        <span className={styles.wWhenNote}>기준</span>
                      </p>
                    )}
                    {board.weather.basis && <p className={styles.wBasis}>{board.weather.basis}</p>}
                  </div>
                </div>
              </Card>

              {/* 통신 · 회의록 (§9.28) — '작업공간 점검'이 secretary로 분류한 결과. 표시 전용. */}
              <Card title="통신 · 회의록">
                {comms.length === 0 ? (
                  <p className={styles.commsEmpty}>
                    아직 분류된 통신이 없어요. 위 ‘점검’을 누르면 secretary가 메일을 읽어 분류합니다.
                  </p>
                ) : (
                  <ul className={styles.commsList}>
                    {comms.map((c, i) => (
                      <li key={`${c.subject}-${i}`} className={styles.commsRow}>
                        <span className={c.relevant ? styles.relYes : styles.relNo}>
                          {c.relevant ? "관련" : "무관"}
                        </span>
                        <div className={styles.commsBody}>
                          <p className={styles.commsSubject}>
                            <span className={styles.commsChannel}>
                              <i className="ti ti-mail" aria-hidden /> {c.channel ?? "메일"}
                            </span>
                            {c.subject}
                            <span className={styles.commsFrom}>{c.from}</span>
                          </p>
                          {c.insight ? (
                            <p className={styles.commsInsight}>{c.insight}</p>
                          ) : (
                            c.reason && <p className={styles.commsReason}>{c.reason}</p>
                          )}
                        </div>
                        {c.date && <span className={styles.commsDate}>{c.date}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card title="산출물">
                <ul className={styles.outputs}>
                  {artifacts.docs.length === 0 && (
                    <li className={styles.outEmpty}>아직 생성된 문서가 없어요.</li>
                  )}
                  {artifacts.docs.map((name) => (
                    <li key={name}>
                      <button
                        className={styles.outLink}
                        onClick={() =>
                          nav(name === "proposal.md" ? `/w/${ws.id}/doc` : `/w/${ws.id}/doc?doc=${encodeURIComponent(name)}`)
                        }
                      >
                        <i className="ti ti-file-text" aria-hidden /> {docLabel(name)}
                        <span className={styles.outMeta}>열기 →</span>
                      </button>
                    </li>
                  ))}
                  {artifacts.caseId && (
                    <li>
                      <button className={styles.outLink} onClick={() => nav(`/case/${artifacts.caseId}`)}>
                        <i className="ti ti-archive" aria-hidden /> 사례 적립됨
                        <span className={styles.outMeta}>{artifacts.caseId} →</span>
                      </button>
                    </li>
                  )}
                </ul>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 캘린더 영역: GCAL_ID 가 있으면 실제 Google Calendar 임베드(등록된 이벤트가 보임),
// 없으면 마일스톤 미니 달력으로 폴백.
function CalendarPane({ milestones }: { milestones: Milestone[] }) {
  if (GCAL_ID) {
    const src =
      `https://calendar.google.com/calendar/embed?ctz=Asia%2FSeoul&mode=MONTH&showTitle=0&showPrint=0&showCalendars=0` +
      `&src=${encodeURIComponent(GCAL_ID)}` +
      `&src=${encodeURIComponent("ko.south_korea#holiday@group.v.calendar.google.com")}`;
    return (
      <iframe title="Google Calendar" src={src} className={styles.gcalFrame} loading="lazy" />
    );
  }
  return <BoardCalendar milestones={milestones} />;
}

// 미니 달력 — 마일스톤 날짜 표시(당일 강조). 이전/다음 달로 이동 가능(기본=행사 달). GCAL_ID 미설정 시 폴백.
function BoardCalendar({ milestones }: { milestones: Milestone[] }) {
  const base = milestones.find((m) => m.dday === 0)?.due ?? milestones[0]?.due;
  const baseDate = base ? new Date(`${base}T00:00:00`) : null;
  // 보는 달: 행사 달 기준 + offset(개월). hooks는 항상 호출(조건부 return 전).
  const [offset, setOffset] = useState(0);
  const anchor = baseDate && !Number.isNaN(baseDate.getTime()) ? baseDate : new Date();
  const view = new Date(anchor.getFullYear(), anchor.getMonth() + offset, 1);
  const year = view.getFullYear();
  const month = view.getMonth();

  if (!baseDate || Number.isNaN(baseDate.getTime())) return null;

  const marks: Record<number, { event: boolean; title: string }> = {};
  for (const m of milestones) {
    const d = new Date(`${m.due}T00:00:00`);
    if (!Number.isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month) {
      marks[d.getDate()] = { event: m.dday === 0, title: m.title };
    }
  }
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const W = ["일", "월", "화", "수", "목", "금", "토"];
  return (
    <div className={styles.miniCal}>
      <div className={styles.miniCalHead}>
        <button
          type="button"
          className={styles.miniCalNav}
          onClick={() => setOffset((o) => o - 1)}
          aria-label="이전 달"
        >
          <i className="ti ti-chevron-left" aria-hidden />
        </button>
        <span className={styles.miniCalLabel}>
          {year}년 {month + 1}월
        </span>
        <button
          type="button"
          className={styles.miniCalNav}
          onClick={() => setOffset((o) => o + 1)}
          aria-label="다음 달"
        >
          <i className="ti ti-chevron-right" aria-hidden />
        </button>
        {offset !== 0 && (
          <button type="button" className={styles.miniCalToday} onClick={() => setOffset(0)}>
            행사 달
          </button>
        )}
      </div>
      <div className={styles.miniCalGrid}>
        {W.map((w) => (
          <span key={w} className={styles.miniCalW}>
            {w}
          </span>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <span key={`e${i}`} />;
          const mk = marks[d];
          return (
            <span
              key={d}
              title={mk?.title}
              className={`${styles.miniCalD} ${mk ? (mk.event ? styles.miniCalEvent : styles.miniCalMark) : ""}`}
            >
              {d}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>{title}</h2>
      {children}
    </section>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className={styles.chip}>{children}</span>;
}

function BudgetBar({ seg, total }: { seg: ReturnType<typeof budgetSegments>; total: number }) {
  const pct = (n: number) => `${total > 0 ? (n / total) * 100 : 0}%`;
  return (
    <div className={styles.bbarWrap}>
      <div className={styles.bbar}>
        <span className={styles.bSpent} style={{ width: pct(seg.spent) }} />
        <span className={styles.bCommitted} style={{ width: pct(seg.committed) }} />
        <span className={styles.bPlanned} style={{ width: pct(seg.planned) }} />
      </div>
      <div className={styles.bLegend}>
        <span><i className={styles.dotSpent} />집행 <b className="mono">{man(seg.spent)}</b></span>
        <span><i className={styles.dotCommitted} />확정·미집행 <b className="mono">{man(seg.committed)}</b></span>
        <span><i className={styles.dotPlanned} />계획 잔여 <b className="mono">{man(seg.planned)}</b></span>
      </div>
    </div>
  );
}

// 사람이 계획액 편집 + 잠금(확정/계획) 토글 — 백엔드에 저장. 집행액은 에이전트/통신이 채운다.
function BudgetRow({
  b,
  onToggle,
  onEditPlanned,
  onEditSpent,
}: {
  b: BudgetItem;
  onToggle: () => void;
  onEditPlanned: (n: number) => void;
  onEditSpent: (n: number) => void;
}) {
  return (
    <tr className={b.stale ? styles.rowStale : undefined}>
      <td>
        {b.name}
        {b.stale && <span className={styles.staleTag}>재검토</span>}
      </td>
      <td className={`${styles.num} mono`}>
        <input
          type="number"
          className={styles.numInput}
          defaultValue={b.planned}
          onBlur={(e) => {
            const n = Number(e.target.value);
            if (!Number.isNaN(n) && n !== b.planned) onEditPlanned(n);
          }}
        />
      </td>
      <td>
        <button
          className={b.confirmed ? styles.lockOn : styles.lockOff}
          onClick={onToggle}
          title={b.confirmed ? "확정 해제" : "확정🔒"}
        >
          {b.confirmed ? (
            <>
              <i className="ti ti-lock" aria-hidden /> 확정
            </>
          ) : (
            "계획"
          )}
        </button>
      </td>
      <td className={`${styles.num} mono`}>
        <input
          type="number"
          className={styles.numInput}
          defaultValue={b.spent || ""}
          placeholder="—"
          title="집행액(실제 지출)"
          onBlur={(e) => {
            const n = Number(e.target.value);
            if (!Number.isNaN(n) && n !== b.spent) onEditSpent(n);
          }}
        />
      </td>
    </tr>
  );
}

// 사람이 단계 칩을 눌러 순환(후보→견적→확정→계약) — 백엔드에 저장.
function VendorRow({ v, onCycle }: { v: Vendor; onCycle: () => void }) {
  const curIdx = VENDOR_STAGES.indexOf(v.stage);
  return (
    <div className={styles.vendorRow}>
      <span className={styles.vendorName}>{v.name}</span>
      <span className={styles.vendorCat}>{v.category}</span>
      <button type="button" className={styles.miniStepper} onClick={onCycle} title="단계 변경(클릭)">
        {VENDOR_STAGES.map((st, i) => (
          <span
            key={st}
            className={`${styles.miniDot} ${i < curIdx ? styles.miniDone : ""} ${
              i === curIdx ? styles.miniCur : ""
            }`}
            title={st}
          >
            {st === "확정" && i <= curIdx ? <i className="ti ti-lock" aria-hidden /> : null}
          </span>
        ))}
        <span className={styles.vendorStage}>{v.stage}</span>
      </button>
    </div>
  );
}
