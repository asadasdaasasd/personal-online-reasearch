import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authMode, emailConfig } from "@/lib/auth-config";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (authMode() !== "email") return response;
  const config = emailConfig();
  // Login/confirmation handlers own their cookie changes.
  if (
    !config ||
    request.nextUrl.pathname.startsWith("/api/auth/") ||
    request.nextUrl.pathname.startsWith("/auth/")
  )
    return response;
  const client = createServerClient(config.url, config.key, {
    cookieOptions: config.cookieOptions,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  await client.auth.getUser();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/", "/login", "/account/:path*", "/api/:path*"],
};
