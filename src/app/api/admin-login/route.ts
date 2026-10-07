import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  ADMIN_COOKIE_MAX_AGE,
  computeAdminToken,
  verifyAdminCredentials,
} from "@/lib/adminAuth";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  // 10 attempts per 15 minutes per IP.
  if (!rateLimit(`admin-login:${clientIp(req.headers)}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "시도 횟수가 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  const { username, password } = await req
    .json()
    .catch(() => ({ username: undefined, password: undefined }));

  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "ADMIN_PASSWORD가 서버에 설정되어 있지 않습니다." }, { status: 500 });
  }
  if (!(await verifyAdminCredentials(username, password))) {
    return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const token = await computeAdminToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, token!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_COOKIE_MAX_AGE,
  });
  return res;
}
