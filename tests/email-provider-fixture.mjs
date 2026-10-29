// Local HTTP contract fixture, never included in the application build.
// This tests our real Supabase SDK integration, NOT real mail delivery.
import http from "node:http";
import { randomUUID, createHmac } from "node:crypto";
export async function startEmailFixture() {
  const accounts = new Map(),
    tokens = new Map(),
    refreshes = new Map(),
    hashes = new Map(),
    messages = [];
  let refreshCount = 0;
  const userData = (a) => ({
    id: a.id,
    email: a.email,
    aud: "authenticated",
    role: "authenticated",
    email_confirmed_at: a.confirmed ? new Date().toISOString() : null,
    user_metadata: {},
    app_metadata: { provider: "email", providers: ["email"] },
    created_at: new Date().toISOString(),
  });
  function session(a, short = false) {
    const now = Math.floor(Date.now() / 1000),
      expires = short ? 1 : 3600;
    const header = Buffer.from(
      JSON.stringify({ alg: "HS256", typ: "JWT" }),
    ).toString("base64url");
    const body = Buffer.from(
      JSON.stringify({
        sub: a.id,
        aud: "authenticated",
        role: "authenticated",
        email: a.email,
        iat: now,
        exp: now + expires,
        jti: randomUUID(),
      }),
    ).toString("base64url");
    const token = `${header}.${body}.${createHmac("sha256", "LOCAL-CONTRACT-FIXTURE-ONLY").update(`${header}.${body}`).digest("base64url")}`;
    const refresh = randomUUID();
    tokens.set(token, a);
    refreshes.set(refresh, a);
    return {
      access_token: token,
      refresh_token: refresh,
      token_type: "bearer",
      expires_in: expires,
      expires_at: now + expires,
      user: userData(a),
    };
  }
  function message(a, type) {
    const hash = randomUUID();
    hashes.set(hash, { account: a, type });
    messages.push({ email: a.email, type, hash });
  }
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1"),
      chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    let body = {};
    try {
      body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
    } catch {}
    const send = (status, value) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(value));
    };
    const error = () =>
      send(400, {
        code: "invalid_credentials",
        msg: "Invalid login credentials",
      });
    if (url.pathname === "/auth/v1/signup") {
      const old = accounts.get(body.email);
      if (old) return send(200, { user: userData(old) });
      const account = {
        id: randomUUID(),
        email: body.email,
        password: body.password,
        confirmed: false,
      };
      accounts.set(body.email, account);
      message(account, "email");
      return send(200, { user: userData(account) });
    }
    if (
      url.pathname === "/auth/v1/token" &&
      url.searchParams.get("grant_type") === "password"
    ) {
      const a = accounts.get(body.email);
      if (!a?.confirmed || a.password !== body.password) return error();
      return send(200, session(a, true));
    }
    if (
      url.pathname === "/auth/v1/token" &&
      url.searchParams.get("grant_type") === "refresh_token"
    ) {
      const a = refreshes.get(body.refresh_token);
      if (!a) return error();
      refreshCount++;
      return send(200, session(a));
    }
    if (url.pathname === "/auth/v1/recover") {
      const a = accounts.get(body.email);
      if (a) message(a, "recovery");
      return send(200, {});
    }
    if (url.pathname === "/auth/v1/verify") {
      const record = hashes.get(body.token_hash);
      if (!record || record.type !== body.type) return error();
      hashes.delete(body.token_hash);
      record.account.confirmed = true;
      return send(200, session(record.account));
    }
    const a = tokens.get(
      (req.headers.authorization || "").replace(/^Bearer /, ""),
    );
    if (url.pathname === "/auth/v1/user") {
      if (!a) return send(401, { code: "bad_jwt", msg: "Invalid token" });
      if (req.method === "PUT") a.password = body.password;
      return send(200, userData(a));
    }
    if (url.pathname === "/auth/v1/logout") {
      if (a) {
        for (const [key, value] of tokens)
          if (value.id === a.id) tokens.delete(key);
        for (const [key, value] of refreshes)
          if (value.id === a.id) refreshes.delete(key);
      }
      return send(200, {});
    }
    return send(404, { msg: "fixture endpoint not implemented" });
  });
  await new Promise((resolve) => server.listen(54328, "127.0.0.1", resolve));
  return {
    close: () => new Promise((resolve) => server.close(resolve)),
    messages,
    get refreshCount() {
      return refreshCount;
    },
  };
}
