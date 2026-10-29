import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { emailConfig } from "./auth-config";

// Server-only cookie client: no password or bearer token enters browser storage.
export async function emailClient(writable = false) {
  const config = emailConfig();
  if (!config) throw new Error("Email authentication is not configured");
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: config.cookieOptions,
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        // proxy.ts refreshes cookies before a read-only Server Component renders.
        if (writable)
          values.forEach(({ name, value, options }) =>
            jar.set(name, value, options),
          );
      },
    },
  });
}
