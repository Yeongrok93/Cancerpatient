import { redirect } from "next/navigation";
import { startSurveySession } from "@/lib/actions";
import { patientCodeFromToken } from "@/lib/links";

// Per-patient survey link: /s/<token>/<w0|pro|qlq>. The token identifies the
// participant (no name/birth step) and drops them straight into that survey.

export const dynamic = "force-dynamic";

const TARGETS = {
  w0: { surveyType: "w0", route: "/survey/w0" },
  pro: { surveyType: "pro_ctcae", route: "/survey" },
  qlq: { surveyType: "qlq_c30", route: "/survey/qlq-c30" },
} as const;

function Message({ title, body, href }: { title: string; body: string; href?: string }) {
  return (
    <div className="max-w-xl mx-auto py-16 text-center space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <p className="text-lg text-gray-700 leading-relaxed">{body}</p>
      {href && (
        <a href={href} className="inline-block px-6 py-3 bg-primary-600 text-white font-semibold rounded-xl">
          설문 목록으로
        </a>
      )}
    </div>
  );
}

export default async function SurveyLinkPage({ params }: { params: Promise<{ token: string; type: string }> }) {
  const { token, type } = await params;
  const target = (TARGETS as Record<string, (typeof TARGETS)[keyof typeof TARGETS]>)[type];
  const code = await patientCodeFromToken(token);

  if (!code || !target) {
    return <Message title="링크를 확인해 주세요" body="유효하지 않은 링크입니다. 연구팀에서 받은 링크를 다시 확인해 주세요." />;
  }

  const result = await startSurveySession(code, target.surveyType);
  if (!result.ok) {
    return <Message title="지금은 작성할 수 없어요" body={result.error} href={`/select?code=${encodeURIComponent(code)}`} />;
  }
  redirect(`${target.route}?session=${result.sessionId}`);
}
