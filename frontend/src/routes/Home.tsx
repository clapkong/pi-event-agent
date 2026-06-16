import styles from "./Page.module.css";

// S1 홈 — F0에선 빈 라우트(토큰 검증용 플레이스홀더). 실제 대시보드는 F3.2.
export function Home() {
  return (
    <div className={styles.page}>
      <p className={styles.eyebrow}>홈</p>
      <h1 className={styles.display}>어떤 행사를 기획할까요?</h1>
      <p className={styles.lead}>
        조건을 입력하면 에이전트가 리서치부터 제안서·발송·정산까지 한 번에
        처리합니다. 지난 행사의 업체와 교훈도 다시 끌어옵니다.
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.btnPrimary}>
          ＋ 새 행사 만들기
        </button>
      </div>
      <p className={styles.note}>
        대시보드(워크스페이스 타일·알림·달력)는 <code className="mono">F3.2</code>
        에서 채워집니다.
      </p>
    </div>
  );
}
