import { redirect } from "next/navigation";
import {
  getChatGPTUser,
  chatGPTSignInPath,
  type ChatGPTUser,
} from "@/app/chatgpt-auth";
import { authMode, emailConfig, emailAllowed } from "./auth-config";
import { emailClient } from "./email-auth";

export async function getResearchUser(): Promise<ChatGPTUser | null> {
  if (authMode() === "sites") return getChatGPTUser();
  const config = emailConfig();
  if (!config) return null;
  const client = await emailClient();
  // Always ask the identity provider to verify the cookie; never trust getSession().
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
    return null;
  return {
    userId: `email:${user.id}`,
    email: user.email,
    displayName: user.email,
    fullName: null,
  };
}

export async function requireResearchUser() {
  const user = await getResearchUser();
  if (user) return user;
  redirect(authMode() === "email" ? "/login" : chatGPTSignInPath("/"));
}
