import { fileURLToPath } from "node:url";
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { configureToolEnvironment } from "./tool-environment.mjs";
const [command] = process.argv.slice(2);
if (!["dev", "build", "deploy"].includes(command))
  throw new Error("Expected dev, build or deploy.");
configureToolEnvironment(process.cwd());
process.env.RESEARCH_DEPLOYMENT = "email";
process.env.RESEARCH_EMAIL_CONFIG ||= existsSync("wrangler.email.local.json")
  ? "wrangler.email.local.json"
  : "wrangler.email.jsonc";
if (command === "deploy") {
  // A plain JSON local config is intentionally required for production preflight.
  const configFile = process.env.RESEARCH_EMAIL_CONFIG;
  const config = JSON.parse(readFileSync(configFile, "utf8"));
  const vars = config.vars || {};
  const origin = new URL(vars.APP_ORIGIN || "http://localhost");
  if (
    vars.AUTH_MODE !== "email" ||
    origin.protocol !== "https:" ||
    /(^|\.)(localhost|chatgpt\.site)$/.test(origin.hostname) ||
    !vars.SUPABASE_URL?.startsWith("https://") ||
    !vars.SUPABASE_PUBLISHABLE_KEY ||
    !vars.AUTH_ALLOWED_EMAILS?.trim()
  )
    throw new Error(
      "Production email login needs an independent HTTPS origin, Supabase configuration, and an email allowlist in wrangler.email.local.json. See docs/EMAIL_LOGIN.md.",
    );
  if (
    !config.d1_databases?.some((d) => d.binding === "DB" && d.database_id) ||
    !config.r2_buckets?.some((r) => r.binding === "BUCKET" && r.bucket_name)
  )
    throw new Error(
      "Create and configure the production D1 and R2 bindings before deploying.",
    );
  const built = spawnSync(
    process.execPath,
    [fileURLToPath(import.meta.url), "build"],
    { stdio: "inherit", env: process.env },
  );
  if (built.status !== 0) process.exit(built.status ?? 1);
  const wrangler = "node_modules/wrangler/bin/wrangler.js";
  const migrate = spawnSync(
    process.execPath,
    [
      wrangler,
      "d1",
      "migrations",
      "apply",
      "DB",
      "--remote",
      "--config",
      configFile,
    ],
    { stdio: "inherit", env: process.env },
  );
  if (migrate.status !== 0) process.exit(migrate.status ?? 1);
  const deploy = spawnSync(
    process.execPath,
    [wrangler, "deploy", "--config", "dist/server/wrangler.json"],
    { stdio: "inherit", env: process.env },
  );
  process.exit(deploy.status ?? 1);
}
const cli = new URL("../node_modules/vinext/dist/cli.js", import.meta.url);
process.argv = [
  process.execPath,
  fileURLToPath(cli),
  command,
  ...(command === "dev" ? ["--port", "5175"] : []),
];
await import(cli.href);
