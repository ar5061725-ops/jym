"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { sb, WorkoutsAPI, type Workout } from "@/lib/supabase";
import { useForm } from "@/lib/useForm";
import { friendlyError, fmtTime, haptic, MUSCLES, muscleLabel } from "@/lib/utils";
import { Field, Spinner } from "./Field";
import { AlertBox } from "./AuthScreens";
import { useToast } from "./Toast";

type Status = "loading" | "ready" | "error";

export function Tracker({ user }: { user: User }) {
  const toast = useToast();
  const name: string = user.user_metadata?.username || "مستخدم";
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [muscle, setMuscle] = useState("chest");
  const [removing, setRemoving] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const exerciseRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      setWorkouts(await WorkoutsAPI.listToday());
      setStatus("ready");
    } catch (err) {
      setError(friendlyError(err));
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const f = useForm({ exercise: "", weight: "", sets: "", reps: "" }, {
    validate: v =>
      !v.exercise ? { field: "exercise", message: "أدخل اسم التمرين" }
      : v.weight === "" || +v.weight < 0 ? { field: "weight", message: "أدخل وزناً صحيحاً (0 أو أكثر)" }
      : !(+v.sets >= 1) ? { field: "sets", message: "عدد الجولات يجب أن يكون 1 على الأقل" }
      : !(+v.reps >= 1) ? { field: "reps", message: "عدد التكرارات يجب أن يكون 1 على الأقل" }
      : null,
    submit: async v => {
      const row = await WorkoutsAPI.create({
        exercise: v.exercise,
        muscle,
        weight_kg: +v.weight,
        sets: parseInt(v.sets, 10),
        reps: parseInt(v.reps, 10),
      });
      setWorkouts(w => [row, ...w]);
      setStatus("ready");
      f.set("exercise")(""); // keep weight/sets/reps for the next set
      f.focus("exercise");
      haptic(15);
      toast(`تم حفظ «${row.exercise}»`);
    },
  });

  async function share(w: Workout) {
    const text = `${w.exercise} (${muscleLabel(w.muscle)}): ${Number(w.weight_kg)} كجم · ${w.sets}×${w.reps}`;
    try {
      if (navigator.share) await navigator.share({ title: "تمريني اليوم", text });
      else {
        await navigator.clipboard.writeText(text);
        toast("تم نسخ التمرين");
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") toast("تعذّرت المشاركة", { type: "error" });
    }
  }

  /** Optimistic delete with a short undo window, then commit to the DB */
  function remove(w: Workout) {
    setRemoving(w.id);
    let undone = false;
    setTimeout(() => {
      setWorkouts(l => l.filter(x => x.id !== w.id));
      setRemoving(null);
    }, 220);
    const restore = () =>
      setWorkouts(l => (l.some(x => x.id === w.id) ? l : [...l, w].sort((a, b) => b.created_at.localeCompare(a.created_at))));
    toast(`تم حذف «${w.exercise}»`, {
      action: "تراجع",
      duration: 4000,
      onAction: () => {
        undone = true;
        restore();
      },
    });
    setTimeout(async () => {
      if (undone) return;
      try {
        await WorkoutsAPI.remove(w.id);
      } catch (err) {
        restore();
        toast(friendlyError(err), { type: "error" });
      }
    }, 4100);
  }

  async function logout() {
    setLoggingOut(true);
    try {
      await sb.auth.signOut();
    } finally {
      setLoggingOut(false);
    }
  }

  const volume = workouts.reduce((s, w) => s + Number(w.weight_kg) * w.sets * w.reps, 0);
  const stats: [string | number, string][] = [
    [workouts.length, "تمارين"],
    [workouts.reduce((s, w) => s + w.sets, 0), "جولات"],
    [Math.round(volume).toLocaleString("ar"), "الحجم (كجم)"],
  ];

  return (
    <>
      <header className="topbar">
        <div className="inner">
          <div className="avatar">{name[0].toUpperCase()}</div>
          <div className="who">
            <small>مسجّل الدخول</small>
            <span>{name}</span>
          </div>
          <button
            className="btn btn-ghost"
            style={{ minHeight: 40, padding: "0 14px" }}
            disabled={loggingOut}
            onClick={() => {
              haptic();
              logout();
            }}
          >
            {loggingOut ? <Spinner /> : "خروج"}
          </button>
        </div>
      </header>

      <div className="wrap wide stack">
        <div className="stats">
          {stats.map(([v, l]) => (
            <div className="stat" key={l}>
              <b>{v}</b>
              <small>{l}</small>
            </div>
          ))}
        </div>

        <div className="split">
          <form className="card stack" ref={f.formRef} onSubmit={f.onSubmit} noValidate>
            <h2>تمرين جديد</h2>
            <AlertBox alert={f.alert} />
            <div ref={exerciseRef}>
              <Field name="exercise" label="اسم التمرين" placeholder="مثل: بنش برس، سكوات" list="exercise-suggest" value={f.values.exercise} onChange={f.set("exercise")} invalid={f.invalid === "exercise"} />
            </div>
            <div className="field">
              <label id="muscle-label">العضلة</label>
              <div className="chips" role="group" aria-labelledby="muscle-label">
                {MUSCLES.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    className="chip"
                    aria-pressed={m.id === muscle}
                    onClick={() => {
                      haptic();
                      setMuscle(m.id);
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid3">
              <Field name="weight" label="الوزن (كجم)" type="number" min="0" step="0.5" inputMode="decimal" value={f.values.weight} onChange={f.set("weight")} invalid={f.invalid === "weight"} />
              <Field name="sets" label="الجولات" type="number" min="1" step="1" inputMode="numeric" value={f.values.sets} onChange={f.set("sets")} invalid={f.invalid === "sets"} />
              <Field name="reps" label="التكرارات" type="number" min="1" step="1" inputMode="numeric" value={f.values.reps} onChange={f.set("reps")} invalid={f.invalid === "reps"} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={f.loading}>
              {f.loading ? (
                <>
                  <Spinner />
                  جارٍ الحفظ…
                </>
              ) : (
                "حفظ التمرين"
              )}
            </button>
          </form>

          <div className="stack">
            <div className="row-between">
              <h2>سجل اليوم</h2>
              <button className="icon-btn" aria-label="تحديث" onClick={() => { haptic(); load(); }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" />
                </svg>
              </button>
            </div>
            <ul className="log" aria-live="polite">
              {status === "loading" ? (
                <>
                  <li className="skeleton" />
                  <li className="skeleton" />
                  <li className="skeleton" />
                </>
              ) : status === "error" ? (
                <li className="empty">
                  <p style={{ margin: "0 0 10px" }}>{error}</p>
                  <button className="btn btn-ghost" onClick={load}>إعادة المحاولة</button>
                </li>
              ) : !workouts.length ? (
                <li className="empty">لا توجد تمارين اليوم بعد. ابدأ بأول تمرين!</li>
              ) : (
                workouts.map(w => (
                  <li key={w.id} className={`log-item${removing === w.id ? " removing" : ""}`}>
                    <div className="badge">{muscleLabel(w.muscle)}</div>
                    <div className="log-main">
                      <b>{w.exercise}</b>
                      <small>
                        {Number(w.weight_kg)} كجم · {w.sets} × {w.reps} · {fmtTime(w.created_at)}
                      </small>
                    </div>
                    <div className="log-actions">
                      <button className="icon-btn" aria-label="مشاركة" onClick={() => { haptic(); share(w); }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                          <path d="M12 3v13M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
                        </svg>
                      </button>
                      <button className="icon-btn danger" aria-label="حذف" onClick={() => { haptic(); remove(w); }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                          <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                        </svg>
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>

      <datalist id="exercise-suggest">
        {["بنش برس", "سكوات", "ديدلفت", "سحب أمامي", "ضغط أكتاف", "باي سبس", "تراي سبس", "بلانك"].map(n => (
          <option key={n} value={n} />
        ))}
      </datalist>
    </>
  );
}
