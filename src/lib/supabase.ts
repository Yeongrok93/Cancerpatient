import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type SurveySession = {
  id: string;
  patient_code: string | null;
  age: number | null;
  gender: string | null;
  cancer_type: string | null;
  treatment_type: string | null;
  started_at: string;
  completed_at: string | null;
  is_complete: boolean;
};

export type SurveyAnswer = {
  id: string;
  session_id: string;
  item_id: number;
  item_term_en: string;
  question_key: string;
  question_type: string;
  answer_value: number | null;
  answer_boolean: boolean | null;
};
