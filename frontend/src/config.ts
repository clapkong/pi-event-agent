// 백엔드 주소 단일 소스. 배포 시 VITE_API_BASE / VITE_WS_URL 로 덮어쓴다(미설정 시 로컬 기본).
const env = import.meta.env as Record<string, string | undefined>;
export const API_BASE = env.VITE_API_BASE ?? "http://127.0.0.1:8787";
export const WS_URL = env.VITE_WS_URL ?? "ws://127.0.0.1:8787/ws";
