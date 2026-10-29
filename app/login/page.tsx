import { AuthForm } from "@/components/research/auth-form";
import { AuthLayout } from "@/components/research/auth-layout";
import { authMode, emailConfig } from "@/lib/auth-config";
import { getResearchUser } from "@/lib/auth";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (authMode() === "sites")
    return (
      <AuthLayout>
        <div className="auth-form">
          <h1>进入科研工作台</h1>
          <p className="auth-description">
            当前地址使用 ChatGPT
            账户验证。独立邮箱登录入口将在部署配置完成后提供。
          </p>
          <a
            className="button primary auth-submit"
            href="/signin-with-chatgpt?return_to=/"
            target="_top"
          >
            使用当前账户进入
          </a>
        </div>
      </AuthLayout>
    );
  if (await getResearchUser()) redirect("/");
  const query = await searchParams;
  return (
    <AuthLayout>
      {query.expired && (
        <p className="auth-error" role="alert">
          验证链接已过期或已使用，请重新申请邮件。
        </p>
      )}
      {query.changed && (
        <p className="auth-success" role="status">
          密码已更新，请重新登录。
        </p>
      )}
      <AuthForm ready={!!emailConfig()} />
    </AuthLayout>
  );
}
