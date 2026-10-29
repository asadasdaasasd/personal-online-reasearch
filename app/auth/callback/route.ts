import { emailClient } from "@/lib/email-auth";
import { authMode, emailConfig } from "@/lib/auth-config";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const config = emailConfig();
  if (authMode() !== "email" || !config)
    return new Response("邮箱登录服务尚未配置", { status: 503 });
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code && code.length < 4096) {
    const client = await emailClient(true);
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) {
      const next =
        url.searchParams.get("next") === "/account/password"
          ? "/account/password"
          : "/";
      return new Response(null, {
        status: 303,
        headers: {
          Location: `${config.origin}${next}`,
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        },
      });
    }
  }
  return new Response(null, {
    status: 303,
    headers: {
      Location: `${config.origin}/login?expired=1`,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
