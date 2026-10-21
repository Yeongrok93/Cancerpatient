// SOLAPI SMS sender. Server-only — uses SOLAPI_SECRET, which must never be
// bundled into client code. Only import this from Route Handlers / Server
// Actions, never from a "use client" component.
//
// Auth spec (HMAC-SHA256 API key auth): reproduces what the official
// solapi-nodejs SDK does — https://github.com/solapi/solapi-nodejs
//   date      = ISO8601 timestamp
//   salt      = random string
//   signature = HMAC-SHA256(date + salt, apiSecret) as hex
//   header    = `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`

import { createHmac, randomBytes } from "crypto";

function buildAuthHeader(apiKey: string, apiSecret: string) {
  const date = new Date().toISOString();
  const salt = randomBytes(16).toString("hex"); // 32-char random string
  const signature = createHmac("sha256", apiSecret)
    .update(date + salt)
    .digest("hex");
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

export async function sendSms({ to, from, text }: { to: string | string[]; from: string; text: string }) {
  const apiKey = process.env.SOLAPI_API;
  const apiSecret = process.env.SOLAPI_SECRET;
  if (!apiKey || !apiSecret) {
    throw new Error("SOLAPI_API / SOLAPI_SECRET is not configured");
  }

  const recipients = Array.isArray(to) ? to : [to];
  const res = await fetch("https://api.solapi.com/messages/v4/send-many/detail", {
    method: "POST",
    headers: {
      Authorization: buildAuthHeader(apiKey, apiSecret),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: recipients.map((recipient) => ({ to: recipient, from, text })),
    }),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Solapi request failed (${res.status}): ${JSON.stringify(body)}`);
  }
  // send-many answers 200 even when individual recipients fail; the failures are
  // listed in the body. Treat any of them as an error so they are recorded and retried
  // (numbers are masked because the message ends up in the admin screen).
  const failedList: { to?: string; statusMessage?: string; statusCode?: string }[] = Array.isArray(body?.failedMessageList)
    ? body.failedMessageList
    : [];
  const registeredFailed = Number(body?.groupInfo?.count?.registeredFailed ?? 0);
  if (failedList.length > 0 || registeredFailed > 0) {
    const detail = failedList
      .map((f) => `${String(f.to ?? "").slice(-4) || "?"}: ${f.statusMessage ?? f.statusCode ?? "실패"}`)
      .join(", ");
    throw new Error(`Solapi 일부 발송 실패 (${failedList.length || registeredFailed}건) ${detail}`.trim());
  }
  return body;
}
