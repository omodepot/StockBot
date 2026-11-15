import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Sends one StockBot item to Omni Social as a Deal Drop MI Facebook Page draft (never published here).
// Called by the signed-in StockBot user (Ready to list / Approve / Send). Uses the user's own access, so
// only their items and photos can be sent. The Omni Social receiver is protected by OMNI_INTAKE_SECRET.

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST,OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const OMNI_INTAKE_URL = "https://mbcbviupykjjqmktiyrq.supabase.co/functions/v1/stockbot-intake";
const YEAR = 60 * 60 * 24 * 365;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Use POST" }, 405);
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return json({ ok: false, error: "Please sign in again" }, 401);
    const body = await req.json().catch(() => ({}));
    const itemId = String(body.item_id || "");
    const caption = String(body.caption || "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(itemId)) return json({ ok: false, error: "Missing item" }, 400);
    if (!caption) return json({ ok: false, error: "Missing listing text" }, 400);

    const { data: item, error: ie } = await sb.from("inventory_items").select("id,product_name,available_qty,archived_at,listing_approved_at").eq("id", itemId).eq("owner_id", user.id).maybeSingle();
    if (ie) throw ie;
    if (!item || item.archived_at) return json({ ok: false, error: "Item not found" }, 404);
    if (Number(item.available_qty || 0) <= 0) return json({ ok: false, error: "This item is sold out" }, 409);

    const { data: photos, error: pe } = await sb.from("inventory_photos").select("storage_path,sort_order,created_at").eq("inventory_item_id", itemId).order("sort_order", { ascending: true }).order("created_at", { ascending: true }).limit(10);
    if (pe) throw pe;
    const paths = (photos || []).map((p: any) => p.storage_path).filter(Boolean);
    let media: string[] = [];
    if (paths.length) {
      const { data: signed, error: se } = await sb.storage.from("inventory-photos").createSignedUrls(paths, YEAR);
      if (se) throw se;
      media = (signed || []).map((s: any) => s.signedUrl).filter(Boolean).map((u: string) => new URL(u, Deno.env.get("SUPABASE_URL")!).toString());
    }

    const secret = Deno.env.get("OMNI_INTAKE_SECRET") || "";
    if (!secret) return json({ ok: false, error: "Omni Social connection is not set up (missing secret)" }, 500);
    const r = await fetch(OMNI_INTAKE_URL, { method: "POST", headers: { "Content-Type": "application/json", "x-stockbot-secret": secret }, body: JSON.stringify({ source_id: itemId, caption, media_urls: media }) });
    const out = await r.json().catch(() => ({}));
    if (!r.ok || !out.ok) return json({ ok: false, error: out.error || ("Omni Social answered " + r.status) }, 502);

    const now = new Date().toISOString();
    await sb.from("inventory_items").update({ listing_approval: "approved", listing_approved_at: item.listing_approved_at || now, listing_channel: "omni_social", listing_updated_at: now }).eq("id", itemId);
    return json({ ok: true, post_id: out.post_id, action: out.action, status: out.status || "draft", photos: media.length });
  } catch (e) {
    return json({ ok: false, error: String((e as any)?.message || e) }, 500);
  }
});
