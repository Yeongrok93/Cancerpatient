// ADC drugs in the study. clinical_info.adc_drug stores the `value`.
export const ADC_DRUGS = [
  { value: "T-DXd", label: "Trastuzumab deruxtecan (엔허투, T-DXd)" },
  { value: "T-DM1", label: "Trastuzumab emtansine (캐싸일라, T-DM1)" },
  { value: "EV", label: "Enfortumab vedotin (패드세브, EV)" },
  { value: "SG", label: "Sacituzumab govitecan (트로델비, SG)" },
  { value: "PV", label: "Polatuzumab vedotin (폴라투주맙 베도틴, 폴라이비, PV)" },
] as const;

export type AdcDrug = (typeof ADC_DRUGS)[number]["value"];
