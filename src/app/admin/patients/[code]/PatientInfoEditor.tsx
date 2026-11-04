"use client";

// 환자 기본정보 조회·수정: 신청 정보(이름·생년월일·연락처·성별·연구시작일·비고) + 기본정보 설문(W0) 응답.
// W0 answers save one at a time as soon as they are changed (select / checkbox) or left (number box).

import { useEffect, useState } from "react";
import {
  adminGetClinicalInfo,
  adminSaveClinicalInfo,
  type ClinicalInfo,
  adminGetParticipantInfo,
  adminGetW0,
  adminSetW0Answer,
  adminUpdateParticipantInfo,
  type AdminW0,
  type ParticipantInfo,
} from "@/lib/adminActions";
import { ADC_DRUGS } from "@/lib/adcDrugs";
import {
  DEMOGRAPHICS,
  ECOG_KEY,
  ECOG_OPTIONS,
  EMERGENCY_SCREENING,
  IPAQ_ITEMS,
  SITTING_KEYS,
  SITTING_LABEL,
  type W0Question,
} from "@/lib/w0";

type Answers = NonNullable<AdminW0>["answers"];

const inputCls = "h-9 px-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white";

const EMPTY_CLINICAL: ClinicalInfo = {
  adc_drug: "",
  cancer_type: "",
  cancer_stage: "",
  tx_line: "",
  ecog: "",
  comorbidity_count: "",
  comorbidity_names: "",
};

type CtlProps = { answers: Answers; onSave: (key: string, value: number | string | null) => void };

const numOf = (answers: Answers, key: string) =>
  answers[key]?.num === null || answers[key]?.num === undefined ? "" : String(answers[key].num);

function NumberBox({ k, min, max, unit, answers, onSave }: CtlProps & { k: string; min: number; max: number; unit?: string }) {
  const [v, setV] = useState(numOf(answers, k));
  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          if (v !== numOf(answers, k)) onSave(k, v === "" ? null : Number(v));
        }}
        className={`${inputCls} w-20`}
      />
      {unit && <span className="text-sm text-gray-600">{unit}</span>}
    </span>
  );
}

