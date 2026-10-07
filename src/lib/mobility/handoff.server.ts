import { createHmac, timingSafeEqual } from "crypto";

export type HandoffPayload = {
  tid: string; // attribution token id (single-use)
  p: string; // provider slug
  olat: number;
  olng: number;
  dlat: number;
  dlng: number;
  exp: number; // unix seconds
};

const b64 = (s: string) => Buffer.from(s).toString("base64url");

function secret() {
  const s = process.env["HANDOFF_SIGNING_SECRET"];
  if (!s) throw new Error("HANDOFF_SIGNING_SECRET missing");
  return s;
}

export function hmac(data: string, key = secret()) {
  return createHmac("sha256", key).update(data).digest("base64url");
}

export function signHandoff(p: HandoffPayload): string {
  const body = b64(JSON.stringify(p));
  return `${body}.${hmac(body)}`;
}

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Returns the payload only when the signature matches and the token hasn't expired. */
export function verifyHandoff(token: string): HandoffPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig || !safeEqual(sig, hmac(body))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as HandoffPayload;
    if (typeof p.exp !== "number" || p.exp < Date.now() / 1000) return null;
    return p;
  } catch {
    return null;
  }
}

export function fillTemplate(tpl: string, v: Record<string, string>) {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => encodeURIComponent(v[k] ?? ""));
}

/** Estimated commission: 8% of ride-hailing fares, flat 0,50 € per micro-mobility unlock, none for transit. */
export function estimatePayoutCents(category: string, fare: number | null) {
  if (category === "Ride-Hailing") return Math.round((fare ?? 0) * 8);
  if (category === "Micro-Mobility") return 50;
  return 0;
}
