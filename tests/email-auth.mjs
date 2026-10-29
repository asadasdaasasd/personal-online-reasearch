import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { startEmailFixture } from "./email-provider-fixture.mjs";
const base = "http://127.0.0.1:5175";
const fixture = await startEmailFixture();
mkdirSync(".sites-runtime", { recursive: true });
const configPath = ".sites-runtime/email-test.json";
writeFileSync(
  configPath,
  JSON.stringify({
    name: "research-os-email-test",
    main: "../worker/index.ts",
    compatibility_date: "2026-05-15",
    compatibility_flags: ["nodejs_compat"],
    vars: {
      AUTH_MODE: "email",
      APP_ORIGIN: base,
      SUPABASE_URL: "http://127.0.0.1:54328",
      SUPABASE_PUBLISHABLE_KEY: "local-contract-key-not-a-real-credential",
      AUTH_ALLOWED_EMAILS:
        "alice@example.test,bob@example.test,unknown@example.test",
    },
    d1_databases: [
      {
        binding: "DB",
        database_name: "site-creator-d1",
        database_id: "00000000-0000-4000-8000-000000000000",
        migrations_dir: "../drizzle",
      },
    ],
    r2_buckets: [{ binding: "BUCKET", bucket_name: "site-creator-r2" }],
  }),
);
// Supply an already built email worker to test the production runtime. We only
// replace ignored deployment bindings; no test fixture enters the source build.
const builtPath = "dist/server/wrangler.json";
assert.ok(existsSync(builtPath), "Run npm run build:email first");
const built = JSON.parse(readFileSync(builtPath, "utf8"));
const originalBuilt = readFileSync(builtPath, "utf8");
built.vars = JSON.parse(readFileSync(configPath, "utf8")).vars;
built.d1_databases = [
  {
    binding: "DB",
    database_name: "site-creator-d1",
    database_id: "00000000-0000-4000-8000-000000000000",
  },
];
built.r2_buckets = [{ binding: "BUCKET", bucket_name: "site-creator-r2" }];
writeFileSync(builtPath, JSON.stringify(built));
const server = spawn(
  process.execPath,
  [
    "--import",
    "./scripts/sites-env.mjs",
    "node_modules/wrangler/bin/wrangler.js",
    "dev",
    "--config",
    builtPath,
    "--local",
    "--persist-to",
    ".wrangler/state",
    "--ip",
    "127.0.0.1",
    "--port",
    "5175",
    "--inspector-port",
    "0",
  ],
  {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
  },
);
let output = "";
server.stdout.on("data", (b) => (output += b));
server.stderr.on("data", (b) => (output += b));
class Browser {
  cookies = new Map();
  async request(
    path,
    { method = "GET", body, expected = 200, origin = base, headers = {} } = {},
  ) {
    const response = await fetch(base + path, {
      method,
      redirect: "manual",
      headers: {
        cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "),
        ...(method === "POST"
          ? { Origin: origin, "Content-Type": "application/json" }
          : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    for (const raw of response.headers.getSetCookie()) {
      const pair = raw.split(";")[0],
        at = pair.indexOf("=");
      if (/max-age=0/i.test(raw)) this.cookies.delete(pair.slice(0, at));
      else this.cookies.set(pair.slice(0, at), pair.slice(at + 1));
    }
    const text = await response.text();
    assert.equal(
      response.status,
      expected,
      `${method} ${path}: ${text.slice(0, 250)}`,
    );
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { response, data };
  }
  post(action, body, expected = 200) {
    return this.request(`/api/auth/${action}`, {
      method: "POST",
      body,
      expected,
    });
  }
}
const alice = new Browser(),
  bob = new Browser(),
  anon = new Browser();
const password = "Research-test-password-2026";
let passed = 0;
const pass = (s) => {
  passed++;
  console.log("PASS", s);
};
try {
  const started = Date.now();
  for (;;) {
    try {
      const r = await fetch(base + "/login");
      if (r.ok) break;
    } catch {}
    if (Date.now() - started > 45000)
      throw new Error(
        "Email test worker did not start: " + output.slice(-2000),
      );
    await new Promise((r) => setTimeout(r, 300));
  }
  const home = await anon.request("/", { expected: 307 });
  assert.equal(home.response.headers.get("location"), "/login");
  await anon.request("/api/records", {
    expected: 401,
    headers: {
      "oai-authenticated-user-id": "local_seedy",
      "oai-authenticated-user-email": "seedy@sites.test",
    },
  });
  pass(
    "Independent login page and anonymous/spoofed platform identity rejected",
  );
  await alice.request("/api/auth/register", {
    method: "POST",
    body: { email: "alice@example.test", password },
    origin: "https://evil.example",
    expected: 403,
  });
  await alice.post(
    "register",
    { email: "alice@example.test", password: "short" },
    400,
  );
  await alice.post(
    "register",
    { email: "outsider@example.test", password },
    400,
  );
  pass("Cross-origin, weak-password and non-allowlisted registration rejected");
  await alice.post("register", { email: "alice@example.test", password });
  await alice.post("login", { email: "alice@example.test", password }, 400);
  const confirmation = fixture.messages.find(
    (m) => m.email === "alice@example.test" && m.type === "email",
  );
  assert.ok(confirmation);
  const confirmed = await alice.request(
    `/auth/confirm?type=email&token_hash=${confirmation.hash}&next=https://evil.example`,
    { expected: 303 },
  );
  assert.equal(confirmed.response.headers.get("location"), base + "/");
  const consumed = await anon.request(
    `/auth/confirm?type=email&token_hash=${confirmation.hash}`,
    { expected: 303 },
  );
  assert.equal(
    consumed.response.headers.get("location"),
    base + "/login?expired=1",
  );
  await alice.post("logout", {});
  pass(
    "Signup requires verified email; confirmation is one-use and cannot redirect off-site",
  );
  await alice.post(
    "login",
    { email: "alice@example.test", password: "incorrect" },
    400,
  );
  const signedIn = await alice.post("login", {
    email: "alice@example.test",
    password,
  });
  assert.match(signedIn.response.headers.getSetCookie().join(";"), /HttpOnly/i);
  assert.match(
    signedIn.response.headers.getSetCookie().join(";"),
    /SameSite=Lax/i,
  );
  await alice.request("/api/records");
  assert.ok(
    fixture.refreshCount > 0,
    "Expired tokens must refresh through middleware",
  );
  pass(
    "Password login sets HttpOnly cookies and expired tokens renew in the built Worker",
  );
  await bob.post("register", { email: "bob@example.test", password });
  const bobConfirmation = fixture.messages.find(
    (m) => m.email === "bob@example.test" && m.type === "email",
  );
  await bob.request(
    `/auth/confirm?type=email&token_hash=${bobConfirmation.hash}`,
    { expected: 303 },
  );
  const project = await alice.request("/api/records/projects", {
    method: "POST",
    expected: 201,
    body: {
      title: "Email auth contract project",
      status: "active",
      date: "2026-10-29",
      project_id: null,
      milestone_id: null,
      task_id: null,
      parent_id: null,
      data: {},
    },
  });
  await bob.request(`/api/records/projects/${project.data.id}`, {
    expected: 404,
  });
  const list = await bob.request("/api/records");
  assert.ok(!list.data.projects.some((p) => p.id === project.data.id));
  await alice.request(`/api/records/projects/${project.data.id}`, {
    method: "DELETE",
  });
  pass("Real D1 records remain isolated between two email accounts");
  await bob.request("/api/records/projects", {
    method: "POST", expected: 409,
    headers: { "X-Research-Owner": project.data.owner_id },
    body: { title: "stale tab must not save", status: "active", date: "2026-10-29", project_id: null, milestone_id: null, task_id: null, parent_id: null, data: {} },
  });
  const exported = (await alice.request("/api/backup")).data;
  for (const key of Object.keys(exported.records)) exported.records[key] = [];
  const migratedId = crypto.randomUUID();
  exported.records.projects = [{ ...project.data, id: migratedId, owner_id: "legacy-sites-identity" }];
  await alice.request("/api/backup", { method: "POST", body: { backup: exported, confirm: "MERGE_ONLY", files: {} } });
  const migrated = (await alice.request(`/api/records/projects/${migratedId}`)).data;
  assert.equal(migrated.owner_id, project.data.owner_id);
  await bob.request(`/api/records/projects/${migratedId}`, { expected: 404 });
  await alice.request(`/api/records/projects/${migratedId}`, { method: "DELETE" });
  pass("Stale-tab writes rejected; backup migration assigns data to the verified email identity");
  const count = fixture.messages.length;
  await anon.post("forgot", { email: "unknown@example.test" });
  await anon.post("forgot", { email: "outside@example.test" });
  assert.equal(fixture.messages.length, count);
  await anon.post("forgot", { email: "alice@example.test" });
  const recovery = fixture.messages.findLast(
    (m) => m.email === "alice@example.test" && m.type === "recovery",
  );
  const recoveryBrowser = new Browser();
  await recoveryBrowser.request(
    `/auth/confirm?type=recovery&token_hash=${recovery.hash}`,
    { expected: 303 },
  );
  await recoveryBrowser.request("/account/password");
  await recoveryBrowser.post("password", { password: password + "-changed" });
  await anon.post("login", { email: "alice@example.test", password }, 400);
  await anon.post("login", {
    email: "alice@example.test",
    password: password + "-changed",
  });
  await alice.request("/api/records", { expected: 401 });
  pass(
    "Recovery is non-enumerating; one-use email link changes password and revokes prior sessions",
  );
  await anon.post("logout", {});
  await anon.request("/api/records", { expected: 401 });
  await bob.post("logout", {});
  pass("Logout removes browser access");
  console.log(
    `PASS ${passed} email authentication contract groups (local provider fixture, real built Worker/D1). Real Supabase and SMTP remain unverified.`,
  );
} finally {
  server.kill("SIGINT");
  await new Promise((resolve) => {
    if (server.exitCode !== null) resolve();
    else {
      server.once("exit", resolve);
      setTimeout(resolve, 3000);
    }
  });
  writeFileSync(builtPath, originalBuilt);
  await fixture.close();
}
