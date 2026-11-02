"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { sb } from "@/lib/supabase";
import { haptic } from "@/lib/utils";
import { ForgotScreen, LoginScreen, SignupScreen } from "@/components/AuthScreens";
import { ToastProvider, useToast } from "@/components/Toast";
import { Tracker } from "@/components/Tracker";

function Screen({ name, stack, children }: { name: string; stack: string[]; children: React.ReactNode }) {
  const i = stack.indexOf(name);
  const cls = i === -1 ? "off-start" : i === stack.length - 1 ? "" : "off-end";
  return (
    <section className={`screen ${cls}`} id={`s-${name}`} data-screen={name}>
      {children}
    </section>
  );
}

function App() {
  const toast = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [stack, setStack] = useState<string[]>(["login"]);
  const stackRef = useRef(stack);
  stackRef.current = stack;
  const userId = useRef<string | null>(null);

  const push = useCallback((name: string) => { haptic(); setStack(s => [...s, name]); }, []);
  const back = useCallback(() => setStack(s => { if (s.length < 2) return s; haptic(); return s.slice(0, -1); }), []);

  /* Auth session — reads the stored session automatically */
  useEffect(() => {
    const onSession = (u: User | null) => {
      if (u && u.id === userId.current) return; // token refresh — nothing to redraw
      userId.current = u?.id ?? null;
      setUser(u);
      setStack([u ? "app" : "login"]);
      setReady(true);
    };
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") toast("تم تسجيل الخروج");
      if (event === "SIGNED_IN" && !userId.current) toast("أهلاً بك!");
      onSession(session?.user ?? null);
    });
    sb.auth.getSession().then(({ data }) => onSession(data.session?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, [toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && back();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [back]);

  /* Edge swipe back: in RTL the back gesture starts at the right edge */
  useEffect(() => {
    const EDGE = 28;
    let active = false, sx = 0, sy = 0, dx = 0;
    let cur: HTMLElement | null = null, prev: HTMLElement | null = null;
    const el = (n: string) => document.querySelector<HTMLElement>(`[data-screen="${n}"]`);

    const end = (commit: boolean) => {
      active = false;
      [cur, prev].forEach(s => { if (s) { s.classList.remove("dragging"); s.style.transform = ""; s.style.opacity = ""; } });
      if (commit) back();
    };
    const start = (e: TouchEvent) => {
      const s = stackRef.current;
      if (s.length < 2) return;
      const t = e.touches[0];
      if (t.clientX < innerWidth - EDGE) return;
      active = true; sx = t.clientX; sy = t.clientY; dx = 0;
      cur = el(s[s.length - 1]); prev = el(s[s.length - 2]);
      cur?.classList.add("dragging"); prev?.classList.add("dragging");
    };
    const move = (e: TouchEvent) => {
      if (!active || !cur || !prev) return;
      const t = e.touches[0];
      if (Math.abs(t.clientY - sy) > 60 && Math.abs(dx) < 20) return end(false);
      dx = Math.max(0, sx - t.clientX);
      cur.style.transform = `translateX(${-dx}px)`;
      prev.style.transform = `translateX(${30 - (dx / innerWidth) * 30}%)`;
      prev.style.opacity = String(0.4 + (dx / innerWidth) * 0.6);
    };
    const finish = () => active && end(dx > innerWidth * 0.3);

    addEventListener("touchstart", start, { passive: true });
    addEventListener("touchmove", move, { passive: true });
    addEventListener("touchend", finish);
    return () => {
      removeEventListener("touchstart", start);
      removeEventListener("touchmove", move);
      removeEventListener("touchend", finish);
    };
  }, [back]);

  return (
    <>
      <div id="boot" className={ready ? "done" : ""}>
        <div className="spinner" style={{ width: 32, height: 32, color: "var(--accent)" }} />
      </div>
      <div id="app">
        <Screen name="login" stack={stack}><LoginScreen push={push} /></Screen>
        <Screen name="signup" stack={stack}><SignupScreen back={back} /></Screen>
        <Screen name="forgot" stack={stack}><ForgotScreen back={back} /></Screen>
        <Screen name="app" stack={stack}>{user && <Tracker user={user} />}</Screen>
      </div>
    </>
  );
}

export default function Page() {
  return (
    <ToastProvider>
      <App />
    </ToastProvider>
  );
}
