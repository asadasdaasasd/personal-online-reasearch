import { z } from "zod";
import { recordInput, kinds } from "./domain";
const id = z.string().regex(/^[a-zA-Z0-9-]{1,80}$/);
const timestamp = z.string().datetime();
const stored = z
  .object({
    id,
    owner_id: z.string(),
    title: z.string(),
    status: z.string(),
    date: z.string(),
    project_id: id.nullable(),
    milestone_id: id.nullable(),
    task_id: id.nullable(),
    parent_id: id.nullable(),
    data: z.record(z.union([z.string(), z.number(), z.array(z.string())])),
    created_at: timestamp,
    updated_at: timestamp,
    completed_at: timestamp.nullable(),
    version: z.number().int().positive(),
  })
  .superRefine((r, ctx) => {
    const {
      title,
      status,
      date,
      project_id,
      milestone_id,
      task_id,
      parent_id,
      data,
      version,
    } = r;
    const parsed = recordInput.safeParse({
      title,
      status,
      date,
      project_id,
      milestone_id,
      task_id,
      parent_id,
      data,
      version,
    });
    if (!parsed.success)
      for (const issue of parsed.error.issues)
        ctx.addIssue({ ...issue, path: issue.path });
  });
const mime = z.enum([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
  "application/json",
  "text/markdown",
]);
export const backupSchema = z.object({
  format: z.literal("research-os"),
  version: z.literal(1),
  exportedAt: timestamp.optional(),
  records: z.object({
    projects: z.array(stored),
    milestones: z.array(stored),
    tasks: z.array(stored),
    logs: z.array(stored),
    experiments: z.array(stored),
    achievements: z.array(stored),
    reviews: z.array(stored),
  }),
  attachments: z
    .array(
      z.object({
        id,
        owner_id: z.string(),
        record_id: id,
        kind: z.enum(kinds),
        name: z
          .string()
          .min(1)
          .max(200)
          .refine((n) => !/[\r\n\\/]/.test(n), "附件名含非法字符"),
        mime,
        size: z
          .number()
          .int()
          .positive()
          .max(10 * 1024 * 1024),
        object_key: z.string(),
        created_at: timestamp,
      }),
    )
    .max(1000),
  revisions: z
    .array(
      z.object({
        id,
        owner_id: z.string(),
        achievement_id: id,
        snapshot: z
          .string()
          .max(1000000)
          .refine((s) => {
            try {
              return stored.safeParse(JSON.parse(s)).success;
            } catch {
              return false;
            }
          }, "历史修订格式无效"),
        created_at: timestamp,
      }),
    )
    .max(10000),
  sessions: z
    .array(
      z.object({
        id,
        owner_id: z.string(),
        log_id: id,
        started_at: timestamp,
        heartbeat_at: timestamp,
        seconds: z.number().int().min(0).max(86400000),
        status: z.enum(["running", "paused", "ended"]),
      }),
    )
    .max(10000),
  settings: z.string().optional(),
});
export type ResearchBackup = z.infer<typeof backupSchema>;
