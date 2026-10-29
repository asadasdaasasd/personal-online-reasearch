import { emailClient } from "@/lib/email-auth";
import { authMode, emailConfig } from "@/lib/auth-config";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const config = emailConfig();
  if (authMode() !== "email" || !config)
    return new Response("邮箱登录服务尚未配置", { status: 503 });
  const url = new URL(request.url),
    token = url.searchParams.get("token_hash"),
    type = url.searchParams.get("type");
  if (
    token &&
    token.length < 4096 &&
    (type === "email" || type === "recovery")
  ) {
    const client = await emailClient(true);
    const { error } = await client.auth.verifyOtp({ token_hash: token, type });
    if (!error)
      return new Response(null, {
        status: 303,
        headers: {
          Location: `${config.origin}${type === "recovery" ? "/account/password" : "/"}`,
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        },
      });
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
