import { createRoot } from "react-dom/client";
import { App } from "./App";

import "./styles/tokens.css";
import "./styles/global.css";

// ⚠️ 임시: StrictMode 끔. 개발 이중마운트가 WS 연결을 두 번 열어(pi 한 번 띄웠다 죽임)
// 지저분해서. 연결 lifecycle 안정화 후 복구. (effect cleanup 으로 정리는 이미 함)
createRoot(document.getElementById("root")!).render(<App />);
