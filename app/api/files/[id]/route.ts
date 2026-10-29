export const dynamic = "force-dynamic";
import { queueDeletion, collectGarbage } from "@/lib/file-gc";
import { identity, db, bucket, errorResponse, HttpError } from "@/lib/server";
import { kinds } from "@/lib/domain";
type Ctx = { params: Promise<{ id: string }> };
export async function GET(_: Request, c: Ctx) {
  try {
    const u = await identity(),
      { id } = await c.params,
      f = await db()
        .prepare("SELECT * FROM attachments WHERE id=? AND owner_id=?")
        .bind(id, u.userId)
        .first<{ object_key: string; mime: string; name: string }>();
    if (!f) throw new HttpError(404, "附件不存在");
    const obj = await bucket().get(f.object_key);
    if (!obj) throw new HttpError(404, "附件文件不可用");
    return new Response(obj.body, {
      headers: {
        "Content-Type": f.mime,
        "Content-Disposition": `${f.mime.startsWith("image/") ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(f.name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function DELETE(req: Request, c: Ctx) {
  try {
    const u = await identity(req),
      { id } = await c.params,
      f = await db()
        .prepare("SELECT object_key FROM attachments WHERE id=? AND owner_id=?")
        .bind(id, u.userId)
        .first<{ object_key: string }>();
    if (!f) throw new HttpError(404, "附件不存在");
    for (const k of kinds) {
      if (
        await db()
          .prepare(
            `SELECT id FROM ${k} WHERE owner_id=? AND instr(data,?)>0 LIMIT 1`,
          )
          .bind(u.userId, `/api/files/${id}`)
          .first()
      )
        throw new HttpError(
          409,
          "正文仍在引用这张图片，请先移除图片引用并保存。",
        );
    }
    if (
      await db()
        .prepare(
          "SELECT id FROM revisions WHERE owner_id=? AND instr(snapshot,?)>0 LIMIT 1",
        )
        .bind(u.userId, `/api/files/${id}`)
        .first()
    )
      throw new HttpError(
        409,
        "历史修订仍在引用此图片，已保留文件以确保版本可恢复。",
      );
    await db().batch([
      queueDeletion(f.object_key, u.userId),
      db()
        .prepare("DELETE FROM attachments WHERE id=? AND owner_id=?")
        .bind(id, u.userId),
    ]);
    await collectGarbage(u.userId);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
