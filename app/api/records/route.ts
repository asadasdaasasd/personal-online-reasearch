export const dynamic = "force-dynamic";
import { identity, db, decode, errorResponse } from "@/lib/server";
import { kinds } from "@/lib/domain";
export async function GET() {
  try {
    const u = await identity();
    const results = await db().batch(
      kinds.map((k) =>
        db()
          .prepare(
            `SELECT * FROM ${k} WHERE owner_id=? ORDER BY updated_at DESC`,
          )
          .bind(u.userId),
      ),
    );
    return Response.json(
      Object.fromEntries(
        kinds.map((k, i) => [k, results[i].results.map(decode)]),
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
