import { env } from "cloudflare:workers";
import { getResearchUser } from "./auth";
import { kinds, recordInput, type Kind, type ResearchRecord } from "./domain";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function db() {
  if (!env.DB) throw new HttpError(503, "数据库尚未连接");
  return env.DB;
}
export function bucket() {
  if (!env.BUCKET) throw new HttpError(503, "文件存储尚未连接");
  return env.BUCKET;
}
export async function identity(request?: Request) {
  if (request && !["GET", "HEAD"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      throw new HttpError(403, "请求来源不被允许");
  }
  const u = await getResearchUser();
  if (!u) throw new HttpError(401, "请先登录");
  if (
    request?.headers.get("X-Research-Owner") &&
    request.headers.get("X-Research-Owner") !== u.userId
  )
    throw new HttpError(409, "登录账户已发生变化，请刷新页面后继续。");
  return u;
}
export async function ensureUser(id: string) {
  await db()
    .prepare("INSERT OR IGNORE INTO users (id,created_at) VALUES (?,?)")
    .bind(id, new Date().toISOString())
    .run();
}
export function kindOf(s: string): Kind {
  if (!kinds.includes(s as Kind)) throw new HttpError(404, "记录类型不存在");
  return s as Kind;
}
export function decode(value: unknown): ResearchRecord {
  const row = value as Record<string, unknown>;
  return { ...row, data: JSON.parse(String(row.data)) } as ResearchRecord;
}
export async function find(kind: Kind, id: string, owner: string) {
  const r = await db()
    .prepare(`SELECT * FROM ${kind} WHERE id=? AND owner_id=?`)
    .bind(id, owner)
    .first();
  if (!r) throw new HttpError(404, "记录不存在或无权访问");
  return decode(r);
}
export async function validateRelations(
  kind: Kind,
  input: ReturnType<typeof recordInput.parse>,
  owner: string,
  id?: string,
) {
  if (
    kind === "projects" &&
    (input.project_id || input.milestone_id || input.task_id || input.parent_id)
  )
    throw new HttpError(400, "项目不能拥有上级关联");
  if (
    kind === "milestones" &&
    (input.milestone_id || input.task_id || input.parent_id)
  )
    throw new HttpError(400, "阶段目标仅允许关联项目");
  if (kind !== "tasks" && input.parent_id)
    throw new HttpError(400, "仅研究任务支持子任务");
  if (id) {
    const old = await find(kind, id, owner);
    if (old.project_id !== input.project_id) {
      for (const k of kinds) {
        if (
          await db()
            .prepare(
              `SELECT id FROM ${k} WHERE owner_id=? AND (milestone_id=? OR task_id=? OR parent_id=?) LIMIT 1`,
            )
            .bind(owner, id, id, id)
            .first()
        )
          throw new HttpError(
            409,
            "该记录仍有下级关联，不能直接更换项目。请先解除关联。",
          );
      }
    }
    if (
      input.parent_id &&
      (await db()
        .prepare(
          "SELECT id FROM tasks WHERE parent_id=? AND owner_id=? LIMIT 1",
        )
        .bind(id, owner)
        .first())
    )
      throw new HttpError(400, "已有子任务的任务不能再成为子任务");
  }
  for (const [field, target] of [
    ["project_id", "projects"],
    ["milestone_id", "milestones"],
    ["task_id", "tasks"],
    ["parent_id", "tasks"],
  ] as const) {
    const value = input[field];
    if (value) {
      if (value === id) throw new HttpError(400, "记录不能关联自身");
      const related = await find(target, value, owner);
      if (
        input.project_id &&
        related.project_id &&
        related.project_id !== input.project_id
      )
        throw new HttpError(400, "关联记录必须属于同一项目");
      if (field === "parent_id" && related.parent_id)
        throw new HttpError(400, "子任务最多一层");
      if (field === "milestone_id" && related.project_id !== input.project_id)
        throw new HttpError(400, "阶段目标与项目不匹配");
    }
  }
  if (["milestones", "tasks"].includes(kind) && !input.project_id)
    throw new HttpError(400, "阶段目标和任务必须关联项目");
  for (const target of ["taskIds", "experimentIds"] as const) {
    const values = input.data[target];
    if (values && !Array.isArray(values))
      throw new HttpError(400, "关联列表格式错误");
    for (const v of Array.isArray(values) ? values : []) {
      const r = await find(
        target === "taskIds" ? "tasks" : "experiments",
        String(v),
        owner,
      );
      if (r.project_id !== input.project_id)
        throw new HttpError(400, "成果关联记录必须属于同一项目");
    }
  }
  for (const match of String(input.data.body || "").matchAll(
    /\/api\/files\/([a-zA-Z0-9-]+)/g,
  )) {
    if (
      !(await db()
        .prepare("SELECT id FROM attachments WHERE id=? AND owner_id=?")
        .bind(match[1], owner)
        .first())
    )
      throw new HttpError(400, "正文包含无权访问的附件");
  }
}
export function errorResponse(e: unknown) {
  if (e instanceof HttpError)
    return Response.json({ error: e.message }, { status: e.status });
  if (e && typeof e === "object" && "issues" in e)
    return Response.json(
      {
        error: (e as { issues: { message: string }[] }).issues
          .map((i) => i.message)
          .join("；"),
      },
      { status: 400 },
    );
  console.error(
    "Research OS request failed",
    e instanceof Error ? e.message : "unknown",
  );
  return Response.json(
    { error: "操作失败，请重试；数据未确认为保存成功。" },
    { status: 500 },
  );
}
export async function jsonBody(req: Request, max = 1000000) {
  const text = await req.text();
  if (text.length > max) throw new HttpError(413, "请求内容过大");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "无效 JSON 内容");
  }
}
