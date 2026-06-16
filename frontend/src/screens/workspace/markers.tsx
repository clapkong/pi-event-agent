import type { ElementType } from "@/agent/contract.ts";
import styles from "./s3.module.css";

// 요소 타입 마커 (DESIGN §2.4 / §9.2) — MCP / Extension / Skill.
const ELEMENT_CLASS: Record<ElementType, string> = {
  MCP: styles.etMcp,
  Extension: styles.etExt,
  Skill: styles.etSkill,
};

export function ElementTag({ element }: { element: ElementType }) {
  return <span className={`${styles.et} ${ELEMENT_CLASS[element]}`}>{element}</span>;
}
