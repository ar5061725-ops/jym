"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PaymentAPI, sb } from "@/lib/supabase";
import { friendlyError } from "@/lib/utils";
import { Spinner } from "@/components/Field";

type State = { kind: "checking" } | { kind: "paid"; fulfilled: boolean; note: string | null } | { kind: "problem"; message: string };

/** MyFatoorah's CallBackUrl. The payment is re-checked server-side; anything but a paid order goes to the error page. */
export default function PaymentSuccess() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "checking" });

  useEffect(() => {
    const paymentId = new URLSearchParams(location.search).get("paymentId");
    (async () => {
      const { data } = await sb.auth.getSession();
      if (!data.session) return location.replace("/?next=/store");
      if (!paymentId) return router.replace("/payment/error");
      try {
        const r = await PaymentAPI.check(paymentId);
        if (r.status === "success") setState({ kind: "paid", fulfilled: r.fulfilled, note: r.note });
        else router.replace(`/payment/error?status=${r.status}&paymentId=${encodeURIComponent(paymentId)}`);
      } catch (err) {
        setState({ kind: "problem", message: friendlyError(err) });
      }
    })();
  }, [router]);

  return (
    <div id="app">
      <section className="screen">
        <div className="wrap stack" style={{ marginTop: 48, textAlign: "center" }}>
          {state.kind === "checking" && (
            <>
              <div style={{ display: "grid", placeItems: "center" }}><Spinner size={32} /></div>
              <h2>جارٍ التحقق من الدفع…</h2>
              <p className="sub">لا تغلق هذه الصفحة.</p>
            </>
          )}
          {state.kind === "paid" && (
            <>
              <h1 style={{ color: "var(--ok)" }}>✓ تم الدفع بنجاح</h1>
              {state.fulfilled ? (
                <p className="sub">سُجّل طلبك وخُصمت الكميات من المخزون. شكرًا لك!</p>
              ) : (
                <div className="alert" role="alert">{state.note ?? "تم الدفع وجارٍ تجهيز الطلب."}</div>
              )}
              <Link href="/orders" className="btn btn-primary">عرض طلباتي</Link>
              <Link href="/store" className="btn btn-ghost">العودة إلى المتجر</Link>
            </>
          )}
          {state.kind === "problem" && (
            <>
              <h1 style={{ color: "var(--danger)" }}>تعذّر التحقق من الدفع</h1>
              <div className="alert" role="alert">{state.message}</div>
              <p className="sub">إذا خُصم المبلغ من بطاقتك فسيظهر طلبك في «طلباتي» بعد قليل.</p>
              <Link href="/orders" className="btn btn-primary">عرض طلباتي</Link>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
