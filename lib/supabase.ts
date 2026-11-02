import { createClient } from "@supabase/supabase-js";

// Publishable key only: safe in the browser, RLS protects the data.
export const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_KEY!,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
);

export const TABLE = "workouts";

export type Workout = {
  id: string;
  exercise: string;
  muscle: string;
  weight_kg: number;
  sets: number;
  reps: number;
  created_at: string;
};

export const WorkoutsAPI = {
  async listToday(): Promise<Workout[]> {
    const { data, error } = await sb
      .from(TABLE)
      .select("id, exercise, muscle, weight_kg, sets, reps, created_at")
      .gte("created_at", startOfToday())
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as Workout[];
  },
  async create(w: Omit<Workout, "id" | "created_at">): Promise<Workout> {
    const { data, error } = await sb.from(TABLE).insert(w).select().single();
    if (error) throw error;
    return data as Workout;
  },
  async remove(id: string) {
    const { error } = await sb.from(TABLE).delete().eq("id", id);
    if (error) throw error;
  },
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
