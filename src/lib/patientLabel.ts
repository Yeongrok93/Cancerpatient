// Display-only helpers: the study targets 150 participants, so numeric
// participant codes are shown zero-padded (1 → 001). The stored code is unchanged.

export function formatPatientCode(code: string | null | undefined): string {
  const c = String(code ?? "").trim();
  return /^\d+$/.test(c) ? c.padStart(3, "0") : c;
}

/** "001 (김인영)" — or just "001" when the name is unknown. */
export function patientLabel(code: string | null | undefined, name?: string | null): string {
  const n = String(name ?? "").trim();
  return n ? `${formatPatientCode(code)} (${n})` : formatPatientCode(code);
}
