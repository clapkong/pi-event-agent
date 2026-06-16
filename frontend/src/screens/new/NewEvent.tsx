import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspaces } from "@/store/workspaces";
import styles from "./new.module.css";

const FIELD_CHIPS = ["장소", "인원", "예산", "날짜"];

// S2 새 행사 · 기획 폼 (F3.1). 제출 → 워크스페이스 생성 → S3 진입(mock 런 자동 시작).
export function NewEvent() {
  const { add } = useWorkspaces();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [conditions, setConditions] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  // 칩 클릭 → 입력창에 서식 토큰("장소: ") 삽입 (자연어 입력도 가능).
  const addChip = (label: string) => {
    setConditions((c) => (c ? `${c}\n${label}: ` : `${label}: `));
    taRef.current?.focus();
  };

  const start = () => {
    const summary =
      conditions
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .join(" · ") || "조건 미정";
    const ws = add({ name, summary });
    // autostart: S3 진입 시 mock 런 자동 시작 (location state로 전달).
    navigate(`/w/${ws.id}`, { state: { autostart: true } });
  };

  return (
    <div className={styles.screen}>
      <header className={styles.top}>
        <h1 className={styles.topName}>새 행사</h1>
        <span className={styles.planBadge}>
          <span className={styles.planDot} aria-hidden />
          기획중
        </span>
      </header>

      <div className={styles.scroll}>
        <div className={styles.form}>
          <h2 className={styles.formTitle}>행사 기획 폼</h2>
          <p className={styles.formGuide}>
            행사 이름과 조건을 입력하면 에이전트가 사례 검색부터 시작합니다.
          </p>

          <label className={styles.label} htmlFor="ws-name">
            행사 이름
          </label>
          <input
            id="ws-name"
            className={styles.nameInput}
            placeholder="예: 프론트엔드 밋업 200명"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div className={styles.chipRow}>
            <span className={styles.chipLabel}>항목 추가</span>
            {FIELD_CHIPS.map((c) => (
              <button
                key={c}
                type="button"
                className={styles.chip}
                onClick={() => addChip(c)}
              >
                {c}
              </button>
            ))}
          </div>

          <textarea
            ref={taRef}
            className={styles.editor}
            rows={7}
            placeholder={"인원: 200명\n장소: 서울, 야외 가능\n예산: 500만원\n\n혹은 자연어로 조건을 적어도 됩니다."}
            value={conditions}
            onChange={(e) => setConditions(e.target.value)}
          />

          <p className={styles.hint}>
            칩을 누르면 <code className="mono">장소:</code> 같은 서식이 입력창에 들어갑니다.
            그냥 타이핑해도 됩니다.
          </p>

          <div className={styles.actions}>
            <button type="button" className={styles.startBtn} onClick={start}>
              기획 시작하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
