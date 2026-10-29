export const dynamic = "force-dynamic";
import { identity, db, find, errorResponse } from "@/lib/server";
export async function GET(
  _: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const u = await identity(),
      { id } = await ctx.params;
    await find("achievements", id, u.userId);
    return Response.json(
      (
        await db()
          .prepare(
            "SELECT id,snapshot,created_at FROM revisions WHERE achievement_id=? AND owner_id=? ORDER BY created_at DESC",
          )
          .bind(id, u.userId)
          .all()
      ).results,
    );
  } catch (e) {
    return errorResponse(e);
  }
}
