export const MUSCLES = [
  { id: "chest", label: "صدر" },
  { id: "back", label: "ظهر" },
  { id: "legs", label: "أرجل" },
  { id: "shoulders", label: "أكتاف" },
  { id: "arms", label: "ذراعين" },
];

export const muscleLabel = (id: string) => MUSCLES.find(m => m.id === id)?.label ?? id;

export const haptic = (ms: number | number[] = 10) => {
  try {
    navigator.vibrate?.(ms);
  } catch {}
};

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("ar", { hour: "numeric", minute: "2-digit" });

/** Supabase auth needs an email, so a name maps to a stable internal address (never shown or mailed) */
export async function usernameToEmail(username: string) {
  const bytes = new TextEncoder().encode(username.trim().toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
  return `u${hex}@gym-app.dev`;
}

/** Maps Supabase/network errors to friendly Arabic messages */
export function friendlyError(err: unknown): string {
  const e = err as { message?: string; error_description?: string } | null;
  const m = e?.message || e?.error_description || String(err ?? "");
  if (/Invalid login credentials/i.test(m)) return "البريد أو كلمة المرور غير صحيحة";
  if (/Email not confirmed/i.test(m)) return "يرجى تأكيد بريدك الإلكتروني أولاً من الرسالة المرسلة";
  if (/already registered|already been registered/i.test(m)) return "هذا البريد مسجّل مسبقاً";
  if (/Password should be at least/i.test(m)) return "كلمة المرور قصيرة جداً";
  if (/Anonymous sign-ins are disabled/i.test(m)) return "الدخول كزائر غير مفعّل حالياً";
  if (/rate limit|too many/i.test(m)) return "محاولات كثيرة، انتظر قليلاً ثم أعد المحاولة";
  if (/Failed to fetch|NetworkError|network/i.test(m)) return "تعذّر الاتصال بالخادم، تحقق من الإنترنت";
  return m || "حدث خطأ غير متوقع";
}
