"use client";
import { useEffect, useState } from "react";
import { Clock, Pause, Play, Plus, Square } from "lucide-react";
import { type ResearchRecord } from "@/lib/domain";
import { api } from "./editor";
type Session = {
  id: string;
  log_id: string;
  status: string;
  seconds: number;
  heartbeat_at: string;
};
export function Timer({
  logs,
  onNew,
  onUpdate,
  notify,
}: {
  logs: ResearchRecord[];
  onNew: () => void;
  onUpdate: () => Promise<void>;
  notify: (s: string) => void;
}) {
  const [session, setSession] = useState<Session | null>(null),
    [log, setLog] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api<Session | null>("/api/timer")
      .then(setSession)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (session?.status !== "running") return;
    const t = setInterval(
      () =>
        void api<Session | null>("/api/timer", {
          method: "POST",
          body: JSON.stringify({ action: "heartbeat" }),
        })
          .then(setSession)
          .catch((e) => notify(e.message)),
      20000,
    );
    return () => clearInterval(t);
  }, [session?.id, session?.status]);
  async function action(action: string) {
    try {
      setBusy(true);
      setSession(
        await api("/api/timer", {
          method: "POST",
          body: JSON.stringify({ action, log_id: log }),
        }),
      );
      if (action === "end") {
        await onUpdate();
        notify("计时已合并到日志时长");
      }
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const seconds = session?.seconds || 0;
  return (
    <div className="timer-card">
      <div className="row">
        <span className="timer-label">
          <Clock size={14} />
          专注计时
        </span>
        <span className={session?.status === "running" ? "green-dot" : ""} />
      </div>
      <div className="timer-number">
        {String(Math.floor(seconds / 3600)).padStart(2, "0")}
        <span>:</span>
        {String(Math.floor(seconds / 60) % 60).padStart(2, "0")}
        <span>:</span>
        {String(seconds % 60).padStart(2, "0")}
      </div>
      {session ? (
        <>
          <small className="timer-record">
            {logs.find((l) => l.id === session.log_id)?.title || "科研日志"} ·{" "}
            {session.status === "running" ? "计时中" : "已暂停"}
          </small>
          <div className="row">
            <button
              className="button"
              disabled={busy}
              onClick={() =>
                action(session.status === "running" ? "pause" : "resume")
              }
            >
              {session.status === "running" ? (
                <Pause size={13} />
              ) : (
                <Play size={13} />
              )}{" "}
              {session.status === "running" ? "暂停" : "继续"}
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={() => action("end")}
            >
              <Square size={12} />
              结束
            </button>
          </div>
          <p className="hint">关闭页面后不累加，间隔超过 40 秒自动截断。</p>
        </>
      ) : (
        <>
          <select
            aria-label="选择计时关联日志"
            value={log}
            onChange={(e) => setLog(e.target.value)}
          >
            <option value="">选择科研日志</option>
            {logs.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
          {logs.length ? (
            <button
              className="timer-start"
              disabled={!log || busy}
              onClick={() => action("start")}
            >
              <Play size={13} />
              开始专注
            </button>
          ) : (
            <button className="timer-start" onClick={onNew}>
              <Plus size={13} />
              先创建今日日志
            </button>
          )}
        </>
      )}
    </div>
  );
}
