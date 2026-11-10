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

/**
 * Webhook for MyFatoorah (set it in the portal: Integration Settings > Webhook Settings) and also called by
 * the /payment/success and /payment/error pages with { paymentId }.
 *
 * Nothing in the request is trusted: it only says which invoice/payment to look at. The real status is read
 * from MyFatoorah with our API key (GetPaymentStatus), so a forged request cannot mark an order as paid.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("MYFATOORAH_API_KEY");
  if (!apiKey) return json({ error: "مفتاح MyFatoorah غير مضبوط في أسرار الدالة" }, 500);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return json({ error: "طلب غير صالح" }, 400);

  // Webhook V2: Data.Invoice.Id / Data.Transaction.PaymentId · Webhook V1: Data.InvoiceId · pages: { paymentId }
  const invoiceId = body?.Data?.Invoice?.Id ?? body?.Data?.InvoiceId ?? body?.invoiceId;
  const paymentId = body?.Data?.Transaction?.PaymentId ?? body?.Data?.PaymentId ?? body?.paymentId;
  const key = String(invoiceId ?? paymentId ?? "");
  const keyType = invoiceId ? "InvoiceId" : "PaymentId";
  if (!/^[0-9A-Za-z-]{3,64}$/.test(key)) return json({ error: "معرّف الدفع غير صالح" }, 400);

  const res = await fetch(`${BASE_URL}/v2/GetPaymentStatus`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ Key: key, KeyType: keyType }),
  });
  const result = await res.json().catch(() => null);
  const data = result?.Data;
  if (!res.ok || !result?.IsSuccess || !data?.InvoiceId) {
    console.error("GetPaymentStatus failed", res.status, JSON.stringify(result)?.slice(0, 500));
    // Non-2xx makes MyFatoorah retry the webhook later
    return json({ error: "تعذّر التحقق من الدفع الآن" }, 502);
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: order } = await admin
    .from("orders")
    .select("id, status, amount, fulfilled, note")
    .eq("invoice_id", data.InvoiceId)
    .maybeSingle();
  if (!order) return json({ error: "الطلب غير موجود" }, 404);

  // Map MyFatoorah's answer to the order status; a paid order never goes back
  const transactions: { TransactionStatus?: string; PaymentId?: string }[] = data.InvoiceTransactions ?? [];
  const lastTx = transactions[transactions.length - 1]?.TransactionStatus?.toLowerCase() ?? "";
  let status: "pending" | "success" | "cancelled" | "rejected" = "pending";
  if (data.InvoiceStatus === "Paid") status = "success";
  else if (lastTx.startsWith("cancel")) status = "cancelled";
  else if (lastTx === "failed") status = "rejected";

  if (order.status !== "success" && status !== order.status) {
    if (status === "success" && Number(data.InvoiceValue) + 0.0005 < Number(order.amount)) {
      return json({ error: "المبلغ المدفوع لا يطابق الطلب" }, 400);
    }
    await admin
      .from("orders")
      .update({ status, payment_id: paymentId ? String(paymentId) : null, updated_at: new Date().toISOString() })
      .eq("id", order.id)
      .neq("status", "success");
  }

  let fulfilled = order.fulfilled;
  if (status === "success" || order.status === "success") {
    const { data: ok, error } = await admin.rpc("fulfill_order", { p_order: order.id });
    if (error) console.error(error.message);
    fulfilled = !!ok;
  }

  const { data: fresh } = await admin.from("orders").select("status, fulfilled, note").eq("id", order.id).single();
  return json({
    ok: true,
    status: fresh?.status ?? status,
    fulfilled: fresh?.fulfilled ?? fulfilled,
    note: fresh?.note ?? null,
    invoiceId: data.InvoiceId,
  });
});
