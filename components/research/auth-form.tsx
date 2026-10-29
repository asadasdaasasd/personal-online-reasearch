"use client";
import { useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  LoaderCircle,
} from "lucide-react";

type Mode = "login" | "register" | "forgot" | "password";
export function AuthForm({
  ready,
  reset = false,
}: {
  ready: boolean;
  reset?: boolean;
}) {
  const [mode, setMode] = useState<Mode>(reset ? "password" : "login");
  const [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  function change(next: Mode) {
    setMode(next);
    setError("");
    setMessage("");
  }
  const headings = {
    login: ["欢迎回到工作台", "用邮箱登录，继续你的下一步探索。", "登录工作台"],
    register: [
      "建立你的研究空间",
      "用邮箱创建账户，研究资料只属于你。",
      "创建账户",
    ],
    forgot: [
      "找回你的密码",
      "我们会向你的邮箱发送密码重置链接。",
      "发送重置邮件",
    ],
    password: [
      "设置新密码",
      "使用至少 12 个字符，保护你的研究资料。",
      "保存新密码",
    ],
  };
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const data = new FormData(event.currentTarget);
    if (
      ["register", "password"].includes(mode) &&
      data.get("password") !== data.get("confirm")
    ) {
      setError("两次输入的密码不一致。");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.get("email"),
          password: data.get("password"),
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        redirect?: string;
        message?: string;
      };
      if (!response.ok) throw new Error(result.error || "操作未完成，请重试。");
      if (result.redirect) {
        location.assign(result.redirect);
        return;
      }
      setMessage(result.message || "操作已完成。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络连接失败，请重试。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-form">
      <div className="auth-eyebrow">YOUR RESEARCH, CONNECTED</div>
      <h1>{headings[mode][0]}</h1>
      <p className="auth-description">{headings[mode][1]}</p>
      {!ready && (
        <div className="auth-notice" role="status">
          邮箱登录服务尚未连接。配置完成后，即可使用此入口。
        </div>
      )}
      <form onSubmit={submit} key={mode}>
        {mode !== "password" && (
          <label>
            邮箱地址
            <div className="auth-input">
              <Mail size={17} />
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                maxLength={254}
                disabled={!ready || busy}
              />
            </div>
          </label>
        )}
        {mode !== "forgot" && (
          <label>
            {mode === "password" ? "新密码" : "密码"}
            <div className="auth-input">
              <LockKeyhole size={17} />
              <input
                name="password"
                type={show ? "text" : "password"}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                placeholder={
                  mode === "login" ? "输入你的密码" : "至少 12 个字符"
                }
                required
                minLength={mode === "login" ? 1 : 12}
                maxLength={128}
                disabled={!ready || busy}
              />
              <button
                type="button"
                aria-label={show ? "隐藏密码" : "显示密码"}
                onClick={() => setShow(!show)}
              >
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </label>
        )}
        {["register", "password"].includes(mode) && (
          <label>
            再次输入密码
            <div className="auth-input">
              <LockKeyhole size={17} />
              <input
                name="confirm"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                placeholder="再次输入密码"
                required
                minLength={12}
                maxLength={128}
                disabled={!ready || busy}
              />
            </div>
          </label>
        )}
        {mode === "login" && (
          <div className="auth-forgot">
            <button type="button" onClick={() => change("forgot")}>
              忘记密码？
            </button>
          </div>
        )}
        {error && (
          <div className="auth-error" role="alert">
            {error}
          </div>
        )}
        {message && (
          <div className="auth-success" role="status">
            {message}
          </div>
        )}
        <button
          className="button primary auth-submit"
          disabled={!ready || busy}
        >
          {busy ? (
            <LoaderCircle className="auth-spinner" size={17} />
          ) : (
            <ArrowRight size={17} />
          )}{" "}
          {busy ? "请稍候…" : headings[mode][2]}
        </button>
      </form>
      {mode === "login" ? (
        <p className="auth-switch">
          第一次使用？
          <button onClick={() => change("register")}>创建邮箱账户</button>
        </p>
      ) : (
        <p className="auth-switch">
          <button
            onClick={() =>
              reset ? location.assign("/login") : change("login")
            }
          >
            返回邮箱登录
          </button>
        </p>
      )}
      <p className="auth-privacy">
        仅向站点允许的邮箱开放。注册后请完成邮箱验证。
      </p>
    </div>
  );
}

export function EmailSignOut() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <button
        className="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const response = await fetch("/api/auth/logout", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: "{}",
            });
            if (!response.ok) throw new Error("退出未完成，请重试。");
            location.assign("/login");
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        {busy ? "正在退出…" : "退出登录"}
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
