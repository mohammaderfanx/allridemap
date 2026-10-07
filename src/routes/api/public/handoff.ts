import { createFileRoute } from "@tanstack/react-router";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function page(title: string, body: string, script = "") {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f5f5f7;color:#1c1c1e}main{max-width:340px;text-align:center;padding:24px}a{display:inline-block;margin-top:12px;padding:10px 18px;border-radius:999px;background:#0a84ff;color:#fff;text-decoration:none;font-weight:700}</style></head>
<body><main>${body}</main>${script}</body></html>`,
    {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    },
  );
}

/** Opens a signed, single-use handoff link: verifies it, marks it used, then opens the provider app (website fallback). */
export const Route = createFileRoute("/api/public/handoff")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token") ?? "";
        const { verifyHandoff, fillTemplate } = await import("@/lib/mobility/handoff.server");
        const p = token.length < 2000 ? verifyHandoff(token) : null;
        if (!p)
          return page(
            "Link expired",
            '<h1>This link has expired</h1><p>Go back to AllRide and tap Continue again.</p><a href="/">Back to AllRide</a>',
          );

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Single use: only succeeds if the token hasn't been opened before.
        const { data: used } = await supabaseAdmin
          .from("affiliate_conversions_attribution")
          .update({ used_at: new Date().toISOString() })
          .eq("token_id", p.tid)
          .eq("signed_payload", token)
          .is("used_at", null)
          .select("token_id")
          .maybeSingle();
        if (!used)
          return page(
            "Link already used",
            '<h1>This link was already used</h1><p>Go back to AllRide and tap Continue again.</p><a href="/">Back to AllRide</a>',
          );

        const { data: prov } = await supabaseAdmin
          .from("provider_integrations")
          .select("provider_name, affiliate_tag, deep_link_template, web_fallback_url")
          .eq("slug", p.p)
          .maybeSingle();
        if (!prov)
          return page(
            "Unavailable",
            '<h1>This provider is unavailable</h1><a href="/">Back to AllRide</a>',
          );

        const vars = {
          aff: prov.affiliate_tag ?? "",
          olat: String(p.olat),
          olng: String(p.olng),
          dlat: String(p.dlat),
          dlng: String(p.dlng),
          ref: p.tid,
        };
        const app = fillTemplate(prov.deep_link_template ?? "", vars);
        const web = fillTemplate(prov.web_fallback_url ?? "", vars);
        const safe = (u: string) =>
          /^(https:|tel:|[a-z][a-z0-9+.-]*:\/\/)/i.test(u) && !/^(javascript|data):/i.test(u);
        const appUrl = safe(app) ? app : web;
        const webUrl = safe(web) ? web : "/";
        return page(
          `Opening ${prov.provider_name}`,
          `<h1>Opening ${esc(prov.provider_name)}…</h1><p>If nothing happens, continue on the website.</p><a href="${esc(webUrl)}">Open ${esc(prov.provider_name)} website</a>`,
          `<script>var w=${JSON.stringify(webUrl)};var t=setTimeout(function(){location.replace(w)},1200);window.addEventListener('blur',function(){clearTimeout(t)});location.href=${JSON.stringify(appUrl)};</script>`,
        );
      },
    },
  },
});
