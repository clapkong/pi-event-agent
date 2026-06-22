import { Children, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "./Md.module.css";

// 문자열 자식에서 [n] 인용 마커를 찾아 클릭 버튼으로. (비문자열 자식은 그대로 통과)
function splitCites(children: ReactNode, onCite: (n: number) => void): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child !== "string") return child;
    return child.split(/(\[\d+\])/).map((part, i) => {
      const m = part.match(/^\[(\d+)\]$/);
      if (!m) return part;
      const n = Number(m[1]);
      return (
        <button
          // biome-ignore lint/suspicious/noArrayIndexKey: 정적 분할이라 안정
          key={i}
          type="button"
          className={styles.cite}
          onClick={() => onCite(n)}
          title="출처 보기"
        >
          [{n}]
        </button>
      );
    });
  });
}

// 에이전트 출력(마크다운: **굵게**·`-` 목록·표 등)을 렌더. GFM(표·취소선) 포함.
// onCite 가 있으면 본문 `[n]`을 클릭 가능한 인용 마커로(문서 인용 드로어용).
export function Md({
  children,
  className,
  onCite,
}: {
  children: string;
  className?: string;
  onCite?: (n: number) => void;
}) {
  const components: Components | undefined = onCite
    ? {
        p: ({ children }) => <p>{splitCites(children, onCite)}</p>,
        li: ({ children }) => <li>{splitCites(children, onCite)}</li>,
        td: ({ children }) => <td>{splitCites(children, onCite)}</td>,
      }
    : undefined;
  return (
    <div className={`${styles.md} ${className ?? ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
