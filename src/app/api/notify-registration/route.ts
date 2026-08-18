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

  const appliedAt = new Date().toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const text = [
    "[연구참여신청]",
    "",
    `신청일시: ${appliedAt}`,
    `이름: ${name}`,
    `생년월일: ${recordOrBirth || "-"}`,
    `연구종류: ${researchTypes?.length ? researchTypes.join(", ") : "-"}`,
    `연락처: ${contact || "-"}`,
  ].join("\n");

  try {
    await sendSms({ to: NOTIFY_PHONES, from: SENDER_PHONE, text });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to send registration SMS:", err);
    // Registration itself already succeeded in the DB by the time this is
    // called — a notification failure shouldn't look like a request error.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
