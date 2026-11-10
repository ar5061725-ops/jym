import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Replaced by `check-payment`. Safe to delete from the dashboard (Edge Functions > confirm-payment).
Deno.serve(() =>
  new Response(JSON.stringify({ error: "Deprecated: use check-payment" }), {
    status: 410,
    headers: { "Content-Type": "application/json" },
  }));
