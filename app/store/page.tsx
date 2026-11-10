"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CartAPI, EquipmentAPI, PaymentAPI, equipmentImageUrl, sb, type CartRow, type Equipment } from "@/lib/supabase";
import { friendlyError, haptic } from "@/lib/utils";
import { Spinner } from "@/components/Field";
import { ToastProvider, useToast } from "@/components/Toast";

const CATEGORIES = ["أثقال دمبلز", "بارات", "أجهزة كارديو", "حبال مقاومة", "فرشات تدريب"];
const fmtPrice =(n: number) => `${Number(n).toLocaleString("ar", { minimumFractionDigits: 0, maximumFractionDigits: 3 })} د.ك`;

function Store() {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<Equipment[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [category, setCategory] = useState("all");
  const [cart, setCart] = useState<CartRow[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [describing, setDescribing] = useState<string | null>(null);

  async function describe(p: Equipment) {
    if (!userId) return needLogin();
    haptic();
    setDescribing(p.id);
    try {
      const text = await EquipmentAPI.describe(p.id);
      setDescriptions(d => ({ ...d, [p.id]: text }));
    } catch (err) {
      toast(friendlyError(err), { type: "error", duration: 4000 });
    } finally {
      setDescribing(null);
    }
  }

  const load = useCallback(async () => {
    try {
      setItems(await EquipmentAPI.list());
      setStatus("ready");
    } catch (err) {
      setError(friendlyError(err));
      setStatus("error");
    }
  }, []);

  const loadCart = useCallback(async () => {
    try {
      setCart(await CartAPI.list());
    } catch (err) {
      toast(friendlyError(err), { type: "error" });
    }
  }, [toast]);

  useEffect(() => {
    // The store is for signed-in users: others are sent to sign in and return here
    sb.auth.getSession().then(({ data }) => {
      const id = data.session?.user.id ?? "";
      if (!id) {
        router.replace("/?next=/store");
        return;
      }
      setUserId(id);
      setIsGuest(!!data.session?.user.is_anonymous);
      setAuthReady(true);
      load();
      loadCart();
    });
  }, [load, loadCart, router]);

  /** Sends visitors to sign in, then back to the store */
  function needLogin() {
    haptic();
    router.push("/?next=/store");
  }

  async function upload(p: Equipment, file: File | undefined) {
    if (!file) return;
    if (!userId) return needLogin();
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

  /** Guests may look around, but only registered users can use the cart and buy */
  function guestBlocked() {
    haptic();
    toast("الشراء للمستخدمين المسجّلين فقط. أنشئ حساباً أولاً.", {
      type: "error",
      action: "إنشاء حساب",
      duration: 6000,
      onAction: async () => {
        await sb.auth.signOut();
        router.replace("/?next=/store");
      },
    });
  }

  /** Adding to the cart needs a registered account */
  async function addToCart(p: Equipment) {
    if (!authReady) return;
    if (!userId) return needLogin();
    if (isGuest) return guestBlocked();
    const inCart = cart.find(c => c.equipment_id === p.id)?.quantity ?? 0;
    if (inCart >= p.qty) return toast("وصلت إلى الحد الأقصى المتوفر لهذا المنتج", { type: "error" });
    haptic();
    setAdding(p.id);
    try {
      await CartAPI.setQuantity(p.id, inCart + 1);
      await loadCart();
      toast(`أُضيف «${p.name}» إلى السلة`);
    } catch (err) {
      toast(friendlyError(err), { type: "error", duration: 4000 });
    } finally {
      setAdding(null);
    }
  }

  async function changeQuantity(row: CartRow, delta: number) {
    const next = row.quantity + delta;
    const stock = row.gym_equipment?.qty ?? 0;
    if (next > stock) return toast("لا توجد كمية أكبر متوفرة", { type: "error" });
    haptic();
    try {
      if (next < 1) await CartAPI.remove(row.id);
      else await CartAPI.setQuantity(row.equipment_id, next);
      await loadCart();
    } catch (err) {
      toast(friendlyError(err), { type: "error", duration: 4000 });
    }
  }

  /** Asks the `create-payment` Edge Function for a MyFatoorah link and opens it in a new tab */
  async function checkout() {
    if (isGuest) return guestBlocked();
    haptic();
    setCheckingOut(true);
    // Open the tab inside the click so the browser doesn't treat it as a blocked pop-up
    const tab = window.open("", "_blank");
    try {
      const { url } = await PaymentAPI.create();
      if (tab) tab.location.href = url;
      else window.open(url, "_blank");
      toast("فُتحت صفحة الدفع في تبويب جديد. أكمل الدفع هناك.", { duration: 5000 });
    } catch (err) {
      tab?.close();
      toast(friendlyError(err), { type: "error", duration: 6000 });
    } finally {
      setCheckingOut(false);
    }
  }

  // Coming back from the payment tab: stock and cart may have changed
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible" && userId) {
        load();
        loadCart();
      }
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [userId, load, loadCart]);

  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);
  const cartTotal = cart.reduce((s, c) => s + Number(c.gym_equipment?.price ?? 0) * c.quantity, 0);

  const shown = category === "all" ? items : items.filter(i => i.category === category);

  return (
    <div id="app">
      <section className="screen">
        <header className="topbar">
          <div className="inner">
            <Link href="/" className="icon-btn" aria-label="رجوع">›</Link>
            <div className="who"><h2>مستلزمات النادي</h2></div>
            <Link href="/orders" className="btn btn-ghost" style={{ minHeight: 40, padding: "0 14px" }}>طلباتي</Link>
            <button className="icon-btn cart-btn" aria-label="سلة المشتريات" onClick={() => (!userId ? needLogin() : isGuest ? guestBlocked() : setCartOpen(true))}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 6h15l-1.5 9h-12zM6 6 5 3H2M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
              </svg>
              {cartCount > 0 && <span className="cart-badge">{cartCount.toLocaleString("ar")}</span>}
            </button>
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
                  <article
                    key={p.id}
                    className={`product card${out ? " out" : ""}${selected === p.id ? " selected" : ""}`}
                    onClick={() => setSelected(p.id)}
                  >
                    {p.image_path && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="product-img" src={equipmentImageUrl(p.image_path)} alt={p.name} loading="lazy" />
                    )}
                    <label
                      className={`upload${p.image_path ? " has-image" : ""}`}
                      onClick={e => {
                        if (authReady && !userId) {
                          e.preventDefault();
                          needLogin();
                        }
                      }}
                    >
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
                    <button className="btn btn-primary" disabled={out || adding === p.id} onClick={() => addToCart(p)}>
                      {adding === p.id ? <Spinner /> : out ? "غير متوفر" : "أضف إلى السلة"}
                    </button>
                    {selected === p.id && (
                      <div className="ai-box" onClick={e => e.stopPropagation()}>
                        <label htmlFor={`ai-${p.id}`}>وصف المنتج بالذكاء الاصطناعي</label>
                        <textarea
                          id={`ai-${p.id}`}
                          readOnly
                          rows={4}
                          value={descriptions[p.id] ?? ""}
                          placeholder={describing === p.id ? "جارٍ كتابة الوصف…" : "اضغط الزر لتوليد وصف لهذا المنتج"}
                        />
                        <button className="btn btn-ghost" disabled={describing === p.id} onClick={() => describe(p)}>
                          {describing === p.id ? <><Spinner size={14} /> جارٍ التوليد…</> : descriptions[p.id] ? "✨ إعادة التوليد" : "✨ اطلب وصفًا بالذكاء الاصطناعي"}
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {cartOpen && (
          <div className="cart-overlay" onClick={() => setCartOpen(false)}>
            <aside className="cart-panel" role="dialog" aria-label="سلة المشتريات" onClick={e => e.stopPropagation()}>
              <div className="row-between">
                <h2>سلة المشتريات</h2>
                <button className="icon-btn" aria-label="إغلاق" onClick={() => setCartOpen(false)}>✕</button>
              </div>
              {!cart.length ? (
                <div className="empty">السلة فارغة. أضف منتجات من المتجر.</div>
              ) : (
                <>
                  <ul className="log">
                    {cart.map(row => (
                      <li key={row.id} className="cart-row">
                        <div className="log-main">
                          <b>{row.gym_equipment?.name}</b>
                          <small>{fmtPrice(Number(row.gym_equipment?.price ?? 0) * row.quantity)}</small>
                        </div>
                        <div className="qty">
                          <button className="icon-btn" aria-label="إنقاص" onClick={() => changeQuantity(row, -1)}>−</button>
                          <b>{row.quantity.toLocaleString("ar")}</b>
                          <button className="icon-btn" aria-label="زيادة" onClick={() => changeQuantity(row, 1)}>＋</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="row-between cart-total">
                    <span>الإجمالي</span>
                    <b className="price">{fmtPrice(cartTotal)}</b>
                  </div>
                  <small className="sub">ستختار وسيلة الدفع (بطاقة بنكية، فيزا، آبل باي…) في صفحة الدفع الآمنة التي تفتح في تبويب جديد.</small>
                  <button className="btn btn-primary" disabled={checkingOut} onClick={checkout}>
                    {checkingOut ? <><Spinner /> جارٍ تجهيز صفحة الدفع…</> : "إتمام الشراء والدفع"}
                  </button>
                </>
              )}
            </aside>
          </div>
        )}
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
