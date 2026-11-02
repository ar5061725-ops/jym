"use client";

import { sb } from "@/lib/supabase";
import { useForm } from "@/lib/useForm";
import { usernameToEmail } from "@/lib/utils";
import { Field, Spinner } from "./Field";

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

/** One form: enters directly; the account is created automatically the first time a name is used */
export function LoginScreen() {
  const f = useForm({ username: "", password: "" }, {
    validate: v =>
      v.username.length < 2 ? { field: "username", message: "أدخل اسماً من حرفين على الأقل" }
      : v.password.length < 6 ? { field: "password", message: "الرقم السري يجب أن يكون 6 خانات على الأقل" }
      : null,
    submit: async v => {
      const email = await usernameToEmail(v.username);
      const signIn = await sb.auth.signInWithPassword({ email, password: v.password });
      if (!signIn.error) return;
      if (!/Invalid login credentials/i.test(signIn.error.message)) throw signIn.error;

      // Unknown name → create it; a known name with a wrong password fails here
      const { error } = await sb.auth.signUp({ email, password: v.password, options: { data: { username: v.username } } });
      if (error && /already registered|already been registered/i.test(error.message)) {
        throw new Error("الرقم السري غير صحيح");
      }
      if (error) throw error;
    },
  });

  return (
    <div className="wrap">
      <div className="brand">
        <Logo />
        <h1>متتبع النادي</h1>
        <p className="sub">سجّل تمارينك وتابع تقدّمك يومياً</p>
      </div>
      <form className="card stack" ref={f.formRef} onSubmit={f.onSubmit} noValidate>
        <AlertBox alert={f.alert} />
        <Field name="username" label="الاسم" autoComplete="username" value={f.values.username} onChange={f.set("username")} invalid={f.invalid === "username"} />
        <Field name="password" label="الرقم السري" type="password" autoComplete="current-password" value={f.values.password} onChange={f.set("password")} invalid={f.invalid === "password"} />
        <button className="btn btn-primary" type="submit" disabled={f.loading}>
          {f.loading ? (
            <>
              <Spinner />
              جارٍ الدخول…
            </>
          ) : (
            "دخول"
          )}
        </button>
        <p className="sub" style={{ fontSize: 13, textAlign: "center" }}>
          أول مرة؟ اكتب اسماً ورقماً سرياً جديدين وسيُنشأ حسابك تلقائياً.
        </p>
      </form>
    </div>
  );
}
