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
  return body;
}
