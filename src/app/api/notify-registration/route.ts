import { NextRequest, NextResponse } from "next/server";
import { sendSms } from "@/lib/solapi";

const SENDER_PHONE = "01035024598";
const NOTIFY_PHONES = ["01035024598", "01040188781"];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { name, recordOrBirth, researchTypes, contact } = body as {
    name?: string;
    recordOrBirth?: string;
    researchTypes?: string[];
    contact?: string;
  };

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  // SMS (not LMS) tops out around 45 Korean characters / 90 bytes, so this
  // drops 신청일시 (the text's own arrival time already conveys "now") and
  // packs the rest into one slash-separated line instead of labeled lines.
  const text = [
    name,
    recordOrBirth || "-",
    researchTypes?.length ? researchTypes.join(",") : "-",
    contact || "-",
  ].join("/");
  const smsText = `[연구참여신청] ${text}`;

  try {
    await sendSms({ to: NOTIFY_PHONES, from: SENDER_PHONE, text: smsText });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to send registration SMS:", err);
    // Registration itself already succeeded in the DB by the time this is
    // called — a notification failure shouldn't look like a request error.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
