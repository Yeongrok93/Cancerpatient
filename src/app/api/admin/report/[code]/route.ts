import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { loadReportInput } from "@/lib/reportData";
import { renderReportHtml } from "@/lib/report";

// Clinic hand-out for one patient. Admin-only (this route is outside the /admin
// proxy matcher, so it checks the session cookie itself).
//   GET /api/admin/report/<code>            → printable HTML ("PDF로 저장" from the browser)
//   ?print=1                                → also opens the print dialog on load
//   ?date=YYYY-MM-DD                        → print that date as 작성일
//   ?lang=en                                → English version
//   ?sample=1                               → layout preview with made-up notes; only when
//                                             ALLOW_REPORT_SAMPLE=1 (local use)
// The same document is produced from the command line with `npm run report`.

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  if (!(await isAdminRequest(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const code = decodeURIComponent((await params).code ?? "").trim();
  if (!code) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const q = req.nextUrl.searchParams;
  const dateParam = q.get("date");
  const asOf = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? new Date(`${dateParam}T12:00:00+09:00`) : undefined;

  const input = await loadReportInput(code, {
    asOf,
    autoPrint: q.get("print") === "1",
    sampleNotes: q.get("sample") === "1" && process.env.ALLOW_REPORT_SAMPLE === "1",
    lang: q.get("lang") === "en" ? "en" : "ko",
  });
  if (!input) return NextResponse.json({ error: "not found" }, { status: 404 });

  return new NextResponse(renderReportHtml(input), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
