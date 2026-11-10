"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PaymentAPI, sb } from "@/lib/supabase";

const REASONS: Record<string, string> = {
  cancelled: "ألغيت عملية الدفع.",
  rejected: "رُفضت عملية الدفع من البنك أو من بوابة الدفع.",
  pending: "لم يكتمل الدفع بعد.",
};

/** MyFatoorah's ErrorUrl (also where the success page sends unpaid orders) */
export default function PaymentError() {
  const [reason, setReason] = useState("لم تكتمل عملية الدفع.");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const paymentId = params.get("paymentId");
    const hint = params.get("status");
    if (hint && REASONS[hint]) setReason(REASONS[hint]);
    // Record the real outcome (cancelled / rejected) on the order
    if (paymentId) {
      sb.auth.getSession().then(({ data }) => {
        if (!data.session) return;
        PaymentAPI.check(paymentId)
          .then(r => r.status !== "success" && REASONS[r.status] && setReason(REASONS[r.status]))
          .catch(() => {});
      });
    }
  }, []);

  return (
    <div id="app">
      <section className="screen">
        <div className="wrap stack" style={{ marginTop: 48, textAlign: "center" }}>
          <h1 style={{ color: "var(--danger)" }}>لم يكتمل الدفع</h1>
          <div className="alert" role="alert">{reason}</div>
          <p className="sub">لم تُخصم أي مبالغ، وسلتك ما زالت كما هي. يمكنك المحاولة مرة أخرى.</p>
          <Link href="/store" className="btn btn-primary">العودة إلى المتجر</Link>
          <Link href="/orders" className="btn btn-ghost">عرض طلباتي</Link>
        </div>
      </section>
    </div>
  );
}
