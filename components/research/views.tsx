"use client";
import { useState } from "react";
import {
  Plus,
  FolderOpen,
  Check,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  type ResearchRecord,
  type Store,
  dateToday,
  progress,
  statuses,
} from "@/lib/domain";
export function PanelTitle({
  title,
  subtitle,
  action,
  onAction,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="panel-title">
      <div>
        <h2>{title}</h2>
        {subtitle && <small>{subtitle}</small>}
      </div>
      {action && (
        <button className="text-button" onClick={onAction}>
          {action}
          <ArrowUpRight size={13} />
        </button>
      )}
    </div>
  );
}
export function Empty({
  title,
  text,
  action,
  onClick,
}: {
  title: string;
  text: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <FolderOpen size={25} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      <button className="button" onClick={onClick}>
        <Plus size={15} />
        {action}
      </button>
    </div>
  );
}
export function TaskRow({
  r,
  project,
  onOpen,
  toggle,
}: {
  r: ResearchRecord;
  project?: string;
  onOpen: () => void;
  toggle: () => void;
}) {
  return (
    <div className={`task-row ${r.status === "done" ? "completed" : ""}`}>
      <button
        className={`task-check ${r.status === "done" ? "checked" : ""}`}
        aria-label={
          r.status === "done" ? `重新打开 ${r.title}` : `完成 ${r.title}`
        }
        onClick={toggle}
      >
        {r.status === "done" && <Check size={12} />}
      </button>
      <button className="task-main" onClick={onOpen}>
        <span>
          {r.parent_id && "↳ "}
          {r.title}
        </span>
        <small>
          {project || "研究任务"}
          {r.data.dueDate ? ` · ${r.data.dueDate}` : ""}
        </small>
      </button>
      <span className={`priority priority-${r.data.priority || "中"}`}>
        {String(r.data.priority || "中")}
      </span>
      <span className={`status-dot ${r.status}`} title={statuses[r.status]} />
    </div>
  );
}
export function Progress({ value }: { value: number }) {
  return (
    <div className="progress-wrap">
      <div className="progress">
        <span style={{ width: `${value}%` }} />
      </div>
      <span>{value}%</span>
    </div>
  );
}
export function ProjectCard({
  p,
  store,
  onClick,
}: {
  p: ResearchRecord;
  store: Store;
  onClick: () => void;
}) {
  const tasks = store.tasks.filter((t) => t.project_id === p.id),
    milestone = store.milestones.find(
      (m) => m.project_id === p.id && m.status === "active",
    );
  return (
    <button className="project-card" onClick={onClick}>
      <div className="row">
        <span className="project-icon">
          <FolderOpen size={18} />
        </span>
        <strong>{p.title}</strong>
        <span className={`badge ${p.status}`}>{statuses[p.status]}</span>
        <ArrowUpRight size={15} />
      </div>
      <p>{String(p.data.description || "为研究建立清晰的方向与连接。")}</p>
      <div className="project-meta">
        <span>{milestone?.title || "尚未设置进行中的阶段"}</span>
        <span>
          {tasks.filter((t) => t.status === "done").length}/{tasks.length}{" "}
          项任务
        </span>
      </div>
      <Progress value={progress(tasks)} />
      <div className="project-updated">
        更新于 {new Date(p.updated_at).toLocaleDateString("zh-CN")}
      </div>
    </button>
  );
}
export function Heatmap({
  logs,
  onDate,
}: {
  logs: ResearchRecord[];
  onDate: (d: string) => void;
}) {
  const dates = Array.from({ length: 364 }, (_, i) => {
      const d = new Date(dateToday() + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() - 363 + i);
      return d.toISOString().slice(0, 10);
    }),
    hours = (d: string) =>
      logs
        .filter((l) => l.date === d && l.status !== "draft")
        .reduce((a, l) => a + Number(l.data.hours || 0), 0);
  return (
    <>
      <div className="heatmap-scroll">
        <div className="heatmap">
          {dates.map((d) => {
            const h = hours(d),
              recorded = logs.some((l) => l.date === d && l.status !== "draft");
            return (
              <button
                key={d}
                className={`heat-cell level-${!recorded ? 0 : h < 1 ? 1 : h < 3 ? 2 : h < 6 ? 3 : 4}`}
                title={`${d} · ${h.toFixed(1)} 小时`}
                aria-label={`${d} 科研记录 ${h.toFixed(1)} 小时`}
                onClick={() => onDate(d)}
              />
            );
          })}
        </div>
      </div>
      <div className="heatmap-legend">
        <span>
          过去一年 ·{" "}
          {
            new Set(logs.filter((l) => l.status !== "draft").map((l) => l.date))
              .size
          }{" "}
          个记录日
        </span>
        <span>
          少{" "}
          {[0, 1, 2, 3, 4].map((n) => (
            <i key={n} className={`heat-cell level-${n}`} />
          ))}{" "}
          多
        </span>
      </div>
    </>
  );
}
export function Calendar({
  logs,
  onDate,
}: {
  logs: ResearchRecord[];
  onDate: (d: string) => void;
}) {
  const [month, setMonth] = useState(dateToday().slice(0, 7));
  const first = new Date(month + "-01T00:00:00Z"),
    offset = (first.getUTCDay() + 6) % 7,
    count = new Date(
      Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
    ).getUTCDate();
  function shift(n: number) {
    const d = new Date(first);
    d.setUTCMonth(d.getUTCMonth() + n);
    setMonth(d.toISOString().slice(0, 7));
  }
  return (
    <section className="panel calendar-panel">
      <div className="panel-title">
        <h2>{month.replace("-", " 年 ")} 月</h2>
        <div className="row">
          <button
            className="icon-button"
            aria-label="上个月"
            onClick={() => shift(-1)}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="button"
            onClick={() => setMonth(dateToday().slice(0, 7))}
          >
            本月
          </button>
          <button
            className="icon-button"
            aria-label="下个月"
            onClick={() => shift(1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="calendar">
        {["一", "二", "三", "四", "五", "六", "日"].map((d) => (
          <div className="calendar-day" key={d}>
            {d}
          </div>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <div key={"blank" + i} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const d = `${month}-${String(i + 1).padStart(2, "0")}`,
            rs = logs.filter((l) => l.date === d);
          return (
            <button
              className={d === dateToday() ? "calendar-today" : ""}
              key={d}
              onClick={() => onDate(d)}
            >
              <span>{i + 1}</span>
              {rs.length > 0 && (
                <>
                  <i />
                  <small>
                    {rs
                      .reduce((a, l) => a + Number(l.data.hours || 0), 0)
                      .toFixed(1)}{" "}
                    h
                  </small>
                </>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
