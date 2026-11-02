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
  muscle: string | null;
  category: string | null;
  subcategory: string | null;
  weight_kg: number;
  sets: number;
  reps: number;
  created_at: string;
};

export type CatalogItem = {
  id: string;
  category: string;
  subcategory: string;
  name: string;
  uses_weight: boolean;
};

export type SlotRow = {
  slot_id: string;
  day: string; // YYYY-MM-DD
  weekday: number;
  start_time: string; // HH:MM:SS
  label: string;
  capacity: number;
  booked: number;
  is_full: boolean;
  mine: boolean;
};

export const BookingsAPI = {
  async upcoming(from: string, days = 7): Promise<SlotRow[]> {
    const { data, error } = await sb.rpc("upcoming_slots", { p_from: from, p_days: days });
    if (error) throw error;
    return data as SlotRow[];
  },
  async book(slotId: string, day: string) {
    const { error } = await sb.from("bookings").insert({ slot_id: slotId, booking_date: day });
    if (error) throw error;
  },
  async cancel(slotId: string, day: string) {
    const { error } = await sb.from("bookings").delete().eq("slot_id", slotId).eq("booking_date", day);
    if (error) throw error;
  },
};

export const CatalogAPI = {
  async list(): Promise<CatalogItem[]> {
    const { data, error } = await sb
      .from("exercise_catalog")
      .select("id, category, subcategory, name, uses_weight")
      .order("sort");
    if (error) throw error;
    return data as CatalogItem[];
  },
};

export const WorkoutsAPI = {
  async listToday(): Promise<Workout[]> {
    const { data, error } = await sb
      .from(TABLE)
      .select("id, exercise, muscle, category, subcategory, weight_kg, sets, reps, created_at")
      .gte("created_at", startOfToday())
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as Workout[];
  },
  async create(w: Omit<Workout, "id" | "created_at" | "muscle">): Promise<Workout> {
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
