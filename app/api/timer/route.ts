export const dynamic = "force-dynamic";
import {
  identity,
  db,
  ensureUser,
  find,
  errorResponse,
  jsonBody,
  HttpError,
} from "@/lib/server";
export async function GET() {
  try {
    const u = await identity();
    return Response.json(
      await db()
        .prepare(
          "SELECT * FROM sessions WHERE owner_id=? AND status!='ended' ORDER BY started_at DESC LIMIT 1",
        )
        .bind(u.userId)
        .first(),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(req: Request) {
  try {
    const u = await identity(req),
      body = await jsonBody(req),
      now = new Date().toISOString();
    await ensureUser(u.userId);
    if (body.action === "start") {
      await find("logs", String(body.log_id), u.userId);
      const id = crypto.randomUUID();
      await db()
        .prepare(
          "INSERT INTO sessions (id,owner_id,log_id,started_at,heartbeat_at,seconds,status) SELECT ?,?,?,?,?,0,'running' WHERE NOT EXISTS (SELECT id FROM sessions WHERE owner_id=? AND status!='ended')",
        )
        .bind(id, u.userId, body.log_id, now, now, u.userId)
        .run();
    } else {
      const s = await db()
        .prepare(
          "SELECT * FROM sessions WHERE owner_id=? AND status!='ended' LIMIT 1",
        )
        .bind(u.userId)
        .first<{
          id: string;
          log_id: string;
          status: string;
          heartbeat_at: string;
          seconds: number;
        }>();
      if (!s) throw new HttpError(404, "没有进行中的计时");
      const seconds =
        s.seconds +
        (s.status === "running"
          ? Math.max(
              0,
              Math.min(
                40,
                Math.floor((Date.now() - Date.parse(s.heartbeat_at)) / 1000),
              ),
            )
          : 0);
      const status =
        body.action === "end"
          ? "ended"
          : body.action === "pause"
            ? "paused"
            : body.action === "resume"
              ? "running"
              : s.status;
      const statements = [
        db()
          .prepare(
            "UPDATE sessions SET seconds=?,status=?,heartbeat_at=? WHERE id=? AND owner_id=? AND heartbeat_at=? AND status=?",
          )
          .bind(seconds, status, now, s.id, u.userId, s.heartbeat_at, s.status),
      ];
      if (body.action === "end") {
        statements.push(
          db()
            .prepare(
              "UPDATE logs SET data=json_set(data,'$.hours',min(24,round(coalesce(CAST(json_extract(data,'$.hours') AS REAL),0)+?,4))),version=version+1,updated_at=? WHERE id=? AND owner_id=? AND changes()=1",
            )
            .bind(seconds / 3600, now, s.log_id, u.userId),
        );
      }
      const result = await db().batch(statements);
      if (!result[0].meta.changes)
        throw new HttpError(409, "计时已在另一窗口更新，请重试");
    }
    return GET();
  } catch (e) {
    return errorResponse(e);
  }
}
