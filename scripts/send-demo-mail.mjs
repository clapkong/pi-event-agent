#!/usr/bin/env node
// send-demo-mail.mjs — 데모 녹화용 메일 시딩.
// 점검(secretary) 시연이 "진짜 받은편지함 분류"가 되도록, 행사 관련 메일 6통을 보낸다.
// (행사 관련 5통 + 무관 1통 → secretary가 무관을 걸러내는 것까지 보여줌)
//
// 인증: Gmail MCP(@gongrzhe/server-gmail-autoauth-mcp)가 저장한 OAuth 토큰을 재사용한다
//       (~/.gmail-mcp/gcp-oauth.keys.json + credentials.json|tokens.json). 별도 설치 불필요.
// 역할: 인증 계정(clapkong23 = 주최)이 → RECIPIENT(기본 clapkong@gmail.com = 업체)로
//       "주최 발신" 문의 3통을 자동 발송한다. (코드는 clapkong23 인증만 있어 이쪽만 자동)
//       업체 답장 2통 + 스팸 1통은 clapkong 계정에서 손으로 보낸다(데모용_사전준비.md §3 참고).
//       → 그러면 clapkong23 메일함에 보낸 문의 3 + 받은 답장 2 + 스팸 1 = 점검 시연 준비 완료.
//
// 사용:
//   node scripts/send-demo-mail.mjs --dry                          # 미리보기(발송 X)
//   node scripts/send-demo-mail.mjs                                # clapkong23 → clapkong 문의 3통
//   EVENT="한강 가을 페스티벌" node scripts/send-demo-mail.mjs       # 행사명 바꿔서
//   RECIPIENT=other@gmail.com node scripts/send-demo-mail.mjs      # 수신자 바꿔서

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const MCP_DIR = join(homedir(), ".gmail-mcp");
const DRY = process.argv.includes("--dry");
const EVENT = process.env.EVENT || "가을 뮤직 페스티벌";

// ── OAuth 토큰 로드 (gongrzhe MCP 저장 형식) ───────────────────────────
function readJson(...names) {
  for (const n of names) {
    try {
      return JSON.parse(readFileSync(join(MCP_DIR, n), "utf-8"));
    } catch {
      /* 다음 후보 */
    }
  }
  return null;
}
function pickClient(keys) {
  const k = keys?.installed || keys?.web || keys || {};
  return { id: k.client_id, secret: k.client_secret };
}
async function accessToken() {
  const keys = readJson("gcp-oauth.keys.json");
  const creds = readJson("credentials.json", "tokens.json");
  const { id, secret } = pickClient(keys);
  const refresh = creds?.refresh_token || creds?.tokens?.refresh_token;
  if (!id || !secret || !refresh) {
    throw new Error(
      `~/.gmail-mcp 에서 OAuth(client_id/secret/refresh_token)를 못 읽음. ` +
        `Gmail MCP 인증(npx @gongrzhe/server-gmail-autoauth-mcp auth)을 먼저 끝냈는지 확인.`,
    );
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: id,
      client_secret: secret,
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  });
  const j = await res.json();
  if (!j.access_token) throw new Error(`토큰 갱신 실패: ${JSON.stringify(j)}`);
  return j.access_token;
}

async function whoami(token) {
  const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { authorization: `Bearer ${token}` },
  });
  const j = await r.json();
  return j.emailAddress;
}

// ── RFC822 → base64url → Gmail 전송 ──────────────────────────────────
function rfc822({ from, to, subject, body }) {
  const enc = (s) => `=?UTF-8?B?${Buffer.from(s, "utf-8").toString("base64")}?=`; // 한글 헤더
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${enc(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(body, "utf-8").toString("base64"),
  ].join("\r\n");
}
async function send(token, msg) {
  const raw = Buffer.from(rfc822(msg), "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  if (!r.ok) throw new Error(`send 실패 ${r.status}: ${await r.text()}`);
  return (await r.json()).id;
}

// ── 주최 발신 문의 3통 (clapkong23 → 업체). 답장·스팸은 §3 따라 수동 발송. ──
function mails(event) {
  const p = `[${event}]`;
  return [
    { subject: `${p} 야외 무대·음향·조명 패키지 문의`, body: `안녕하세요, ${event} 주최 측입니다.\n800명 규모 야외 행사 메인 스테이지 음향·조명 패키지 견적 부탁드립니다.\n리허설 포함 1일 기준입니다.` },
    { subject: `${p} 케이터링·푸드트럭 견적 요청`, body: `${event} 800명 규모 푸드존 운영을 위한 푸드트럭·음료 케이터링 견적을 요청드립니다.\n1인 단가, 운영 대수, 세팅/수거 포함 여부 알려주세요.` },
    { subject: `${p} 천막·구조물 대여 문의 (우천 대비)`, body: `야외 행사라 우천 대비 천막·부스 구조물 대여를 문의드립니다.\n행사용 천막 다수 + 설치·해체 포함 견적 부탁드립니다.` },
  ];
}

// ── 실행 ─────────────────────────────────────────────────────────────
const token = await accessToken();
const me = await whoami(token);
const to = process.env.RECIPIENT || "clapkong@gmail.com";
const list = mails(EVENT);

console.log(`발신(주최): ${me}  →  수신(업체): ${to}   (행사: ${EVENT})`);
console.log(`주최 발신 문의 ${list.length}통 ${DRY ? "[DRY — 미발송]" : "발송"}  (업체 답장·스팸은 §3 따라 clapkong에서 수동)\n`);
for (const [i, m] of list.entries()) {
  const msg = { from: me, to, ...m };
  if (DRY) {
    console.log(`  ${i + 1}. ${m.subject}`);
    continue;
  }
  const id = await send(token, msg);
  console.log(`  ✓ ${i + 1}. ${m.subject}  (id=${id})`);
  await new Promise((r) => setTimeout(r, 400)); // 살짝 간격
}
console.log(`\n완료. 작업공간에서 '점검'을 누르면 secretary가 분류합니다.`);
