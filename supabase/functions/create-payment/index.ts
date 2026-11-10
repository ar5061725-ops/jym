import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Secrets (Supabase dashboard > Edge Functions > Secrets):
//   MYFATOORAH_API_KEY   required
//   MYFATOORAH_BASE_URL  optional, defaults to live Kuwait; use https://apitest.myfatoorah.com for test
//   SITE_URL             optional, where MyFatoorah sends the customer back
const BASE_URL = (Deno.env.get("MYFATOORAH_BASE_URL") ?? "https://api.myfatoorah.com").replace(/\/$/, "");
const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://jym-five.vercel.app").replace(/\/$/, "");

type CartLine = {
  equipment_id: string;
  quantity: number;
  gym_equipment: { name: string; price: number; qty: number } | null;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("MYFATOORAH_API_KEY");
  if (!apiKey) return json({ error: "مفتاح MyFatoorah غير مضبوط في أسرار الدالة" }, 500);

  // Who is paying: the caller's own session; the amount always comes from their cart in the database
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: auth, error: authError } = await userClient.auth.getUser();
  const user = auth?.user;
  if (authError || !user) return json({ error: "سجّل الدخول أولاً" }, 401);
  if (user.is_anonymous) return json({ error: "الشراء للمستخدمين المسجّلين فقط، أنشئ حساباً أولاً" }, 403);

  const { data: cart, error: cartError } = await userClient
    .from("cart_items")
    .select("equipment_id, quantity, gym_equipment(name, price, qty)");
  if (cartError) return json({ error: "تعذّر قراءة السلة" }, 500);
  const lines = (cart ?? []) as unknown as CartLine[];
  if (!lines.length) return json({ error: "السلة فارغة" }, 400);

  for (const l of lines) {
    if (!l.gym_equipment || l.gym_equipment.qty < l.quantity) {
      return json({ error: `الكمية المتوفرة من «${l.gym_equipment?.name ?? "منتج"}» غير كافية` }, 409);
    }
  }

  const round3 = (n: number) => Math.round(n * 1000) / 1000;
  const items = lines.map(l => ({
    equipment_id: l.equipment_id,
    name: l.gym_equipment!.name,
    quantity: l.quantity,
    unit_price: round3(Number(l.gym_equipment!.price)),
  }));
  const total = round3(items.reduce((s, i) => s + i.unit_price * i.quantity, 0));

  // The order exists (pending) before the customer pays, with a snapshot of what they are paying for
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({ user_id: user.id, items, amount: total })
    .select("id")
    .single();
  if (orderError || !order) {
    console.error(orderError?.message);
    return json({ error: "تعذّر إنشاء الطلب" }, 500);
  }

  // Internal sign-in addresses (name accounts) are not real mailboxes
  const email = user.email && !user.email.endsWith("@gym-app.dev") ? user.email : undefined;

  const res = await fetch(`${BASE_URL}/v2/SendPayment`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      CustomerName: String(user.user_metadata?.username || user.email || "عميل").slice(0, 100),
      NotificationOption: "LNK",
      InvoiceValue: total,
      DisplayCurrencyIso: "KWD",
      CustomerEmail: email,
      CallBackUrl: `${SITE_URL}/payment/success`,
      ErrorUrl: `${SITE_URL}/payment/error`,
      Language: "AR",
      CustomerReference: order.id,
      InvoiceItems: items.map(i => ({ ItemName: i.name, Quantity: i.quantity, UnitPrice: i.unit_price })),
    }),
  });

  const result = await res.json().catch(() => null);
  const url: string | undefined = result?.Data?.InvoiceURL;
  const invoiceId: number | undefined = result?.Data?.InvoiceId;
  if (!res.ok || !result?.IsSuccess || !url || !invoiceId) {
    console.error("SendPayment failed", res.status, JSON.stringify(result)?.slice(0, 500));
    await admin.from("orders").delete().eq("id", order.id);
    const detail = result?.ValidationErrors?.map((e: { Error: string }) => e.Error).join("، ") || result?.Message;
    // The host is shown to help debugging (test vs live); never the key
    return json({ error: `تعذّر إنشاء رابط الدفع${detail ? `: ${detail}` : ""} [${new URL(BASE_URL).host}]` }, 502);
  }

  await admin.from("orders").update({ invoice_id: invoiceId, updated_at: new Date().toISOString() }).eq("id", order.id);
  return json({ url, invoiceId, orderId: order.id, amount: total });
});
