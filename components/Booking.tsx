"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookingsAPI, type SlotRow } from "@/lib/supabase";
import { friendlyError, haptic } from "@/lib/utils";
import { Spinner } from "./Field";
import { useToast } from "./Toast";

const WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

// Booking dates follow the gym's local day (the database validates against the same timezone)
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kuwait" });
const fmtDay = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString("ar", { day: "numeric", month: "short" });
const fmtSlotTime = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString("ar", { hour: "numeric", minute: "2-digit" });
};

export function Booking() {
  const toast = useToast();
  const [rows, setRows] = useState<SlotRow[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await BookingsAPI.upcoming(today(), 7);
      setRows(data);
      setSelected(s => (s && data.some(r => r.day === s) ? s : data[0]?.day ?? null));
      setStatus("ready");
    } catch (err) {
      setError(friendlyError(err));
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const days = useMemo(() => {
    const seen = new Map<string, number>();
    rows.forEach(r => seen.set(r.day, r.weekday));
    return [...seen].map(([day, weekday]) => ({ day, weekday }));
  }, [rows]);
  const slots = rows.filter(r => r.day === selected);

  async function toggle(r: SlotRow) {
    haptic();
    setBusy(r.slot_id);
    try {
      if (r.mine) {
        await BookingsAPI.cancel(r.slot_id, r.day);
        toast("تم إلغاء الحجز");
      } else {
        await BookingsAPI.book(r.slot_id, r.day);
        toast("تم حجز الموعد");
      }
    } catch (err) {
      toast(friendlyError(err), { type: "error", duration: 4000 });
    } finally {
      setBusy(null);
      load(); // counts and grey state come from the database
    }
  }

  if (status === "loading") return <div className="stack"><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></div>;
  if (status === "error")
    return (
      <div className="empty">
        <p style={{ margin: "0 0 10px" }}>{error}</p>
        <button className="btn btn-ghost" onClick={() => { setStatus("loading"); load(); }}>إعادة المحاولة</button>
      </div>
    );

  return (
    <div className="stack">
      <div className="row-between">
        <h2>حجز موعد مسبق</h2>
        <small className="sub">الأيام السبعة القادمة</small>
      </div>

      <div className="days" role="tablist" aria-label="أيام الأسبوع">
        {days.map(d => (
          <button
            key={d.day}
            role="tab"
            aria-selected={d.day === selected}
            className="day"
            onClick={() => {
              haptic();
              setSelected(d.day);
            }}
          >
            <b>{WEEKDAYS[d.weekday]}</b>
            <small>{fmtDay(d.day)}</small>
          </button>
        ))}
      </div>

      <ul className="log">
        {!slots.length && <li className="empty">لا توجد مواعيد في هذا اليوم.</li>}
        {slots.map(r => {
          const full = r.is_full && !r.mine;
          return (
            <li key={r.slot_id + r.day} className={`slot${full ? " full" : ""}${r.mine ? " mine" : ""}`}>
              <div className="badge">{r.label}</div>
              <div className="log-main">
                <b>{fmtSlotTime(r.start_time)}</b>
                <small>
                  {full ? "مكتمل" : `${r.booked} / ${r.capacity} محجوز`}
                </small>
              </div>
              <button
                className={`btn ${r.mine ? "btn-ghost" : "btn-primary"}`}
                style={{ width: "auto", minHeight: 40, padding: "0 16px" }}
                disabled={full || busy === r.slot_id}
                onClick={() => toggle(r)}
              >
                {busy === r.slot_id ? <Spinner /> : r.mine ? "إلغاء الحجز" : full ? "مكتمل" : "احجز"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
