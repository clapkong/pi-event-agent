import { useState } from "react";
import styles from "./s3.module.css";

interface Props {
  running: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

// 컴포저 (DESIGN §9.12): 입력 + 중지(개입) + 종이비행기 전송.
export function Composer({ running, onSend, onStop }: Props) {
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
        <button
          type="button"
          className={styles.sendBtn}
          onClick={send}
          aria-label="전송"
          title="전송"
        >
          <i className="ti ti-send" aria-hidden />
        </button>
      )}
     </div>
    </div>
  );
}
