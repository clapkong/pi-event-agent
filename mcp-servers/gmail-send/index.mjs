#!/usr/bin/env node
// 자작 Gmail 발송 MCP 서버.
// send_email 도구 → (승인 다이얼로그) → 공식 Gmail API messages.send 로 실제 발송.
// 인증정보는 .token.json 에서 읽음 (auth.mjs 로 1회 발급). 런타임 env 불필요.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { google } from "googleapis";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKEN_PATH = join(__dirname, ".token.json");

function gmailClient() {
  let c;
  try {
    c = JSON.parse(readFileSync(TOKEN_PATH, "utf8"));
  } catch {
    throw new Error(`인증 정보 없음(${TOKEN_PATH}). 'node mcp-servers/gmail-send/auth.mjs'를 1회 실행하세요.`);
  }
  if (!c.client_id || !c.client_secret || !c.refresh_token) {
    throw new Error("토큰 파일에 client_id/client_secret/refresh_token이 없습니다. auth.mjs를 다시 실행하세요.");
  }
  const oauth2 = new google.auth.OAuth2(c.client_id, c.client_secret, c.redirect_uri);
  oauth2.setCredentials({ refresh_token: c.refresh_token });
  return google.gmail({ version: "v1", auth: oauth2 });
}

function buildRaw({ to, subject, body, cc, bcc }) {
  const encH = (s) => `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`; // 한글 헤더 인코딩
  const headers = [
    `To: ${to}`,
    cc ? `Cc: ${cc}` : null,
    bcc ? `Bcc: ${bcc}` : null,
    `Subject: ${encH(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
  ].filter(Boolean);
  const mime = headers.join("\r\n") + "\r\n\r\n" + body;
  return Buffer.from(mime, "utf8").toString("base64url");
}

const server = new McpServer({ name: "gmail-send", version: "0.1.0" });

server.registerTool(
  "send_email",
  {
    title: "Gmail 발송",
    description:
      "공식 Gmail API로 메일을 실제 발송한다. 발송 직전 사용자 승인 다이얼로그가 뜨고, 승인해야만 전송된다. " +
      "수신자·제목·본문이 확정된 뒤에만 호출할 것. (초안만 필요하면 공식 gmail MCP의 create_draft를 쓸 것.)",
    inputSchema: {
      to: z.string().describe("수신자 이메일. 여러 명은 쉼표로 구분"),
      subject: z.string().describe("메일 제목"),
      body: z.string().describe("메일 본문 (평문)"),
      cc: z.string().optional().describe("참조 (선택)"),
      bcc: z.string().optional().describe("숨은참조 (선택)"),
    },
  },
  async ({ to, subject, body, cc, bcc }) => {
    // ── 승인 게이트 (MCP elicitation) ──
    const preview =
      `다음 메일을 실제로 발송할까요?\n\n받는사람: ${to}` +
      (cc ? `\n참조: ${cc}` : "") +
      (bcc ? `\n숨은참조: ${bcc}` : "") +
      `\n제목: ${subject}\n\n${body}`;
    let approved = false;
    try {
      const res = await server.server.elicitInput({
        mode: "form",
        message: preview,
        requestedSchema: {
          type: "object",
          properties: {
            decision: {
              type: "string",
              title: "발송 확인",
              description: "이 메일을 보낼까요?",
              enum: ["보내기", "취소"],
              default: "취소",
            },
          },
          required: ["decision"],
        },
      });
      approved = res.action === "accept" && res?.content?.decision === "보내기";
    } catch (e) {
      return {
        isError: true,
        content: [{ type: "text", text: `승인 UI를 사용할 수 없어 발송을 취소했습니다(대화형 Pi 세션에서 실행하세요). [${e.message}]` }],
      };
    }
    if (!approved) {
      return { content: [{ type: "text", text: "사용자가 발송을 취소했습니다 — 메일을 보내지 않았습니다." }] };
    }
    // ── 실제 발송 ──
    try {
      const gmail = gmailClient();
      const raw = buildRaw({ to, subject, body, cc, bcc });
      const { data } = await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
      return { content: [{ type: "text", text: `발송 완료 ✅ (messageId: ${data.id})` }] };
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: `발송 실패: ${e?.message ?? e}` }] };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[gmail-send] MCP 서버 시작 (stdio)");
