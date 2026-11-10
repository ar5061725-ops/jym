"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { OrdersAPI, sb, type Order, type OrderStatus } from "@/lib/supabase";
import { friendlyError } from "@/lib/utils";

const STATUS: Record<OrderStatus, { label: string; cls: string }> = {
  pending: { label: "قيد الانتظار", cls: "st-pending" },
  success: { label: "ناجحة", cls: "st-success" },
  cancelled: { label: "ملغاة", cls: "st-cancelled" },
  rejected: { label: "مرفوضة", cls: "st-rejected" },
};
const fmtPrice = (n: number) => `${Number(n).toLocaleString("ar", { minimumFractionDigits: 0, maximumFractionDigits: 3 })} د.ك`;
const fmtDate = (iso: string) => new Date(iso).toLocaleString("ar", { dateStyle: "medium", timeStyle: "short" });

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setOrders(await OrdersAPI.list());
      setStatus("ready");
    } catch (err) {
      setError(friendlyError(err));
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/?next=/store");
      else load();
    });
  }, [router, load]);

  return (
    <div id="app">
      <section className="screen">
        <header className="topbar">
          <div className="inner">
            <Link href="/store" className="icon-btn" aria-label="رجوع">›</Link>
            <div className="who"><h2>طلباتي</h2></div>
          </div>
        </header>
        <div className="wrap stack">
          {status === "loading" && <><div className="skeleton" /><div className="skeleton" /></>}
          {status === "error" && (
            <div className="empty">
              <p style={{ margin: "0 0 10px" }}>{error}</p>
              <button className="btn btn-ghost" onClick={() => { setStatus("loading"); load(); }}>إعادة المحاولة</button>
            </div>
          )}
          {status === "ready" && !orders.length && <div className="empty">لا توجد طلبات بعد. أضف منتجات إلى السلة وأكمل الدفع.</div>}
          {status === "ready" &&
            orders.map(o => (
              <article key={o.id} className="card stack order-card">
                <div className="row-between">
                  <span className={`status-badge ${STATUS[o.status].cls}`}>{STATUS[o.status].label}</span>
                  <small className="sub">{fmtDate(o.created_at)}</small>
                </div>
                <ul className="order-items">
                  {o.items.map(i => (
                    <li key={i.equipment_id} className="row-between">
                      <span>{i.name} × {i.quantity.toLocaleString("ar")}</span>
                      <span className="sub">{fmtPrice(i.unit_price * i.quantity)}</span>
                    </li>
                  ))}
                </ul>
                <div className="row-between cart-total">
                  <span>الإجمالي</span>
                  <b className="price">{fmtPrice(o.amount)}</b>
                </div>
                {o.invoice_id && <small className="sub">رقم الفاتورة: {o.invoice_id}</small>}
                {o.status === "success" && o.note && <div className="alert" role="alert">{o.note}</div>}
              </article>
            ))}
        </div>
      </section>
    </div>
  );
}
