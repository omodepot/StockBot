import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Saves a catalog product image (found by the UPC lookup) to a StockBot item.
// Browsers cannot download most store images (they block cross-site requests), so the server fetches the
// image and stores it exactly like an uploaded photo: inventory-photos/<user>/<item>/<uuid>.<ext>, plus an
// inventory_photos row appended after the item's existing photos.

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST,OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const MAX_BYTES = 8 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

// Public https hosts only: no IP literals, localhost or internal names.
export function allowedImageUrl(raw: string): URL | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "https:" || u.username || u.password) return null;
  const h = u.hostname.toLowerCase();
  if (!h.includes(".") || h.includes(":") || h.startsWith("[") || /^\d+(\.\d+){3}$/.test(h)) return null;
  if (h === "localhost" || /\.(localhost|local|internal|lan|home|corp)$/.test(h)) return null;
  return u;
}

async function fetchImage(start: URL) {
  let target = start;
  for (let hop = 0; hop < 4; hop++) {
    const c = new AbortController(), t = setTimeout(() => c.abort(), 8000);
    let r: Response;
    try { r = await fetch(target, { redirect: "manual", signal: c.signal, headers: { Accept: "image/jpeg,image/png;q=0.9,image/webp;q=0.8", "User-Agent": "Mozilla/5.0 (compatible; StockBot/4.0; +https://omodepot.github.io/StockBot/)" } }); }
    finally { clearTimeout(t); }
    if (r.status >= 300 && r.status < 400) {
      const next = allowedImageUrl(new URL(r.headers.get("location") || "", target).toString());
      if (!next) throw new Error("Image redirected to a blocked address");
      target = next; continue;
    }
    if (!r.ok) throw new Error("Image download failed (" + r.status + ")");
    const type = (r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!TYPES[type]) throw new Error("Not a supported image type (" + (type || "unknown") + ")");
    if (Number(r.headers.get("content-length") || 0) > MAX_BYTES) throw new Error("Image is too large");
    const reader = r.body!.getReader(); const parts: Uint8Array[] = []; let size = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > MAX_BYTES) { try { await reader.cancel(); } catch (_) {} throw new Error("Image is too large"); } parts.push(value); }
    if (size < 200) throw new Error("Image is empty");
    const bytes = new Uint8Array(size); let o = 0; for (const p of parts) { bytes.set(p, o); o += p.byteLength; }
    return { bytes, type };
  }
  throw new Error("Too many redirects");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Use POST" }, 405);
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return json({ ok: false, error: "Please sign in again" }, 401);
    const body = await req.json().catch(() => ({}));
    const itemId = String(body.item_id || "");
    const src = allowedImageUrl(String(body.image_url || ""));
    if (!/^[0-9a-f-]{36}$/i.test(itemId)) return json({ ok: false, error: "Missing item" }, 400);
    if (!src) return json({ ok: false, error: "Image address is not allowed" }, 400);
    const { data: item } = await sb.from("inventory_items").select("id").eq("id", itemId).eq("owner_id", user.id).maybeSingle();
    if (!item) return json({ ok: false, error: "Inventory item not found" }, 404);

    const { bytes, type } = await fetchImage(src);
    const path = `${user.id}/${itemId}/${crypto.randomUUID()}.${TYPES[type]}`;
    const { error: up } = await sb.storage.from("inventory-photos").upload(path, bytes, { contentType: type, upsert: false });
    if (up) throw up;
    const { count } = await sb.from("inventory_photos").select("id", { count: "exact", head: true }).eq("inventory_item_id", itemId);
    const { error: db } = await sb.from("inventory_photos").insert({ owner_id: user.id, inventory_item_id: itemId, storage_path: path, sort_order: count || 0, mime_type: type, byte_size: bytes.byteLength });
    if (db) { await sb.storage.from("inventory-photos").remove([path]); throw db; }
    return json({ ok: true, path });
  } catch (e) {
    return json({ ok: false, error: String((e as any)?.message || e) }, 400);
  }
});
