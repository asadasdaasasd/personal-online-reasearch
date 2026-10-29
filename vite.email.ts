import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import type { UserConfig } from "vite";
import { configureToolEnvironment } from "./scripts/tool-environment.mjs";

export function emailViteConfig(): UserConfig {
  configureToolEnvironment(process.cwd());
  return {
    plugins: [
      vinext(),
      cloudflare({
        configPath: process.env.RESEARCH_EMAIL_CONFIG || "wrangler.email.jsonc",
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
      }),
    ],
    server: { host: "127.0.0.1" },
  };
}
