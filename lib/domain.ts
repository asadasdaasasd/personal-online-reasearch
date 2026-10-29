import { z } from "zod";
export const kinds = [
  "projects",
  "milestones",
  "tasks",
  "logs",
  "experiments",
  "achievements",
  "reviews",
] as const;
export type Kind = (typeof kinds)[number];
export type RecordData = Record<string, string | number | string[]>;
export interface ResearchRecord {
  id: string;
  owner_id: string;
  title: string;
  status: string;
  date: string;
  project_id: string | null;
  milestone_id: string | null;
  task_id: string | null;
  parent_id: string | null;
  data: RecordData;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  version: number;
}
export type Store = Record<Kind, ResearchRecord[]>;
export const emptyStore = (): Store =>
  Object.fromEntries(kinds.map((k) => [k, []])) as unknown as Store;
export const dateToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const recordInput = z
  .object({
    title: z.string().trim().min(1, "请填写标题").max(240),
    status: z
      .enum(["planned", "active", "done", "paused", "draft", "archived"])
      .default("planned"),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((s) => {
        const d = new Date(s + "T00:00:00Z");
        return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
      }, "无效日期"),
    project_id: z.string().max(80).nullable().default(null),
    milestone_id: z.string().max(80).nullable().default(null),
    task_id: z.string().max(80).nullable().default(null),
    parent_id: z.string().max(80).nullable().default(null),
    data: z
      .record(
        z.union([
          z.string().max(300000),
          z.number().finite(),
          z.array(z.string().max(1000)).max(100),
        ]),
      )
      .default({}),
    version: z.number().int().nonnegative().optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      v.data.hours !== undefined &&
      (typeof v.data.hours !== "number" ||
        v.data.hours < 0 ||
        v.data.hours > 24)
    )
      ctx.addIssue({
        code: "custom",
        message: "科研时长必须为 0–24 小时",
        path: ["data", "hours"],
      });
    for (const key of ["parameters", "metrics"])
      if (v.data[key]) {
        try {
          const o = JSON.parse(String(v.data[key]));
          if (!o || Array.isArray(o) || typeof o !== "object") throw Error();
        } catch {
          ctx.addIssue({
            code: "custom",
            message: "参数和指标须为 JSON 对象",
            path: ["data", key],
          });
        }
      }
  });
export const labels: Record<Kind, string> = {
  projects: "研究项目",
  milestones: "阶段目标",
  tasks: "研究任务",
  logs: "科研日志",
  experiments: "实验记录",
  achievements: "研究成果",
  reviews: "周度复盘",
};
export const statuses: Record<string, string> = {
  planned: "待开始",
  active: "进行中",
  done: "已完成",
  paused: "已暂停",
  draft: "草稿",
  archived: "已归档",
};
export function progress(tasks: ResearchRecord[]) {
  return tasks.length
    ? Math.round(
        (tasks.filter((t) => t.status === "done").length / tasks.length) * 100,
      )
    : 0;
}
export function weekStart(date: string) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export function statistics(s: Store, today = dateToday()) {
  const start = weekStart(today),
    logs = s.logs.filter((l) => l.status !== "draft");
  const sum = (xs: ResearchRecord[]) =>
    xs.reduce((a, l) => a + Number(l.data.hours || 0), 0);
  let streak = 0;
  const dates = new Set(logs.map((l) => l.date));
  const d = new Date(today + "T00:00:00Z");
  if (!dates.has(today)) d.setUTCDate(d.getUTCDate() - 1);
  while (dates.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  const current = s.milestones.filter((m) => m.status === "active"),
    targetTasks = s.tasks.filter((t) =>
      current.some((m) => m.id === t.milestone_id),
    );
  return {
    todayHours: sum(logs.filter((l) => l.date === today)),
    weekHours: sum(logs.filter((l) => l.date >= start && l.date <= today)),
    active: s.tasks.filter((t) => t.status === "active").length,
    weekDone: s.tasks.filter(
      (t) =>
        t.status === "done" &&
        t.completed_at &&
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Shanghai",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(t.completed_at)) >= start,
    ).length,
    stageProgress: progress(targetTasks),
    streak,
    total: s.tasks.length,
    done: s.tasks.filter((t) => t.status === "done").length,
    overdue: s.tasks.filter(
      (t) =>
        t.status !== "done" && t.data.dueDate && String(t.data.dueDate) < today,
    ).length,
  };
}
