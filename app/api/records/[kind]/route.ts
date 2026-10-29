export const dynamic = "force-dynamic";
import {
  identity,
  db,
  ensureUser,
  kindOf,
  find,
  validateRelations,
  errorResponse,
  jsonBody,
} from "@/lib/server";
import { recordInput } from "@/lib/domain";
export async function POST(
  req: Request,
  ctx: { params: Promise<{ kind: string }> },
) {
  try {
    const u = await identity(req),
      k = kindOf((await ctx.params).kind),
      input = recordInput.parse(await jsonBody(req));
    await ensureUser(u.userId);
    await validateRelations(k, input, u.userId);
    const id = crypto.randomUUID(),
      now = new Date().toISOString();
    await db()
      .prepare(
        `INSERT INTO ${k} (id,owner_id,title,status,date,project_id,milestone_id,task_id,parent_id,data,created_at,updated_at,completed_at,version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
      )
      .bind(
        id,
        u.userId,
        input.title,
        input.status,
        input.date,
        input.project_id,
        input.milestone_id,
        input.task_id,
        input.parent_id,
        JSON.stringify(input.data),
        now,
        now,
        input.status === "done" ? now : null,
      )
      .run();
    return Response.json(await find(k, id, u.userId), { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
