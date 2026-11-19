/**
 * Send one alert email through Resend. Server-side only: the key never
 * reaches the browser. With no key, or no recipient allowlist, the route
 * reports "preview only".
 *
 * GET  -> { configured, from }
 * POST { to, subject, text, html? } -> { ok: true, id } | { ok: false, error, status }
 *
 * Abuse protection. The route has no login, so it must not work as an open
 * relay that lets anyone send email with the team's key:
 * - Recipients: only addresses on ALERT_EMAIL_ALLOWLIST, a comma-separated list
 *   of exact addresses ("ana@uni.edu") and/or whole domains ("@skidmore.edu").
 *   No allowlist means no sending (fails closed).
 * - Same origin: a POST must come from a page on this site (Origin/Referer).
 * - Rate limits: per IP, per recipient, and a daily cap (ALERT_EMAIL_DAILY_CAP,
 *   default 20). They live in this server instance's memory, so on Vercel they
 *   reset on a cold start and are not shared between instances: they slow abuse
 *   down, and the allowlist is what stops it.
 * - Subject: one line, always prefixed "[Resistance Observatory]".
 *
 * "Sent" means the provider returned a message id; nothing else counts.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** The key, under any of the names the team has used for it. Never logged, never sent to the browser. */
const resendKey = () => (process.env.RESEND_API_KEY || process.env.resend_api_key || process.env.RESEND_KEY || process.env.resend_key || "").trim();

const FROM = () => process.env.ALERT_FROM_EMAIL || "onboarding@resend.dev";
const EMAIL = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
const SUBJECT_PREFIX = "[Resistance Observatory]";

/** Lower-cased allowlist entries: exact addresses, or "@domain" for a whole domain. Never sent to the browser. */
const allowlist = () =>
  (process.env.ALERT_EMAIL_ALLOWLIST || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

/** Sending works only with both a key and an allowlist. */
const configured = () => Boolean(resendKey()) && allowlist().length > 0;

function isAllowedRecipient(to: string): boolean {
  const addr = to.toLowerCase();
  const domain = addr.slice(addr.lastIndexOf("@"));
  return allowlist().some((entry) => (entry.startsWith("@") ? domain === entry : addr === entry));
}

/** True when the request was sent by a page on this same site. */
function isSameOrigin(req: Request): boolean {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const source = req.headers.get("origin") || req.headers.get("referer");
  if (!host || !source) return false;
  try {
    return new URL(source).host === host;
  } catch {
    return false;
  }
}

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/* In-memory rate limits (per server instance; see the note at the top). */
const MINUTE = 60 * 1000;
const LIMITS = {
  ip: { max: 3, windowMs: 10 * MINUTE },
  recipient: { max: 3, windowMs: 60 * MINUTE },
} as const;
const hits = { ip: new Map<string, number[]>(), recipient: new Map<string, number[]>() };
let day = "";
let sentToday = 0;

const dailyCap = () => {
  const n = Number(process.env.ALERT_EMAIL_DAILY_CAP);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 20;
};

/** Records one attempt for `key` and says whether it is within the limit. */
function withinLimit(kind: "ip" | "recipient", key: string, now: number): boolean {
  const { max, windowMs } = LIMITS[kind];
  const map = hits[kind];
  if (map.size > 5000) map.clear(); // keep memory bounded
  const recent = (map.get(key) ?? []).filter((t) => now - t < windowMs);
  const ok = recent.length < max;
  if (ok) recent.push(now);
  map.set(key, recent);
  return ok;
}

function withinDailyCap(now: number): boolean {
  const today = new Date(now).toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    sentToday = 0;
  }
  return sentToday < dailyCap();
}

export async function GET() {
  return NextResponse.json({ configured: configured(), from: FROM() });
}

export async function POST(req: Request) {
  const key = resendKey();
  if (!key || allowlist().length === 0) {
    return NextResponse.json(
      { ok: false, previewOnly: true, error: "Email sending is not set up on this server. Preview only." },
      { status: 503 },
    );
  }
  if (!isSameOrigin(req)) {
    return NextResponse.json({ ok: false, error: "Requests must come from this site." }, { status: 403 });
  }

  let body: { to?: unknown; subject?: unknown; text?: unknown; html?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Request body was not JSON." }, { status: 400 });
  }
  const to = typeof body.to === "string" ? body.to.trim() : "";
  const rawSubject = typeof body.subject === "string" ? body.subject.replace(/[\r\n]+/g, " ").trim() : "";
  const text = typeof body.text === "string" ? body.text.slice(0, 40000) : "";
  const html = typeof body.html === "string" ? body.html.slice(0, 120000) : undefined;
  if (to.length > 254 || !EMAIL.test(to)) {
    return NextResponse.json({ ok: false, error: "Enter one plain email address." }, { status: 400 });
  }
  if (!rawSubject || !text) {
    return NextResponse.json({ ok: false, error: "Subject and text are required." }, { status: 400 });
  }
  if (!isAllowedRecipient(to)) {
    return NextResponse.json({ ok: false, error: "This demo only sends to approved addresses." }, { status: 403 });
  }
  const now = Date.now();
  if (!withinLimit("ip", clientIp(req), now) || !withinLimit("recipient", to.toLowerCase(), now) || !withinDailyCap(now)) {
    return NextResponse.json({ ok: false, error: "Too many emails were sent. Try again later." }, { status: 429 });
  }
  const subject = (rawSubject.startsWith(SUBJECT_PREFIX) ? rawSubject : `${SUBJECT_PREFIX} ${rawSubject}`).slice(0, 300);

  try {
    sentToday += 1; // counted once the request goes to the provider
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM(), to, subject, text, ...(html ? { html } : {}) }),
      signal: AbortSignal.timeout(15000),
    });
    const raw = await res.text();
    let json: { id?: string; message?: string; name?: string } = {};
    try {
      json = JSON.parse(raw);
    } catch {
      /* provider sent non-JSON; fall through with raw text */
    }
    if (res.ok && typeof json.id === "string" && json.id) {
      return NextResponse.json({ ok: true, id: json.id, from: FROM(), to });
    }
    // Provider's own words, verbatim.
    return NextResponse.json(
      { ok: false, error: json.message || raw || `Provider returned HTTP ${res.status}`, status: res.status },
      { status: 502 },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `Could not reach the email provider: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    );
  }
}
