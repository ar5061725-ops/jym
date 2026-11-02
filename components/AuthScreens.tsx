"use client";

import { useState } from "react";
import { sb } from "@/lib/supabase";
import { useForm } from "@/lib/useForm";
import { friendlyError, haptic, isEmail } from "@/lib/utils";
import { Field, Spinner } from "./Field";
import { useToast } from "./Toast";

export function AlertBox({ alert }: { alert: { msg: string; kind: "error" | "ok" } | null }) {
  return alert ? (
    <div className={`alert ${alert.kind === "ok" ? "ok" : ""}`} role="alert">
      {alert.msg}
    </div>
  ) : null;
}

function Submit({ loading, text, loadingText }: { loading: boolean; text: string; loadingText: string }) {
  return (
    <button className="btn btn-primary" type="submit" disabled={loading}>
      {loading ? (
        <>
          <Spinner />
          {loadingText}
        </>
      ) : (
        text
      )}
    </button>
  );
}

const emailProblem = { field: "email", message: "أدخل بريداً إلكترونياً صحيحاً" };
const redirectTo = () => (location.protocol.startsWith("http") ? location.href : undefined);

export function LoginScreen({ push }: { push: (name: string) => void }) {
  const toast = useToast();
  const [guestLoading, setGuestLoading] = useState(false);
  const f = useForm({ email: "", password: "" }, {
    validate: v => (!isEmail(v.email) ? emailProblem : !v.password ? { field: "password", message: "أدخل كلمة المرور" } : null),
    submit: async v => {
      const { error } = await sb.auth.signInWithPassword({ email: v.email, password: v.password });
      if (error) throw error;
    },
  });

  async function guest() {
    setGuestLoading(true);
    try {
      const { error } = await sb.auth.signInAnonymously();
      if (error) throw error;
    } catch (err) {
      toast(friendlyError(err), { type: "error", duration: 4000 });
      haptic([20, 40, 20]);
    } finally {
      setGuestLoading(false);
    }
  }

  return (
    <div className="wrap">
      <div className="brand">
        <div className="logo" aria-hidden="true">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12" />
          </svg>
        </div>
        <h1>متتبع النادي</h1>
        <p className="sub">سجّل تمارينك وتابع تقدّمك يومياً</p>
      </div>
      <form className="card stack" ref={f.formRef} onSubmit={f.onSubmit} noValidate>
        <AlertBox alert={f.alert} />
        <Field name="email" label="البريد الإلكتروني" type="email" autoComplete="email" value={f.values.email} onChange={f.set("email")} invalid={f.invalid === "email"} />
        <Field name="password" label="كلمة المرور" type="password" autoComplete="current-password" value={f.values.password} onChange={f.set("password")} invalid={f.invalid === "password"} />
        <Submit loading={f.loading} text="تسجيل الدخول" loadingText="جارٍ الدخول…" />
        <div className="row-between">
          <button className="btn-link" type="button" onClick={() => push("forgot")}>نسيت كلمة المرور؟</button>
          <button className="btn-link" type="button" onClick={() => push("signup")}>حساب جديد</button>
        </div>
      </form>
      <div className="divider"><span>أو</span></div>
      <button className="btn btn-ghost" type="button" style={{ width: "100%" }} onClick={guest} disabled={guestLoading}>
        {guestLoading ? (
          <>
            <Spinner />
            جارٍ الدخول…
          </>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21a8 8 0 0 1 16 0" />
            </svg>
            الدخول كزائر
          </>
        )}
      </button>
      <p className="sub" style={{ textAlign: "center", fontSize: 13, marginTop: 10 }}>
        جرّب التطبيق بدون بريد. لن تتمكن من استرجاع تمارينك بعد الخروج.
      </p>
    </div>
  );
}

export function SignupScreen({ back }: { back: () => void }) {
  const f = useForm({ email: "", password: "", confirm: "" }, {
    validate: v =>
      !isEmail(v.email) ? emailProblem
      : v.password.length < 6 ? { field: "password", message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }
      : v.password !== v.confirm ? { field: "confirm", message: "كلمتا المرور غير متطابقتين" }
      : null,
    submit: async (v, { alert, reset }) => {
      const { data, error } = await sb.auth.signUp({ email: v.email, password: v.password, options: { emailRedirectTo: redirectTo() } });
      if (error) throw error;
      reset();
      if (!data.session) alert("تم إنشاء الحساب! افتح بريدك لتأكيده ثم سجّل الدخول.", "ok");
    },
  });

  return (
    <div className="wrap">
      <div className="back-row">
        <button className="icon-btn" onClick={back} aria-label="رجوع">›</button>
        <h2>إنشاء حساب جديد</h2>
      </div>
      <p className="sub" style={{ marginBottom: 16 }}>اسحب من حافة الشاشة للرجوع</p>
      <form className="card stack" ref={f.formRef} onSubmit={f.onSubmit} noValidate>
        <AlertBox alert={f.alert} />
        <Field name="email" label="البريد الإلكتروني" type="email" autoComplete="email" value={f.values.email} onChange={f.set("email")} invalid={f.invalid === "email"} />
        <Field name="password" label="كلمة المرور (6 أحرف على الأقل)" type="password" autoComplete="new-password" value={f.values.password} onChange={f.set("password")} invalid={f.invalid === "password"} />
        <Field name="confirm" label="تأكيد كلمة المرور" type="password" autoComplete="new-password" value={f.values.confirm} onChange={f.set("confirm")} invalid={f.invalid === "confirm"} />
        <Submit loading={f.loading} text="إنشاء الحساب" loadingText="جارٍ الإنشاء…" />
      </form>
    </div>
  );
}

export function ForgotScreen({ back }: { back: () => void }) {
  const f = useForm({ email: "" }, {
    validate: v => (!isEmail(v.email) ? emailProblem : null),
    submit: async (v, { alert }) => {
      const { error } = await sb.auth.resetPasswordForEmail(v.email, { redirectTo: redirectTo() });
      if (error) throw error;
      alert("تم الإرسال. تحقق من بريدك الإلكتروني.", "ok");
    },
  });

  return (
    <div className="wrap">
      <div className="back-row">
        <button className="icon-btn" onClick={back} aria-label="رجوع">›</button>
        <h2>استعادة كلمة المرور</h2>
      </div>
      <p className="sub" style={{ marginBottom: 16 }}>سنرسل لك رابطاً لإعادة تعيين كلمة المرور</p>
      <form className="card stack" ref={f.formRef} onSubmit={f.onSubmit} noValidate>
        <AlertBox alert={f.alert} />
        <Field name="email" label="البريد الإلكتروني" type="email" autoComplete="email" value={f.values.email} onChange={f.set("email")} invalid={f.invalid === "email"} />
        <Submit loading={f.loading} text="إرسال الرابط" loadingText="جارٍ الإرسال…" />
      </form>
    </div>
  );
}
