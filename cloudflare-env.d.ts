declare namespace Cloudflare {
  interface Env {
    AUTH_MODE?: "sites" | "email";
    SUPABASE_URL?: string;
    SUPABASE_PUBLISHABLE_KEY?: string;
    APP_ORIGIN?: string;
    AUTH_ALLOWED_EMAILS?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
