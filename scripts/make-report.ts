// Builds the clinic hand-out for one patient as an HTML file and a PDF.
//
//   npm run report -- 1                      # participant code 1 → preview/report-001-<today>.pdf
//   npm run report -- 1 --date 2026-10-21    # print that date as 작성일
//   npm run report -- 1 --sample             # layout preview with made-up notes (not real data)
//   npm run report -- 1 --html-only          # skip the PDF step
//   npm run report -- 1 --out some/folder
//
// Uses the same code as the admin route (src/lib/reportData.ts + report.ts), then prints the
// HTML to PDF with a local Chrome/Edge (override with REPORT_BROWSER=<path to the executable>).
// The output folder defaults to ./preview, which is git-ignored because it holds patient data.

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { spawnSync } from "child_process";
import path from "path";
import { pathToFileURL } from "url";
import { loadReportInput } from "../src/lib/reportData";
import { renderReportHtml } from "../src/lib/report";
import { formatPatientCode } from "../src/lib/patientLabel";

const BROWSER_CANDIDATES = [
  process.env.REPORT_BROWSER,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter((p): p is string => !!p);

function parseArgs(argv: string[]) {
  const flags = new Set<string>();
  const values: Record<string, string> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--sample" || a === "--html-only") flags.add(a);
    else if (a === "--date" || a === "--out") values[a] = argv[++i] ?? "";
    else if (a.startsWith("--")) throw new Error(`알 수 없는 옵션: ${a}`);
    else positional.push(a);
  }
  return { flags, values, positional };
}

function countPdfPages(file: string): number {
  return (readFileSync(file).toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}

async function main() {
  const { flags, values, positional } = parseArgs(process.argv.slice(2));
  const code = positional[0]?.trim();
  if (!code) throw new Error("사용법: npm run report -- <참여자번호> [--date YYYY-MM-DD] [--sample] [--html-only] [--out 폴더]");

  const dateArg = values["--date"];
  if (dateArg && !/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) throw new Error("--date는 YYYY-MM-DD 형식이어야 합니다.");
  const asOf = dateArg ? new Date(`${dateArg}T12:00:00+09:00`) : undefined;

  const input = await loadReportInput(code, { asOf, sampleNotes: flags.has("--sample") });
  if (!input) throw new Error(`참여자번호 ${code}에 해당하는 참여자가 없습니다.`);

  const stamp = (dateArg ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date())).replace(/-/g, "");
  const outDir = path.resolve(values["--out"] || "preview");
  mkdirSync(outDir, { recursive: true });
  const base = path.join(outDir, `report-${formatPatientCode(code)}-${stamp}${flags.has("--sample") ? "-sample" : ""}`);

  writeFileSync(`${base}.html`, renderReportHtml(input), "utf8");
  console.log(`HTML  ${base}.html`);
  console.log(`자료 ID ${input.dataId}`);
  if (flags.has("--html-only")) return;

  const browser = BROWSER_CANDIDATES.find((p) => existsSync(p));
  if (!browser) throw new Error("PDF 변환에 쓸 Chrome/Edge를 찾지 못했습니다. REPORT_BROWSER 환경변수에 실행 파일 경로를 지정하세요.");

  const run = spawnSync(
    browser,
    ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", `--print-to-pdf=${base}.pdf`, pathToFileURL(`${base}.html`).href],
    { timeout: 90_000, stdio: "ignore" }
  );
  if (run.error || !existsSync(`${base}.pdf`) || statSync(`${base}.pdf`).size === 0) {
    throw new Error(`PDF 변환에 실패했습니다 (${run.error?.message ?? `종료 코드 ${run.status}`}).`);
  }
  console.log(`PDF   ${base}.pdf  (${countPdfPages(`${base}.pdf`)}쪽)`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
);
