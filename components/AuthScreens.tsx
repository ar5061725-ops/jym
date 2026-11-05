"use client";

import Link from "next/link";
import { useState } from "react";
import { sb } from "@/lib/supabase";
import { useForm } from "@/lib/useForm";
import { friendlyError, haptic, usernameToEmail } from "@/lib/utils";
import { Field, Spinner } from "./Field";
import { useToast } from "./Toast";

export function AlertBox({ alert }: { alert: { msg: string; kind: "error" | "ok" } | null }) {
  return alert ? (
    <div className={`alert ${alert.kind === "ok" ? "ok" : ""}`} role="alert">
      {alert.msg}
    </div>
  ) : null;
}

export function Logo({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" role="img" aria-label="متتبع النادي">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3B82F6" />
          <stop offset="1" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>
      <rect width="96" height="96" rx="26" fill="url(#lg)" />
      <g fill="#fff">
        <rect x="14" y="36" width="10" height="24" rx="4" />
        <rect x="25" y="29" width="11" height="38" rx="4" />
        <rect x="72" y="36" width="10" height="24" rx="4" />
        <rect x="60" y="29" width="11" height="38" rx="4" />
        <rect x="36" y="44" width="24" height="8" rx="3" />
      </g>
      <path d="M20 79h56" stroke="#fff" strokeOpacity=".55" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/** Sign in or register with a name or an email; remounted (key) when the mode changes */
function AuthForm({ mode }: { mode: "login" | "register" }) {
  const register = mode === "register";
  const f = useForm({ username: "", password: "", confirm: "" }, {
    validate: v =>
      v.username.length < 2 ? { field: "username", message: "أدخل اسماً أو بريداً إلكترونياً" }
      : v.username.includes("@") && !looksLikeEmail(v.username) ? { field: "username", message: "أدخل بريداً إلكترونياً صحيحاً" }
      : v.password.length < 6 ? { field: "password", message: "الرقم السري يجب أن يكون 6 خانات على الأقل" }
      : register && v.password !== v.confirm ? { field: "confirm", message: "الرقمان السريان غير متطابقين" }
      : null,
    submit: async (v, { alert }) => {
      const isMail = v.username.includes("@");
      const email = isMail ? v.username.toLowerCase() : await usernameToEmail(v.username);

      if (!register) {
        const { error } = await sb.auth.signInWithPassword({ email, password: v.password });
        if (error && /Invalid login credentials/i.test(error.message)) {
          throw new Error("الاسم أو الرقم السري غير صحيح. إذا لم يكن لديك حساب اضغط «تسجيل جديد».");
        }
        if (error) throw error;
        return;
      }

      const { data, error } = await sb.auth.signUp({
        email,
        password: v.password,
        options: isMail
          ? { emailRedirectTo: location.protocol.startsWith("http") ? location.origin : undefined }
          : { data: { username: v.username } },
      });
      if (error && /already registered|already been registered/i.test(error.message)) {
        throw new Error("هذا الاسم أو البريد مسجّل مسبقاً. سجّل الدخول بدلاً من ذلك.");
      }
      if (error) throw error;
      if (!data.session) alert("تم إنشاء الحساب! افتح بريدك لتأكيده ثم سجّل الدخول.", "ok");
    },
  });

  return (
    <form className="card stack" ref={f.formRef} onSubmit={f.onSubmit} noValidate>
      <h2>{register ? "تسجيل حساب جديد" : "تسجيل الدخول"}</h2>
      <AlertBox alert={f.alert} />
      <Field name="username" label="الاسم أو البريد الإلكتروني" autoComplete="username" value={f.values.username} onChange={f.set("username")} invalid={f.invalid === "username"} />
      <Field name="password" label="الرقم السري (6 خانات على الأقل)" type="password" autoComplete={register ? "new-password" : "current-password"} value={f.values.password} onChange={f.set("password")} invalid={f.invalid === "password"} />
      {register && (
        <Field name="confirm" label="تأكيد الرقم السري" type="password" autoComplete="new-password" value={f.values.confirm} onChange={f.set("confirm")} invalid={f.invalid === "confirm"} />
      )}
      <button className="btn btn-primary" type="submit" disabled={f.loading}>
        {f.loading ? (
          <>
            <Spinner />
            {register ? "جارٍ الإنشاء…" : "جارٍ الدخول…"}
          </>
        ) : register ? (
          "إنشاء الحساب"
        ) : (
          "دخول"
        )}
      </button>
    </form>
  );
}

export function LoginScreen({ fromStore = false }: { fromStore?: boolean }) {
  const toast = useToast();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [guestLoading, setGuestLoading] = useState(false);

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
        <Logo />
        <h1>متتبع النادي</h1>
        <p className="sub">سجّل تمارينك وتابع تقدّمك يومياً</p>
      </div>
      {fromStore && (
        <div className="alert info" role="note" style={{ marginBottom: 12 }}>
          تحتاج حسابًا لإضافة المنتجات إلى السلة. سجّل الدخول أو أنشئ حسابًا وستعود إلى المتجر مباشرة.
        </div>
      )}
      <AuthForm key={mode} mode={mode} />
      <p className="sub" style={{ textAlign: "center", marginTop: 12 }}>
        {mode === "login" ? "ليس لديك حساب؟" : "لديك حساب بالفعل؟"}{" "}
        <button className="btn-link" type="button" onClick={() => { haptic(); setMode(mode === "login" ? "register" : "login"); }}>
          {mode === "login" ? "تسجيل جديد" : "تسجيل الدخول"}
        </button>
      </p>
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
      <Link href="/store" className="btn btn-ghost" style={{ width: "100%", marginTop: 10 }}>
        تصفّح المتجر بدون حساب
      </Link>
      <p className="sub" style={{ textAlign: "center", fontSize: 13, marginTop: 10 }}>
        جرّب التطبيق بدون حساب. تمارينك تُحفظ على هذا الجهاز فقط ولن تستطيع استرجاعها بعد الخروج.
      </p>
    </div>
  );
}
