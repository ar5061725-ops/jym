import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Free models, tried in order until one answers (override the first with the OPENROUTER_MODEL secret)
const FALLBACK_MODELS = [
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "recursive/flint-v1.0:free",
  "xingchen-agi/xing4.0-29b-a4b:free",
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function ask(apiKey: string, model: string, prompt: string): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "Gym Tracker",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "أنت كاتب محتوى تسويقي لمتجر مستلزمات رياضية. تكتب بالعربية الفصحى المبسّطة وصفًا قصيرًا وجذابًا للمنتج." },
        { role: "user", content: prompt },
      ],
      max_tokens: 400,
      temperature: 0.7,
    }),
  });
  if (!res.ok) throw new Error(`${model}: ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error(`${model}: empty`);
  return text;
}

// Keyless free fallback, used when no OpenRouter key is configured or all OpenRouter models fail
async function askFree(prompt: string): Promise<string> {
  const res = await fetch("https://text.pollinations.ai/openai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai",
      messages: [
        { role: "system", content: "أنت كاتب محتوى تسويقي لمتجر مستلزمات رياضية. تكتب بالعربية الفصحى المبسّطة وصفًا قصيرًا وجذابًا للمنتج." },
        { role: "user", content: prompt },
      ],
      max_tokens: 400,
    }),
  });
  if (!res.ok) throw new Error(`free: ${res.status}`);
  const text = (await res.json())?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("free: empty");
  return text;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("OPENROUTER_API_KEY");

  let id: unknown;
  try {
    ({ id } = await req.json());
  } catch {
    return json({ error: "طلب غير صالح" }, 400);
  }
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "معرّف المنتج غير صالح" }, 400);

  // Read the product with the caller's own session so RLS applies
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: item, error } = await supabase
    .from("gym_equipment")
    .select("name, category, weight_size, price")
    .eq("id", id)
    .maybeSingle();
  if (error || !item) return json({ error: "المنتج غير موجود" }, 404);

  const prompt = [
    "اكتب وصفًا تسويقيًا للمنتج التالي في 2 إلى 3 جمل قصيرة، بدون عناوين أو رموز تنسيق.",
    "لا تذكر مواصفات أو أرقامًا غير مذكورة هنا ولا تخترع ضمانات.",
    `الاسم: ${item.name}`,
    `التصنيف: ${item.category}`,
    item.weight_size ? `الوزن أو المقاس: ${item.weight_size}` : "",
  ].filter(Boolean).join("\n");

  const first = Deno.env.get("OPENROUTER_MODEL");
  const models = first ? [first, ...FALLBACK_MODELS] : FALLBACK_MODELS;
  for (const model of apiKey ? models : []) {
    try {
      return json({ description: await ask(apiKey!, model, prompt), model });
    } catch (e) {
      console.error(String(e));
    }
  }
  try {
    return json({ description: await askFree(prompt), model: "free" });
  } catch (e) {
    console.error(String(e));
  }
  return json({ error: "تعذّر توليد الوصف الآن، حاول بعد قليل" }, 502);
});
