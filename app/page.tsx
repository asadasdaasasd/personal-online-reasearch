import { requireResearchUser } from "@/lib/auth";
import { authMode } from "@/lib/auth-config";
import ResearchApp from "@/components/research/app";
export const dynamic = "force-dynamic";
export default async function Home() {
  const user = await requireResearchUser();
  return (
    <ResearchApp
      name={user.displayName}
      email={user.email}
      userId={user.userId}
      authMode={authMode()}
    />
  );
}
