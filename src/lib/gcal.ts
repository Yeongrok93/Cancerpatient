// Server-only: mirrors upcoming 외래 (clinic_visits) into one Google Calendar through a service account.
//
// Env (all three required, otherwise every call is a no-op):
//   GCAL_CLIENT_EMAIL   service account e-mail
//   GCAL_PRIVATE_KEY    its private key (the "private_key" field of the JSON key; "\n" escapes are fine)
//   GCAL_CALENDAR_ID    the calendar shared with that service account ("Make changes to events")
//
// Privacy: events say "외래 #<환자번호> <이름>" — no clinical text goes to Google.
// reconcileCalendar() is idempotent: it makes the calendar match the table, so it can run after every
// change and daily from the cron as a safety net for edits made straight in the database.

import { createSign } from "crypto";
import { sql } from "./db";

const SCOPE = "https://www.googleapis.com/auth/calendar";
const API = "https://www.googleapis.com/calendar/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DURATION_MIN = 30;
/** Past visits stay on the calendar this many days, then are left alone (not deleted by us after that). */
const KEEP_PAST_DAYS = 14;

type Cfg = { email: string; key: string; calendarId: string };

function config(): Cfg | null {
  const email = (process.env.GCAL_CLIENT_EMAIL ?? "").trim();
  const key = (process.env.GCAL_PRIVATE_KEY ?? "").replace(/\\n/g, "\n").trim();
  const calendarId = (process.env.GCAL_CALENDAR_ID ?? "").trim();
  return email && key && calendarId ? { email, key, calendarId } : null;
}

let cached: { token: string; exp: number } | null = null;

async function accessToken(c: Cfg): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.exp - 60 > now) return cached.token;
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = b64({ alg: "RS256", typ: "JWT" });
  const claim = b64({ iss: c.email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 });
  const sig = createSign("RSA-SHA256").update(`${head}.${claim}`).sign(c.key, "base64url");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claim}.${sig}` }),
  });
  const body = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !body.access_token) throw new Error(`Google token: ${body.error_description ?? res.status}`);
  cached = { token: body.access_token, exp: now + (body.expires_in ?? 3600) };
  return cached.token;
}

type GEvent = {
  id: string;
  status?: string;
  summary?: string;
  start?: { dateTime?: string };
  end?: { dateTime?: string };
};

async function g(c: Cfg, method: string, path: string, body?: unknown): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${API}/calendars/${encodeURIComponent(c.calendarId)}${path}`, {
    method,
    headers: { authorization: `Bearer ${await accessToken(c)}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

function addMinutes(date: string, time: string, min: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm + min)).toISOString().slice(0, 19);
}

type Visit = { id: string; code: string; name: string; date: string; time: string };

function toEvent(v: Visit) {
  return {
    id: `cv${v.id.replace(/-/g, "").toLowerCase()}`, // base32hex-safe: lowercase hex only
    status: "confirmed",
    summary: `외래 #${v.code}${v.name ? ` ${v.name}` : ""}`,
    start: { dateTime: `${v.date}T${v.time}:00`, timeZone: "Asia/Seoul" },
    end: { dateTime: addMinutes(v.date, v.time, DURATION_MIN), timeZone: "Asia/Seoul" },
    extendedProperties: { private: { app: "cancerpatient" } },
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 60 }] },
  };
}

export type CalendarSync = { enabled: boolean; created: number; updated: number; deleted: number; error?: string };

/** Makes the calendar match clinic_visits (recent past + all future). Never throws. */
export async function reconcileCalendar(): Promise<CalendarSync> {
  const c = config();
  const out: CalendarSync = { enabled: !!c, created: 0, updated: 0, deleted: 0 };
  if (!c) return out;
  try {
    const rows = await sql`
      SELECT v.id, v.patient_code, v.visit_date::text AS d, to_char(v.visit_time, 'HH24:MI') AS t,
             COALESCE((SELECT p.name FROM participants p WHERE p.patient_code = v.patient_code ORDER BY p.applied_at LIMIT 1), '') AS name
      FROM clinic_visits v
      WHERE v.patient_code IS NOT NULL AND v.visit_date >= ((NOW() AT TIME ZONE 'Asia/Seoul')::date - ${KEEP_PAST_DAYS}::int)
      ORDER BY v.visit_date, v.visit_time
    `;
    const want = new Map<string, ReturnType<typeof toEvent>>();
    for (const r of rows) {
      const ev = toEvent({ id: String(r.id), code: String(r.patient_code), name: String(r.name ?? ""), date: String(r.d), time: String(r.t) });
      want.set(ev.id, ev);
    }

    const timeMin = new Date(Date.now() - (KEEP_PAST_DAYS + 1) * 86_400_000).toISOString();
    const have = new Map<string, GEvent>();
    let pageToken = "";
    do {
      const q = new URLSearchParams({
        privateExtendedProperty: "app=cancerpatient",
        timeMin,
        maxResults: "250",
        singleEvents: "true",
        showDeleted: "false",
      });
      if (pageToken) q.set("pageToken", pageToken);
      const { status, json } = await g(c, "GET", `/events?${q}`);
      if (status !== 200) throw new Error(`Google list ${status}: ${JSON.stringify(json).slice(0, 200)}`);
      const page = json as { items?: GEvent[]; nextPageToken?: string };
      for (const e of page.items ?? []) have.set(e.id, e);
      pageToken = page.nextPageToken ?? "";
    } while (pageToken);

    for (const [id] of have) {
      if (want.has(id)) continue;
      const { status } = await g(c, "DELETE", `/events/${id}`);
      if (status === 204 || status === 200 || status === 410) out.deleted++;
    }
    for (const [id, ev] of want) {
      const cur = have.get(id);
      if (cur) {
        const same =
          cur.summary === ev.summary &&
          cur.start?.dateTime?.slice(0, 16) === ev.start.dateTime.slice(0, 16) &&
          cur.end?.dateTime?.slice(0, 16) === ev.end.dateTime.slice(0, 16);
        if (same) continue;
        const { status, json } = await g(c, "PUT", `/events/${id}`, ev);
        if (status !== 200) throw new Error(`Google update ${status}: ${JSON.stringify(json).slice(0, 200)}`);
        out.updated++;
        continue;
      }
      let res = await g(c, "POST", "/events", ev);
      // The id already exists (e.g. cancelled earlier): reuse it.
      if (res.status === 409) res = await g(c, "PUT", `/events/${id}`, ev);
      if (res.status !== 200) throw new Error(`Google create ${res.status}: ${JSON.stringify(res.json).slice(0, 200)}`);
      out.created++;
    }
  } catch (err) {
    console.error("Calendar sync failed:", err);
    out.error = err instanceof Error ? err.message.slice(0, 300) : "unknown error";
  }
  return out;
}
