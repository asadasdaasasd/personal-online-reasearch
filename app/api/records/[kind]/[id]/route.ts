export const dynamic = "force-dynamic";
import { queueDeletion, collectGarbage } from "@/lib/file-gc";
import {
  identity,
  db,
  kindOf,
  find,
  validateRelations,
  errorResponse,
  jsonBody,
  HttpError,
} from "@/lib/server";
import { recordInput, kinds } from "@/lib/domain";
type Context = { params: Promise<{ kind: string; id: string }> };
export async function GET(req: Request, ctx: Context) {
  try {
    const u = await identity(),
      { kind, id } = await ctx.params;
    return Response.json(await find(kindOf(kind), id, u.userId));
  } catch (e) {
    return errorResponse(e);
  }
}
export async function PUT(req: Request, ctx: Context) {
  try {
    const u = await identity(req),
      { kind, id } = await ctx.params,
      k = kindOf(kind),
      old = await find(k, id, u.userId),
      input = recordInput.parse(await jsonBody(req));
    if (input.version !== old.version)
      throw new HttpError(
        409,
        "此记录已在其他窗口更新，请重新打开后编辑。你的草稿仍保留在本机。",
      );
    await validateRelations(k, input, u.userId, id);
    const now = new Date().toISOString(),
      statements = [];
    if (k === "achievements")
      statements.push(
        db()
          .prepare(
            "INSERT INTO revisions (id,owner_id,achievement_id,snapshot,created_at) SELECT ?,owner_id,id,?,? FROM achievements WHERE id=? AND owner_id=? AND version=?",
          )
          .bind(
            crypto.randomUUID(),
            JSON.stringify(old),
            now,
            id,
            u.userId,
            old.version,
          ),
      );
    statements.push(
      db()
        .prepare(
          `UPDATE ${k} SET title=?,status=?,date=?,project_id=?,milestone_id=?,task_id=?,parent_id=?,data=?,updated_at=?,completed_at=?,version=version+1 WHERE id=? AND owner_id=? AND version=?`,
        )
        .bind(
          input.title,
          input.status,
          input.date,
          input.project_id,
          input.milestone_id,
          input.task_id,
          input.parent_id,
          JSON.stringify(input.data),
          now,
          input.status === "done" ? old.completed_at || now : null,
          id,
          u.userId,
          old.version,
        ),
    );
    const result = await db().batch(statements);
    if (!result.at(-1)?.meta.changes)
      throw new HttpError(409, "记录发生并发更新，请重新打开。");
    return Response.json(await find(k, id, u.userId));
  } catch (e) {
    return errorResponse(e);
  }
}
export async function DELETE(req: Request, ctx: Context) {
  try {
    const u = await identity(req),
      { kind, id } = await ctx.params,
      k = kindOf(kind);
    await find(k, id, u.userId);
    for (const table of kinds) {
      if (
        await db()
          .prepare(
            `SELECT id FROM ${table} WHERE owner_id=? AND (project_id=? OR milestone_id=? OR task_id=? OR parent_id=?) LIMIT 1`,
          )
          .bind(u.userId, id, id, id, id)
          .first()
      )
        throw new HttpError(409, "此记录仍有关联内容，请先解除关联或归档。");
      const rows = await db()
        .prepare(`SELECT data FROM ${table} WHERE owner_id=?`)
        .bind(u.userId)
        .all<{ data: string }>();
      if (
        rows.results.some((r) => {
          const d = JSON.parse(r.data);
          return [...(d.taskIds || []), ...(d.experimentIds || [])].includes(
            id,
          );
        })
      )
        throw new HttpError(409, "有研究成果引用此记录，请先解除关联。");
    }
    const files = await db()
      .prepare(
        "SELECT id,object_key FROM attachments WHERE owner_id=? AND record_id=?",
      )
      .bind(u.userId, id)
      .all<{ id: string; object_key: string }>();
    for (const f of files.results) {
      for (const other of kinds) {
        if (
          await db()
            .prepare(
              `SELECT id FROM ${other} WHERE owner_id=? AND id!=? AND instr(data,?)>0 LIMIT 1`,
            )
            .bind(u.userId, id, `/api/files/${f.id}`)
            .first()
        )
          throw new HttpError(
            409,
            "其他记录仍在引用此记录的附件，请先解除图片引用。",
          );
      }
      if (
        await db()
          .prepare(
            "SELECT id FROM revisions WHERE owner_id=? AND achievement_id!=? AND instr(snapshot,?)>0 LIMIT 1",
          )
          .bind(u.userId, id, `/api/files/${f.id}`)
          .first()
      )
        throw new HttpError(409, "其他成果历史版本仍在引用此记录附件。");
    }
    await db().batch([
      ...files.results.map((f) => queueDeletion(f.object_key, u.userId)),
      db()
        .prepare("DELETE FROM attachments WHERE owner_id=? AND record_id=?")
        .bind(u.userId, id),
      db()
        .prepare(`DELETE FROM ${k} WHERE id=? AND owner_id=?`)
        .bind(id, u.userId),
    ]);
    await collectGarbage(u.userId);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
