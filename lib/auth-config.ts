import { env } from "cloudflare:workers";

export type AuthMode = "sites" | "email";
export function authMode(): AuthMode {
  if (env.AUTH_MODE === undefined || env.AUTH_MODE === "sites") return "sites";
  if (env.AUTH_MODE === "email") return "email";
  throw new Error("Unsupported authentication mode");
}

export function emailConfig() {
  const {
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    APP_ORIGIN,
    AUTH_ALLOWED_EMAILS,
  } = env;
  if (
    !SUPABASE_URL ||
    !SUPABASE_PUBLISHABLE_KEY ||
    !APP_ORIGIN ||
    !AUTH_ALLOWED_EMAILS
  )
    return null;
  try {
    const service = new URL(SUPABASE_URL);
    const origin = new URL(APP_ORIGIN);
    const safe = (u: URL) =>
      u.protocol === "https:" ||
      (u.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname));
    if (
      !safe(service) ||
      !safe(origin) ||
      origin.origin !== APP_ORIGIN ||
      service.username ||
      service.password ||
      service.search ||
      service.hash
    )
      return null;
    const allowed = AUTH_ALLOWED_EMAILS.split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (
      !allowed.length ||
      allowed.some((s) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
    )
      return null;
    return {
      url: service.origin,
      key: SUPABASE_PUBLISHABLE_KEY,
      origin: origin.origin,
      allowed,
      cookieOptions: {
        httpOnly: true,
        secure: origin.protocol === "https:",
        sameSite: "lax" as const,
        path: "/",
      },
    };
  } catch {
    return null;
  }
}

export function emailAllowed(email: string, allowed: string[]) {
  return allowed.includes(email.trim().toLowerCase());
}
