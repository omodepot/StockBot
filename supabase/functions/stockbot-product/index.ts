import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// StockBot UPC lookup.
// Order: products StockBot already knows (catalog cache from inventory/manifests and earlier lookups),
// then UPCitemdb + Open*Facts. New finds are saved to product_catalog_cache so the same UPC does not
// spend another call against UPCitemdb's small free daily limit.

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const clean = (v: any) => String(v ?? "").trim();
const variants = (raw: string) => { const n = raw.replace(/\D/g, ""); const a = [n]; if (n.length === 12) a.push("0" + n); if (n.length === 13 && n.startsWith("0")) a.push(n.slice(1)); return [...new Set(a)]; };
const tf = async (url: string, ms = 3500, init: any = {}) => { const c = new AbortController(), t = setTimeout(() => c.abort(), ms); try { return await fetch(url, { ...init, signal: c.signal }); } finally { clearTimeout(t); } };
const CACHE_DAYS = 30;

// Typical price: the median of current seller prices. The highest offer is often a reseller markup or a
// bundle, which pushed the suggested Facebook price (70% of retail) too high.
export function typicalPrice(prices: number[]) {
  const p = prices.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!p.length) return 0;
  const m = Math.floor(p.length / 2);
  return Number((p.length % 2 ? p[m] : (p[m - 1] + p[m]) / 2).toFixed(2));
}

async function upcdb(code: string) {
  try {
    const r = await tf("https://api.upcitemdb.com/prod/trial/lookup?upc=" + code, 3500, { headers: { Accept: "application/json", "User-Agent": "StockBot/4.0" } });
    if (!r.ok) return null;
    const d = await r.json(), i = d?.items?.[0];
    if (!i) return null;
    const ps = (i.offers || []).map((o: any) => Number(o.list_price || o.price)).filter((n: number) => n > 0);
    const typical = typicalPrice(ps);
    return {
      upc: code, name: clean(i.title), brand: clean(i.brand), category: clean(i.category), description: clean(i.description),
      image: i.images?.[0] || "", retail: typical, last_known_retail: typical,
      offer_count: ps.length, offer_low: ps.length ? Math.min(...ps) : 0, offer_high: ps.length ? Math.max(...ps) : 0,
      highest_recorded_price: Number(i.highest_recorded_price) || 0, lowest_recorded_price: Number(i.lowest_recorded_price) || 0,
      price_status: typical ? "marketplace_median" : "no_price", source: "UPCitemdb",
    };
  } catch { return null; }
}

async function facts(host: string, label: string, code: string) {
  try {
    const r = await tf(`https://${host}/api/v2/product/${code}?fields=product_name,brands,categories,generic_name,quantity,image_front_url`, 3000, { headers: { "User-Agent": "StockBot/4.0" } });
    if (!r.ok) return null;
    const d = await r.json(), p = d?.product;
    if (d.status !== 1 || !p) return null;
    return { upc: code, name: clean(p.product_name), brand: clean(p.brands), category: clean((p.categories || "").split(",")[0]), description: [p.generic_name, p.quantity].filter(Boolean).join(" · "), image: p.image_front_url || "", retail: 0, price_status: "no_price", source: label };
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const raw = req.method === "GET" ? (new URL(req.url).searchParams.get("upc") || "") : String((await req.json().catch(() => ({}))).upc || "");
    const n = raw.replace(/\D/g, "");
    const fresh = req.method === "GET" && new URL(req.url).searchParams.get("fresh") === "1";
    if (![8, 12, 13, 14].includes(n.length)) return json({ error: "Invalid UPC" }, 400);
    const auth = req.headers.get("Authorization") || "", url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const sb = createClient(url, anon, { global: { headers: { Authorization: auth } } });

    // 1. Legacy hand-curated cache (name/description only).
    for (const code of variants(n)) {
      const { data } = await sb.from("product_lookup_cache").select("*").eq("upc", code).maybeSingle();
      if (data) return json({ upc: code, name: data.product_name, brand: data.brand || "", category: data.category || "", description: data.description || "", image: data.image_url || "", retail: 0, last_known_retail: 0, source: data.source || "StockBot cache", price_status: "unverified_cached_price", requested_upc: n });
    }

    // 2. Products StockBot already knows: inventory/manifest imports and earlier lookups.
    if (!fresh) {
      const cutoff = Date.now() - CACHE_DAYS * 864e5;
      for (const code of variants(n)) {
        const { data } = await sb.from("product_catalog_cache").select("*").eq("upc", code).maybeSingle();
        if (!data?.product_name) continue;
        const looked = /^UPCitemdb|Open .* Facts/.test(data.source || "");
        if (looked && data.updated_at && Date.parse(data.updated_at) < cutoff) continue; // refresh old lookups
        return json({ upc: code, name: data.product_name, brand: data.brand || "", category: data.category || "", description: data.description || "", image: data.image_url || "", retail: Number(data.retail) || 0, last_known_retail: Number(data.retail) || 0, source: (data.source || "StockBot catalog") + " (saved)", price_status: Number(data.retail) > 0 ? (looked ? "marketplace_median" : "inventory_record") : "no_price", cached_at: data.updated_at, requested_upc: n });
      }
    }

    // 3. Outside catalogs.
    for (const code of variants(n)) {
      const rs = await Promise.all([upcdb(code), facts("world.openproductsfacts.org", "Open Products Facts", code), facts("world.openbeautyfacts.org", "Open Beauty Facts", code), facts("world.openfoodfacts.org", "Open Food Facts", code)]);
      const p: any = rs.find((x) => x?.name);
      if (p) {
        // Remember it. A failed save never blocks the answer.
        try { await sb.from("product_catalog_cache").upsert({ upc: n, product_name: p.name, brand: p.brand || null, category: p.category || null, description: p.description || null, image_url: p.image || null, retail: p.retail || null, source: p.source, updated_at: new Date().toISOString() }, { onConflict: "upc" }); } catch (_) { /* ignore */ }
        return json({ ...p, requested_upc: n });
      }
    }
    return json({ upc: n, found: false, tried: variants(n) });
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
