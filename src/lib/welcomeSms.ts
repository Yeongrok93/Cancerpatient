// Text sent to a participant when 연구참여 확인 is ticked: their own three survey links.
// Server-only (reads SITE_URL).

const SITE_URL = (process.env.SITE_URL ?? "https://cancerpatient.vercel.app").replace(/\/+$/, "");

export function buildLinksText(accessToken: string): string {
  const base = `${SITE_URL}/s/${accessToken}`;
  return [
    "연구에 참여해주셔서 감사합니다. 오늘 말씀드린 것처럼 아래 3가지 설문 작성을 부탁드립니다.",
    "",
    `1. 기본정보 : ${base}/w0`,
    "",
    `2. 증상설문 : ${base}/pro`,
    "",
    `3. 삶의 질 : ${base}/qlq`,
  ].join("\n");
}
