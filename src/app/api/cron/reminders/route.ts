import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runReminders } from "@/lib/reminders";

// Called once a day by Vercel Cron (see vercel.json). Vercel sends
// `Authorization: Bearer $CRON_SECRET`; anything else is rejected.
// `?dry=1` lists who would get a text without sending or recording anything,
// and (dry only) `&today=YYYY-MM-DD` previews another day.

export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const dryRun = req.nextUrl.searchParams.get("dry") === "1";
  const todayParam = req.nextUrl.searchParams.get("today");
  const today = dryRun && todayParam && /^\d{4}-\d{2}-\d{2}$/.test(todayParam) ? todayParam : undefined;

  try {
    return NextResponse.json(await runReminders({ dryRun, today }));
  } catch (err) {
    console.error("Reminder run failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "failed" }, { status: 500 });
  }
}
