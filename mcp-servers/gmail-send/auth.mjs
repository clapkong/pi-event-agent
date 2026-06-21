#!/usr/bin/env node
// 일회용 OAuth 인증: gmail.send 권한으로 refresh token 발급 → .token.json 저장.
// 실행: set -a && source .env && set +a && node mcp-servers/gmail-send/auth.mjs
import http from "node:http";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { exec } from "node:child_process";
import { google } from "googleapis";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKEN_PATH = join(__dirname, ".token.json");

const CLIENT_ID = process.env.GMAIL_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_OAUTH_CLIENT_SECRET;
const PORT = 3118;
const REDIRECT = `http://localhost:${PORT}/callback`; // OAuth 클라이언트에 등록된 그 URI 재사용
const SCOPES = ["https://www.googleapis.com/auth/gmail.send"];
const STATE = randomBytes(16).toString("hex"); // CSRF 방지

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("✗ 환경변수 GMAIL_OAUTH_CLIENT_ID / GMAIL_OAUTH_CLIENT_SECRET 가 필요합니다.");
  console.error("  실행: set -a && source .env && set +a && node mcp-servers/gmail-send/auth.mjs");
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT);
const authUrl = oauth2.generateAuthUrl({ access_type: "offline", prompt: "consent", scope: SCOPES, state: STATE });

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith("/callback")) { res.writeHead(404); res.end(); return; }
  const url = new URL(req.url, REDIRECT);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  if (url.searchParams.get("state") !== STATE) {
    res.end("state 불일치 — 다른 서버가 포트를 가로챘을 수 있습니다. Pi를 끄고 다시 시도하세요.");
    console.error("✗ state 불일치. 포트", PORT, "를 다른 프로세스가 점유했을 수 있음.");
    server.close(); process.exit(1);
  }
  if (error) {
    res.end(`인증 거부/오류: ${error}. 터미널을 확인하세요.`);
    console.error("✗ 인증 오류:", error);
    server.close(); process.exit(1);
  }
  try {
    const { tokens } = await oauth2.getToken(code);
    if (!tokens.refresh_token) {
      throw new Error("refresh_token이 없습니다. 구글 계정 보안설정에서 이 앱 권한을 제거 후 다시 시도하세요.");
    }
    writeFileSync(TOKEN_PATH, JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT,
      refresh_token: tokens.refresh_token,
      scope: SCOPES.join(" "),
      created_at: new Date().toISOString(),
    }, null, 2), { mode: 0o600 });
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end("Gmail 발송 인증 완료 ✅  이 창을 닫고 터미널로 돌아가세요.");
    console.error("✓ 저장 완료:", TOKEN_PATH);
  } catch (e) {
    res.end("토큰 교환 실패: " + e.message);
    console.error("✗ 토큰 교환 실패:", e.message);
  } finally {
    server.close();
    setTimeout(() => process.exit(0), 300);
  }
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.error(`✗ 포트 ${PORT} 가 이미 사용 중입니다 (Pi가 실행 중이거나 잔여 프로세스).`);
    console.error(`  비우기:  lsof -ti:${PORT} | xargs kill   (그 뒤 이 명령 재실행)`);
  } else {
    console.error("✗ 서버 오류:", e.message);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.error("\n아래 URL을 브라우저에서 열어 gmail.send 권한을 승인하세요 (자동으로도 열어봅니다):\n");
  console.error("  " + authUrl + "\n");
  exec(`open "${authUrl}"`); // macOS 자동 오픈 (실패해도 위 URL 수동 사용)
});
