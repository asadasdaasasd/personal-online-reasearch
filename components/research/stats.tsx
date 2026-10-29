"use client";
import { useState } from "react";
import { Plus, NotebookPen, ChevronRight } from "lucide-react";
import {
  type Store,
  type Kind,
  type ResearchRecord,
  dateToday,
  statistics,
  progress,
} from "@/lib/domain";
import { PanelTitle, Progress, Heatmap } from "./views";
export function Stats({
  store,
  open,
  openLog,
}: {
  store: Store;
  open: (k: Kind, r?: ResearchRecord) => void;
  openLog: (d: string) => void;
}) {
  const [from, setFrom] = useState(dateToday().slice(0, 7) + "-01"),
    [to, setTo] = useState(dateToday()),
    [group, setGroup] = useState("day");
  const logs = store.logs.filter(
      (l) => l.status !== "draft" && l.date >= from && l.date <= to,
    ),
    s = statistics(store),
    tot = logs.reduce((a, l) => a + Number(l.data.hours || 0), 0);
  const bins: Record<string, number> = {};
  for (const l of logs) {
    let key = l.date;
    if (group === "month") key = key.slice(0, 7);
    if (group === "week") {
      const d = new Date(key + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      key = d.toISOString().slice(0, 10);
    }
    bins[key] = (bins[key] || 0) + Number(l.data.hours || 0);
  }
  const max = Math.max(1, ...Object.values(bins));
  return (
    <>
      <div className="list-toolbar">
        <div className="row wrap">
          <input
            type="date"
            aria-label="统计开始日期"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <span>至</span>
          <input
            type="date"
            aria-label="统计结束日期"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <select
            aria-label="时间分组"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
          >
            <option value="day">按日</option>
            <option value="week">按周</option>
            <option value="month">按月</option>
          </select>
        </div>
        <button className="button primary" onClick={() => open("reviews")}>
          <Plus size={16} />
          周度科研复盘
        </button>
      </div>
      <div className="stats-grid">
        {[
          ["区间科研时长", tot.toFixed(1) + " h"],
          ["任务完成率", progress(store.tasks) + "%"],
          ["逾期任务", s.overdue],
          [
            "实验 / 成果",
            `${store.experiments.length} / ${store.achievements.length}`,
          ],
        ].map(([label, v]) => (
          <div className="stat-card" key={label}>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{v}</div>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <PanelTitle title="科研时间趋势" subtitle="RESEARCH HOURS" />
          <div className="bar-chart">
            {Object.entries(bins)
              .sort()
              .map(([date, h]) => (
                <button
                  key={date}
                  title={`${date}：${h.toFixed(2)} 小时`}
                  onClick={() => openLog(date)}
                >
                  <strong>{h.toFixed(1)}</strong>
                  <i style={{ height: Math.max(3, (h / max) * 150) }} />
                  <small>{date.slice(5)}</small>
                </button>
              ))}
            {!logs.length && (
              <p className="muted">该时间范围暂无已提交的科研时长记录。</p>
            )}
          </div>
        </section>
        <section className="panel chart-panel">
          <PanelTitle title="项目时间分布" />
          {[
            ...store.projects.map((p) => ({ id: p.id, title: p.title })),
            { id: null, title: "未关联项目" },
          ].map((p) => {
            const h = logs
              .filter((l) => l.project_id === p.id)
              .reduce((a, l) => a + Number(l.data.hours || 0), 0);
            return h > 0 ? (
              <div className="distribution" key={p.id || "none"}>
                <div className="row">
                  <span>{p.title}</span>
                  <strong>{h.toFixed(1)} h</strong>
                </div>
                <Progress value={Math.round((h / Math.max(tot, 1)) * 100)} />
              </div>
            ) : null;
          })}
          {!tot && <p className="muted">记录时长后将显示项目分布。</p>}
        </section>
      </div>
      <section className="panel heatmap-panel">
        <PanelTitle title="科研活跃度" />
        <Heatmap logs={store.logs} onDate={openLog} />
      </section>
      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <PanelTitle title="成果分布" />
          {store.projects.map((p) => (
            <div className="file-row" key={p.id}>
              <span>{p.title}</span>
              <strong>
                {store.achievements.filter((a) => a.project_id === p.id).length}{" "}
                项
              </strong>
            </div>
          ))}
          {Object.entries(
            store.achievements.reduce<Record<string, number>>((a, r) => {
              const k = String(r.data.type || "其他");
              a[k] = (a[k] || 0) + 1;
              return a;
            }, {}),
          ).map(([k, v]) => (
            <div className="file-row" key={k}>
              <span>{k}</span>
              <span>{v} 项</span>
            </div>
          ))}
          <h3>每月新增成果</h3>
          {Object.entries(
            store.achievements.reduce<Record<string, number>>((a, r) => {
              const k = r.created_at.slice(0, 7);
              a[k] = (a[k] || 0) + 1;
              return a;
            }, {}),
          )
            .sort()
            .map(([k, v]) => (
              <div className="file-row" key={k}>
                <span>{k}</span>
                <strong>{v} 项</strong>
              </div>
            ))}
          {!store.achievements.length && (
            <p className="muted">尚无成果记录。</p>
          )}
          <p className="hint">
            任务总计 {s.total} · 已完成 {s.done} · 进行中 {s.active} · 逾期{" "}
            {s.overdue}
          </p>
        </section>
        <section className="panel chart-panel">
          <PanelTitle
            title="周度复盘"
            action="新建复盘"
            onAction={() => open("reviews")}
          />
          {store.reviews.map((r) => (
            <button
              className="review-row"
              key={r.id}
              onClick={() => open("reviews", r)}
            >
              <NotebookPen size={17} />
              {r.title}
              <ChevronRight size={15} />
            </button>
          ))}
          {!store.reviews.length && (
            <p className="muted">给研究留一点回顾的时间。</p>
          )}
        </section>
      </div>
    </>
  );
}
