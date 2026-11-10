"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PaymentAPI, sb } from "@/lib/supabase";
import { friendlyError } from "@/lib/utils";
import { Spinner } from "@/components/Field";

type State =
  | { kind: "checking" }
  | { kind: "paid"; total?: number }
  | { kind: "unpaid" }
  | { kind: "problem"; message: string; invoiceId?: number };

const fmtPrice = (n: number) => `${Number(n).toLocaleString("ar", { minimumFractionDigits: 0, maximumFractionDigits: 3 })} د.ك`;

/** MyFatoorah sends the customer back here with ?paymentId=...; the payment is verified server-side */
export default function PaymentResult() {
  const [state, setState] = useState<State>({ kind: "checking" });

  useEffect(() => {
    const paymentId = new URLSearchParams(location.search).get("paymentId");
    if (!paymentId) {
      setState({ kind: "unpaid" });
      return;
    }
    (async () => {
      const { data } = await sb.auth.getSession();
      if (!data.session) {
        location.replace("/?next=/store");
        return;
      }
      try {
        const r = await PaymentAPI.confirm(paymentId);
        setState(r.ok ? { kind: "paid", total: r.total } : { kind: "unpaid" });
      } catch (err) {
        const message = friendlyError(err);
        setState({ kind: "problem", message });
      }
    })();
  }, []);

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
              {state.total !== undefined && <p>الإجمالي: <b className="price">{fmtPrice(state.total)}</b></p>}
              <p className="sub">سُجّل طلبك وخُصمت الكميات من المخزون.</p>
              <Link href="/store" className="btn btn-primary">العودة إلى المتجر</Link>
            </>
          )}
          {state.kind === "unpaid" && (
            <>
              <h1 style={{ color: "var(--danger)" }}>لم يكتمل الدفع</h1>
              <p className="sub">لم تُخصم أي مبالغ، وسلتك ما زالت كما هي. يمكنك المحاولة مرة أخرى.</p>
              <Link href="/store" className="btn btn-primary">العودة إلى المتجر</Link>
            </>
          )}
          {state.kind === "problem" && (
            <>
              <h1 style={{ color: "var(--danger)" }}>تعذّر إكمال الطلب</h1>
              <div className="alert" role="alert">{state.message}</div>
              <p className="sub">إذا خُصم المبلغ من بطاقتك فتواصل معنا قبل إعادة المحاولة.</p>
              <Link href="/store" className="btn btn-ghost">العودة إلى المتجر</Link>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
