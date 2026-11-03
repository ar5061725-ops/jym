"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { EquipmentAPI, equipmentImageUrl, sb, type Equipment } from "@/lib/supabase";
import { friendlyError, haptic } from "@/lib/utils";
import { Spinner } from "@/components/Field";
import { ToastProvider, useToast } from "@/components/Toast";

const CATEGORIES = ["أثقال دمبلز", "بارات", "أجهزة كارديو", "حبال مقاومة", "فرشات تدريب"];
const fmtPrice = (n: number) => `${Number(n).toLocaleString("ar", { minimumFractionDigits: 0, maximumFractionDigits: 3 })} د.ك`;

function Store() {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<Equipment[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [category, setCategory] = useState("all");
  const [buying, setBuying] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [userId, setUserId] = useState("");

  const load = useCallback(async () => {
    try {
      setItems(await EquipmentAPI.list());
      setStatus("ready");
    } catch (err) {
      setError(friendlyError(err));
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/");
      else {
        setUserId(data.session.user.id);
        load();
      }
    });
  }, [router, load]);

  async function upload(p: Equipment, file: File | undefined) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast("الصيغ المسموحة: JPG أو PNG أو WebP", { type: "error" });
    if (file.size > 5 * 1024 * 1024) return toast("حجم الصورة يجب ألا يتجاوز 5 ميغابايت", { type: "error" });
    setUploading(p.id);
    try {
      await EquipmentAPI.setImage(userId, p.id, file);
      toast("تمت إضافة الصورة");
      await load();
    } catch (err) {
      toast(friendlyError(err), { type: "error", duration: 4000 });
    } finally {
      setUploading(null);
    }
  }

  async function buy(p: Equipment) {
    haptic();
    setBuying(p.id);
    try {
      const left = await EquipmentAPI.buy(p.id, 1);
      toast(`تم شراء «${p.name}»${left === 0 ? " (آخر قطعة)" : ""}`);
    } catch (err) {
      toast(friendlyError(err), { type: "error", duration: 4000 });
    } finally {
      setBuying(null);
      load(); // stock comes from the database
    }
  }

  const shown = category === "all" ? items : items.filter(i => i.category === category);

  return (
    <div id="app">
      <section className="screen">
        <header className="topbar">
          <div className="inner">
            <Link href="/" className="icon-btn" aria-label="رجوع">›</Link>
            <div className="who"><h2>مستلزمات النادي</h2></div>
          </div>
        </header>
        <div className="wrap wide stack">
          <div className="chips" role="group" aria-label="التصنيف">
            {["all", ...CATEGORIES].map(c => (
              <button key={c} className="chip" aria-pressed={c === category} onClick={() => { haptic(); setCategory(c); }}>
                {c === "all" ? "الكل" : c}
              </button>
            ))}
          </div>

          {status === "loading" && <div className="products"><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></div>}
          {status === "error" && (
            <div className="empty">
              <p style={{ margin: "0 0 10px" }}>{error}</p>
              <button className="btn btn-ghost" onClick={() => { setStatus("loading"); load(); }}>إعادة المحاولة</button>
            </div>
          )}
          {status === "ready" && !shown.length && <div className="empty">لا توجد منتجات في هذا التصنيف.</div>}
          {status === "ready" && (
            <div className="products">
              {shown.map(p => {
                const out = p.qty === 0;
                return (
                  <article key={p.id} className={`product card${out ? " out" : ""}`}>
                    {p.image_path && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="product-img" src={equipmentImageUrl(p.image_path)} alt={p.name} loading="lazy" />
                    )}
                    <label className={`upload${p.image_path ? " has-image" : ""}`}>
                      <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={uploading === p.id}
                        onChange={e => { upload(p, e.target.files?.[0]); e.target.value = ""; }} />
                      {uploading === p.id ? <Spinner size={14} /> : p.image_path ? "تغيير الصورة" : "＋ إضافة صورة"}
                    </label>
                    <span className="badge" style={{ alignSelf: "flex-start", padding: "0 12px" }}>{p.category}</span>
                    <h3>{p.name}</h3>
                    {p.weight_size && <small className="sub">{p.weight_size}</small>}
                    <div className="row-between">
                      <b className="price">{fmtPrice(p.price)}</b>
                      <small className="sub">{out ? "نفدت الكمية" : `المتوفر: ${p.qty.toLocaleString("ar")}`}</small>
                    </div>
                    <button className="btn btn-primary" disabled={out || buying === p.id} onClick={() => buy(p)}>
                      {buying === p.id ? <Spinner /> : out ? "غير متوفر" : "اشترِ الآن"}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default function StorePage() {
  return (
    <ToastProvider>
      <Store />
    </ToastProvider>
  );
}
