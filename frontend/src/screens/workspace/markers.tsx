import type { ElementType } from "@/agent/contract.ts";
import styles from "./s3.module.css";

// 요소 타입 마커 (DESIGN §2.4 / §9.2) — 5요소(MCP/Extension/Skill) + 평범한 커스텀 도구(Tool).
const ELEMENT_CLASS: Record<ElementType, string> = {
  MCP: styles.etMcp,
  Extension: styles.etExt,
  Skill: styles.etSkill,
  Tool: styles.etTool,
};

export function ElementTag({ element }: { element: ElementType }) {
  return <span className={`${styles.et} ${ELEMENT_CLASS[element]}`}>{element}</span>;
}