function Choice({ k, options, answers, onSave }: CtlProps & { k: string; options: { value: number; label: string }[] }) {
  return (
    <select
      value={numOf(answers, k)}
      onChange={(e) => onSave(k, e.target.value === "" ? null : Number(e.target.value))}
      className={`${inputCls} max-w-full`}
    >
      <option value="">(미응답)</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Multi({
  k,
  options,
  exclusive,
  answers,
  onSave,
}: CtlProps & { k: string; options: { value: number; label: string }[]; exclusive?: number }) {
  const current = new Set((answers[k]?.text ?? "").split(",").filter(Boolean).map(Number));
  function toggle(value: number) {
    const next = new Set(current);
    if (next.has(value)) next.delete(value);
    else {
      if (value === exclusive) next.clear();
      else if (exclusive !== undefined) next.delete(exclusive);
      next.add(value);
    }
    onSave(k, next.size === 0 ? null : [...next].sort((a, b) => a - b).join(","));
  }
  return (
    <div className="flex flex-wrap gap-3">
      {options.map((o) => (
        <label key={o.value} className="inline-flex items-center gap-1.5 text-sm text-gray-900">
          <input type="checkbox" checked={current.has(o.value)} onChange={() => toggle(o.value)} />
          {o.label}
        </label>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      {children}
    </label>
  );
}

export default function PatientInfoEditor({ code }: { code: string }) {
  const [info, setInfo] = useState<ParticipantInfo | null>(null);
  const [draft, setDraft] = useState({ name: "", record_or_birth: "", contact: "", gender: "", study_start_date: "", remark: "" });
  const [w0, setW0] = useState<AdminW0>(null);
  const [clinical, setClinical] = useState<ClinicalInfo>(EMPTY_CLINICAL);
  const [clinMsg, setClinMsg] = useState("");
  const [savingClin, setSavingClin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [infoMsg, setInfoMsg] = useState("");
  const [w0Msg, setW0Msg] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([adminGetParticipantInfo(code), adminGetW0(code), adminGetClinicalInfo(code)])
      .then(([p, w, c]) => {
        if (cancelled) return;
        setClinical(c);
        setInfo(p);
        setW0(w);
        if (p) {
          setDraft({
            name: p.name,
            record_or_birth: p.record_or_birth,
            contact: p.contact,
            gender: p.gender ?? "",
            study_start_date: p.study_start_date ?? "",
            remark: p.remark ?? "",
          });
        }
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setInfoMsg("정보를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  async function saveClinical() {
    if (savingClin) return;
    setSavingClin(true);
    setClinMsg("");
    const res = await adminSaveClinicalInfo(code, clinical).catch(() => ({ ok: false as const, error: "저장에 실패했습니다." }));
    setSavingClin(false);
    setClinMsg(res.ok ? "저장했어요." : res.error);
  }

  async function saveInfo() {
    if (!info || savingInfo) return;
    setSavingInfo(true);
    setInfoMsg("");
    const res = await adminUpdateParticipantInfo(info.id, draft).catch(() => ({ ok: false as const, error: "저장에 실패했습니다." }));
    setSavingInfo(false);
    setInfoMsg(res.ok ? "저장했어요." : res.error);
  }

  async function saveW0(key: string, value: number | string | null) {
    if (!w0) return;
    setW0Msg("");
    const res = await adminSetW0Answer(w0.sessionId, key, value).catch(() => ({ ok: false as const, error: "저장에 실패했습니다." }));
    if (!res.ok) {
      setW0Msg(res.error);
      return;
    }
    setW0Msg("저장했어요.");
    setW0((prev) => {
      if (!prev) return prev;
      const answers: Answers = { ...prev.answers };
      if (value === null || value === "") delete answers[key];
      else if (typeof value === "string") answers[key] = { num: null, text: value };
      else answers[key] = { num: value, text: null };
      return { ...prev, answers };
    });
  }

  if (loading) return <div className="p-8 text-center text-gray-400 text-sm">불러오는 중...</div>;
  if (!info) return <div className="p-8 text-center text-gray-400 text-sm">참여자 정보를 찾을 수 없습니다.</div>;

  const answers = w0?.answers ?? {};
  const ctl = { answers, onSave: saveW0 };

  function demographicControl(q: W0Question) {
    if (q.type === "radio") return <Choice k={q.key} options={q.options} {...ctl} />;
    if (q.type === "multi") return <Multi k={q.key} options={q.options} exclusive={q.exclusiveValue} {...ctl} />;
    if (q.type === "number") return <NumberBox k={q.key} min={q.min ?? 0} max={q.max ?? 1000} unit={q.unit} {...ctl} />;
    return null;
  }

  return (
    <div className="p-5 space-y-8">
      {/* 임상정보: 연구자가 입력 (환자 설문에는 없음) */}
      <section className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-sm font-bold text-gray-900">임상정보</h2>
          <span className="text-xs text-gray-500">연구자 입력 · 환자 설문에는 나오지 않아요</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl">
          <Field label="투약 ADC 약제명">
            <select className={`${inputCls} w-full`} value={clinical.adc_drug} onChange={(e) => setClinical({ ...clinical, adc_drug: e.target.value })}>
              <option value="">(선택)</option>
              {ADC_DRUGS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="암 진단명">
            <input className={`${inputCls} w-full`} value={clinical.cancer_type} onChange={(e) => setClinical({ ...clinical, cancer_type: e.target.value })} placeholder="병명 기재" />
          </Field>
          <Field label="병기">
            <select
              className={`${inputCls} w-full`}
              value={clinical.cancer_stage}
              onChange={(e) => setClinical({ ...clinical, cancer_stage: e.target.value as ClinicalInfo["cancer_stage"] })}
            >
              <option value="">(미입력)</option>
              {["I", "II", "III", "IV"].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="치료 차수 (숫자, 예: 1)">
            <input className={`${inputCls} w-full`} inputMode="numeric" value={clinical.tx_line} onChange={(e) => setClinical({ ...clinical, tx_line: e.target.value })} />
          </Field>
          <Field label="ECOG 전신수행능력 (연구자 평가, 0~4)">
            <input className={`${inputCls} w-full`} inputMode="numeric" value={clinical.ecog} onChange={(e) => setClinical({ ...clinical, ecog: e.target.value })} />
          </Field>
          <Field label="동반질환 개수 (숫자)">
            <input
              className={`${inputCls} w-full`}
              inputMode="numeric"
              value={clinical.comorbidity_count}
              onChange={(e) => setClinical({ ...clinical, comorbidity_count: e.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="동반질환 진단명 (모두 기재)">
              <textarea
                rows={2}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                value={clinical.comorbidity_names}
                onChange={(e) => setClinical({ ...clinical, comorbidity_names: e.target.value })}
              />
            </Field>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={saveClinical}
            disabled={savingClin}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-black disabled:bg-gray-200 disabled:text-gray-400"
          >
            {savingClin ? "저장 중..." : "임상정보 저장"}
          </button>
          <span className="text-xs text-gray-600">{clinMsg}</span>
        </div>
      </section>

      {/* 신청 정보 */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-gray-900">참여자 정보</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl">
          <Field label="이름">
            <input className={`${inputCls} w-full`} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <Field label="생년월일">
            <input
              className={`${inputCls} w-full`}
              value={draft.record_or_birth}
              onChange={(e) => setDraft({ ...draft, record_or_birth: e.target.value })}
            />
          </Field>
          <Field label="연락처">
            <input className={`${inputCls} w-full`} value={draft.contact} onChange={(e) => setDraft({ ...draft, contact: e.target.value })} />
          </Field>
          <Field label="성별 (증상 설문 문항에 반영)">
            <select className={`${inputCls} w-full`} value={draft.gender} onChange={(e) => setDraft({ ...draft, gender: e.target.value })}>
              <option value="">(미입력 — 모든 문항 표시)</option>
              <option value="female">여성</option>
              <option value="male">남성</option>
            </select>
          </Field>
          <Field label="연구참여시작일">
            <input
              type="date"
              className={`${inputCls} w-full`}
              value={draft.study_start_date}
              onChange={(e) => setDraft({ ...draft, study_start_date: e.target.value })}
            />
          </Field>
          <Field label="비고">
            <input className={`${inputCls} w-full`} value={draft.remark} onChange={(e) => setDraft({ ...draft, remark: e.target.value })} />
          </Field>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={saveInfo}
            disabled={savingInfo}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-black disabled:bg-gray-200 disabled:text-gray-400"
          >
            {savingInfo ? "저장 중..." : "참여자 정보 저장"}
          </button>
          <span className="text-xs text-gray-600">{infoMsg}</span>
        </div>
      </section>

      {/* 기본정보 설문(W0) */}
      <section className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-sm font-bold text-gray-900">기본정보 설문 응답</h2>
          <span className="text-xs text-gray-600">{w0Msg || "값을 바꾸면 바로 저장돼요."}</span>
        </div>

        {!w0 ? (
          <p className="text-sm text-gray-400">완료된 기본정보 설문이 없습니다.</p>
        ) : (
          <div className="space-y-6 max-w-3xl">
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500">인구학적 정보</p>
              {DEMOGRAPHICS.map((q) => (
                <div key={q.key} className="grid grid-cols-[9rem_1fr] gap-3 items-center">
                  <span className="text-sm text-gray-900">{q.label}</span>
                  {demographicControl(q)}
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500">환자보고 ECOG</p>
              <Choice k={ECOG_KEY} options={ECOG_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} {...ctl} />
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500">신체활동 (IPAQ) — 지난 7일</p>
              {IPAQ_ITEMS.map((it) => (
                <div key={it.id} className="grid grid-cols-[9rem_1fr] gap-3 items-center">
                  <span className="text-sm text-gray-900">{it.activityLabel}</span>
                  <span className="flex flex-wrap items-center gap-2">
                    <NumberBox k={it.daysKey} min={0} max={7} unit="일" {...ctl} />
                    <NumberBox k={it.hoursKey} min={0} max={24} unit="시간" {...ctl} />
                    <NumberBox k={it.minutesKey} min={0} max={59} unit="분 / 일" {...ctl} />
                  </span>
                </div>
              ))}
              <div className="grid grid-cols-[9rem_1fr] gap-3 items-center" title={SITTING_LABEL}>
                <span className="text-sm text-gray-900">앉아 있는 시간</span>
                <span className="flex flex-wrap items-center gap-2">
                  <NumberBox k={SITTING_KEYS.hours} min={0} max={24} unit="시간" {...ctl} />
                  <NumberBox k={SITTING_KEYS.minutes} min={0} max={59} unit="분 / 일" {...ctl} />
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500">응급 증상 선별</p>
              {EMERGENCY_SCREENING.map((q) => (
                <div key={q.key} className="grid grid-cols-[9rem_1fr] gap-3 items-center" title={q.question}>
                  <span className="text-sm text-gray-900">{q.title}</span>
                  <Choice k={q.key} options={q.options} {...ctl} />
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
