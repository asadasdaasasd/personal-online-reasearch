import { requireChatGPTUser } from "./chatgpt-auth";
import ResearchApp from "@/components/research/app";
export const dynamic = "force-dynamic";
export default async function Home() {
  const user = await requireChatGPTUser("/");
  return <ResearchApp name={user.displayName} email={user.email} />;
}
