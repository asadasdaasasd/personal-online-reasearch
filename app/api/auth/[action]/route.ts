import { z } from "zod";
import { authMode, emailConfig, emailAllowed } from "@/lib/auth-config";
import { emailClient } from "@/lib/email-auth";
export const dynamic = "force-dynamic";
const emailSchema = z.string().trim().toLowerCase().email().max(254);
const passwordSchema = z
  .string()
  .min(12, "密码至少 12 个字符")
  .max(128, "密码不能超过 128 个字符");
const reply = (body: object, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  if (authMode() !== "email")
    return reply({ error: "此地址使用平台登录，请进入现有工作台。" }, 404);
  const config = emailConfig();
  if (!config)
    return reply({ error: "邮箱登录服务尚未配置，请联系站点管理员。" }, 503);
  if (
    request.headers.get("origin") !== config.origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    return reply({ error: "请求来源不被允许。" }, 403);
  const { action } = await params;
  if (!["login", "register", "forgot", "password", "logout"].includes(action))
    return reply({ error: "操作不存在。" }, 404);
  try {
    const text = await request.text();
    if (text.length > 4096) return reply({ error: "请求内容过大。" }, 413);
    const input = text ? JSON.parse(text) : {};
    const client = await emailClient(true);
    if (action === "logout") {
      const { error } = await client.auth.signOut({ scope: "local" });
      return error
        ? reply({ error: "退出未完成，请重试。" }, 502)
        : reply({ redirect: "/login" });
    }
    if (action === "password") {
      const password = passwordSchema.parse(input.password);
      const {
        data: { user },
        error,
      } = await client.auth.getUser();
      if (
        error ||
        !user?.email ||
        !user.email_confirmed_at ||
        !emailAllowed(user.email, config.allowed)
      )
        return reply({ error: "链接已过期，请重新申请重置密码。" }, 401);
      const { error: updateError } = await client.auth.updateUser({ password });
      if (updateError)
        return reply(
          { error: "密码未更新，请检查密码要求或重新申请重置邮件。" },
          400,
        );
      await client.auth.signOut({ scope: "global" });
      return reply({ redirect: "/login?changed=1" });
    }
    const email = emailSchema.parse(input.email);
    if (!emailAllowed(email, config.allowed)) {
      // Do not reveal whether an address has an account.
      return action === "forgot"
        ? reply({
            message:
              "如果此邮箱可以使用本站，你将收到重置邮件，请检查收件箱和垃圾邮件。",
          })
        : reply(
            { error: "无法登录或注册，请检查账户信息及本站访问权限。" },
            400,
          );
    }
    if (action === "forgot") {
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: `${config.origin}/auth/callback?next=/account/password`,
      });
      if (error)
        return reply(
          { error: "暂时无法发送邮件，请稍后重试。" },
          error.status === 429 ? 429 : 502,
        );
      return reply({
        message:
          "如果此邮箱可以使用本站，你将收到重置邮件，请检查收件箱和垃圾邮件。",
      });
    }
    const password =
      action === "register"
        ? passwordSchema.parse(input.password)
        : z.string().min(1).max(1024).parse(input.password);
    if (action === "register") {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${config.origin}/auth/callback` },
      });
      if (error)
        return reply(
          { error: "注册未完成，请检查密码要求或稍后重试。" },
          error.status === 429 ? 429 : 400,
        );
      // Never retain a session whose email is still pending confirmation.
      if (data.session && !data.user?.email_confirmed_at)
        await client.auth.signOut({ scope: "local" });
      return data.session && data.user?.email_confirmed_at
        ? reply({ redirect: "/" })
        : reply({
            message:
              "请检查邮箱中的确认邮件。完成验证后，再用邮箱和密码登录。已有账户可直接登录或找回密码。",
          });
    }
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.user?.email_confirmed_at)
      return reply(
        { error: "邮箱或密码不正确，或邮箱尚未验证。" },
        error?.status === 429 ? 429 : 400,
      );
    return reply({ redirect: "/" });
  } catch (error) {
    if (error instanceof z.ZodError)
      return reply(
        { error: error.issues.map((i) => i.message).join("；") },
        400,
      );
    if (error instanceof SyntaxError)
      return reply({ error: "请求格式无效。" }, 400);
    // Never log errors that may contain passwords, recovery codes, or tokens.
    return reply({ error: "登录服务暂时不可用，请稍后重试。" }, 502);
  }
}
