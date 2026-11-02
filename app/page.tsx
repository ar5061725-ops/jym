"use client";

import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { sb } from "@/lib/supabase";
import { LoginScreen } from "@/components/AuthScreens";
import { ToastProvider, useToast } from "@/components/Toast";
import { Tracker } from "@/components/Tracker";

function App() {
  const toast = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const userId = useRef<string | null>(null);

  /* Auth session — reads the stored session automatically */
  useEffect(() => {
    const onSession = (u: User | null) => {
      if (u && u.id === userId.current) return; // token refresh — nothing to redraw
      userId.current = u?.id ?? null;
      setUser(u);
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

  return (
    <>
      <div id="boot" className={ready ? "done" : ""}>
        <div className="spinner" style={{ width: 32, height: 32, color: "var(--accent)" }} />
      </div>
      <div id="app">
        <section className="screen" id="s-main">
          {ready && (user ? <Tracker user={user} /> : <LoginScreen />)}
        </section>
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
