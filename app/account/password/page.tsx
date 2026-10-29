import { AuthForm } from "@/components/research/auth-form";
import { AuthLayout } from "@/components/research/auth-layout";
import { authMode } from "@/lib/auth-config";
import { getResearchUser } from "@/lib/auth";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Password() {
  if (authMode() !== "email") redirect("/");
  if (!(await getResearchUser())) redirect("/login?expired=1");
  return (
    <AuthLayout>
      <AuthForm ready reset />
    </AuthLayout>
  );
}
