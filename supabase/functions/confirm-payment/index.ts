import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const BASE_URL = (Deno.env.get("MYFATOORAH_BASE_URL") ?? "https://api.myfatoorah.com").replace(/\/$/, "");

// Called from the page MyFatoorah sends the customer back to. The payment is verified with MyFatoorah
// itself (never trusted from the browser) before the cart becomes an order and stock is reduced.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("MYFATOORAH_API_KEY");
  if (!apiKey) return json({ error: "مفتاح MyFatoorah غير مضبوط في أسرار الدالة" }, 500);

  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: auth, error: authError } = await userClient.auth.getUser();
  const user = auth?.user;
  if (authError || !user) return json({ error: "سجّل الدخول أولاً" }, 401);

  let paymentId: unknown;
  try {
    ({ paymentId } = await req.json());
  } catch {
    return json({ error: "طلب غير صالح" }, 400);
  }
  if (typeof paymentId !== "string" || !/^[0-9A-Za-z-]{5,64}$/.test(paymentId)) return json({ error: "رقم الدفع غير صالح" }, 400);

  const res = await fetch(`${BASE_URL}/v2/GetPaymentStatus`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ Key: paymentId, KeyType: "PaymentId" }),
  });
  const result = await res.json().catch(() => null);
  const data = result?.Data;
  if (!res.ok || !result?.IsSuccess || !data?.InvoiceId) {
    console.error("GetPaymentStatus failed", res.status, JSON.stringify(result)?.slice(0, 500));
    return json({ error: "تعذّر التحقق من الدفع الآن" }, 502);
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: payment } = await admin
    .from("payments")
    .select("id, status, amount")
    .eq("invoice_id", data.InvoiceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!payment) return json({ error: "عملية الدفع غير موجودة" }, 404);

  if (payment.status === "paid") return json({ ok: true, already: true });
  if (data.InvoiceStatus !== "Paid") return json({ ok: false, status: data.InvoiceStatus ?? "Unknown" });
  if (Number(data.InvoiceValue) + 0.0005 < Number(payment.amount)) return json({ error: "المبلغ المدفوع لا يطابق الطلب" }, 400);

  // Claim the payment once so repeated callbacks cannot create the order twice
  const { data: claimed } = await admin
    .from("payments")
    .update({ status: "paid" })
    .eq("id", payment.id)
    .eq("status", "pending")
    .select("id");
  if (!claimed?.length) return json({ ok: true, already: true });

  // The cart must still match what was paid for
  const { data: cart } = await admin
    .from("cart_items")
    .select("quantity, gym_equipment(price)")
    .eq("user_id", user.id);
  const cartTotal = ((cart ?? []) as unknown as { quantity: number; gym_equipment: { price: number } | null }[])
    .reduce((s, l) => s + Number(l.gym_equipment?.price ?? 0) * l.quantity, 0);
  const unfulfilled = (message: string) =>
    admin.from("payments").update({ status: "paid_unfulfilled" }).eq("id", payment.id).then(() =>
      json({ ok: false, paid: true, invoiceId: data.InvoiceId, error: message }, 409));

  if (Math.abs(cartTotal - Number(payment.amount)) > 0.0005) {
    return unfulfilled("تم الدفع لكن تغيّرت السلة بعد إنشاء رابط الدفع");
  }
  const { data: total, error: finalizeError } = await admin.rpc("finalize_order", { p_user: user.id, p_method: "myfatoorah" });
  if (finalizeError) {
    console.error(finalizeError.message);
    return unfulfilled(`تم الدفع لكن تعذّر تجهيز الطلب: ${finalizeError.message}`);
  }
  return json({ ok: true, total: Number(total), invoiceId: data.InvoiceId });
});
