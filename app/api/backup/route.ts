export const dynamic = "force-dynamic";
import { backupSchema } from "@/lib/backup-format";
import JSZip from "jszip";
import {
  identity,
  db,
  bucket,
  decode,
  ensureUser,
  errorResponse,
  jsonBody,
  HttpError,
} from "@/lib/server";
import {
  kinds,
  recordInput,
  type ResearchRecord,
  type Store,
} from "@/lib/domain";
type Attachment = {
  id: string;
  owner_id: string;
  record_id: string;
  kind: string;
  name: string;
  mime: string;
  size: number;
  object_key: string;
  created_at: string;
};
export async function GET(req: Request) {
  try {
    const u = await identity(),
      results = await db().batch([
        ...kinds.map((k) =>
          db().prepare(`SELECT * FROM ${k} WHERE owner_id=?`).bind(u.userId),
        ),
        ...["attachments", "revisions", "sessions", "users"].map((k) =>
          db()
            .prepare(
              `SELECT * FROM ${k} WHERE ${k === "users" ? "id" : "owner_id"}=?`,
            )
            .bind(u.userId),
        ),
      ]);
    const backup = {
      format: "research-os",
      version: 1,
      exportedAt: new Date().toISOString(),
      records: Object.fromEntries(
        kinds.map((k, i) => [k, results[i].results.map(decode)]),
      ),
      attachments: results[7].results as unknown as Attachment[],
      revisions: results[8].results,
      sessions: results[9].results,
      settings:
        (results[10].results[0] as { settings: string } | undefined)
          ?.settings || "{}",
    };
    if (new URL(req.url).searchParams.get("format") !== "zip")
      return Response.json(backup, {
        headers: {
          "Content-Disposition":
            'attachment; filename="research-os-backup.json"',
          "Cache-Control": "no-store",
        },
      });
    if (backup.attachments.reduce((a, f) => a + f.size, 0) > 20 * 1024 * 1024)
      throw new HttpError(
        413,
        "附件总量超过单次 ZIP 20 MB 限制。请导出 JSON 并逐项下载附件；大批量备份请按维护文档使用 R2 管理工具。",
      );
    const zip = new JSZip();
    zip.file("backup.json", JSON.stringify(backup, null, 2));
    for (const f of backup.attachments) {
      const obj = await bucket().get(f.object_key);
      if (!obj) throw new HttpError(409, `附件缺失：${f.name}，备份已中止`);
      zip.file(`files/${f.id}`, await obj.arrayBuffer());
    }
    for (const k of ["logs", "achievements"] as const)
      for (const r of backup.records[k] as ResearchRecord[]) {
        let md = `# ${r.title}\n\n日期：${r.date}\n\n`;
        for (const [key, value] of Object.entries(r.data))
          md += `## ${key}\n\n${Array.isArray(value) ? value.join(", ") : value}\n\n`;
        for (const f of backup.attachments)
          md = md.replaceAll(`/api/files/${f.id}`, `../files/${f.id}`);
        zip.file(`${k}/${r.id}.md`, md);
      }
    const bytes = await zip.generateAsync({
      type: "uint8array",
      compression: "STORE",
    });
    return new Response(bytes as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition":
          'attachment; filename="research-os-complete-backup.zip"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(req: Request) {
  const uploaded: string[] = [];
  try {
    const u = await identity(req),
      payload = await jsonBody(req, 32 * 1024 * 1024),
      b = backupSchema.parse(payload.backup);
    if (payload.confirm !== "MERGE_ONLY")
      throw new HttpError(400, "请确认仅合并、不覆盖现有记录");
    if (
      b?.format !== "research-os" ||
      b.version !== 1 ||
      !b.records ||
      !Array.isArray(b.attachments) ||
      !Array.isArray(b.revisions) ||
      !Array.isArray(b.sessions)
    )
      throw new HttpError(400, "不支持的备份格式或版本");
    await ensureUser(u.userId);
    const seen = new Set<string>(),
      incoming = new Map<string, { kind: string; record: ResearchRecord }>();
    for (const k of kinds) {
      if (!Array.isArray(b.records[k]))
        throw new HttpError(400, "备份缺少记录集合");
      for (const r of b.records[k]) {
        if (
          typeof r.id !== "string" ||
          !/^[a-zA-Z0-9-]{1,80}$/.test(r.id) ||
          seen.has(r.id)
        )
          throw new HttpError(400, "记录 ID 无效或重复");
        seen.add(r.id);
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
        recordInput.parse({
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
        incoming.set(r.id, { kind: k, record: r });
      }
    }
    if (seen.size > 5000 || b.attachments.length > 1000)
      throw new HttpError(413, "单次恢复最多 5000 条记录和 1000 个附件");
    const existing = new Set<string>();
    for (const k of kinds) {
      for (const r of (
        await db()
          .prepare(`SELECT id,owner_id FROM ${k}`)
          .all<{ id: string; owner_id: string }>()
      ).results) {
        if (seen.has(r.id) && r.owner_id !== u.userId)
          throw new HttpError(409, "备份记录 ID 冲突");
        if (r.owner_id === u.userId) {
          if (incoming.has(r.id) && incoming.get(r.id)?.kind !== k)
            throw new HttpError(409, "备份记录类型冲突");
          existing.add(r.id);
        }
      }
    }
    for (const [id, { kind, record: r }] of incoming) {
      for (const [field, target] of [
        ["project_id", "projects"],
        ["milestone_id", "milestones"],
        ["task_id", "tasks"],
        ["parent_id", "tasks"],
      ] as const) {
        const ref = r[field];
        if (ref) {
          const related = incoming.get(ref);
          if (ref === id || !related || related.kind !== target)
            throw new HttpError(400, "备份包含无效关系");
          if (
            related.record.project_id &&
            related.record.project_id !== r.project_id
          )
            throw new HttpError(400, "备份关系跨项目");
        }
      }
      for (const field of ["taskIds", "experimentIds"])
        for (const ref of (r.data[field] as string[]) || []) {
          if (
            incoming.get(ref)?.kind !==
            (field === "taskIds" ? "tasks" : "experiments")
          )
            throw new HttpError(400, "成果关联不完整");
        }
      if (["tasks", "milestones"].includes(kind) && !r.project_id)
        throw new HttpError(400, "项目关联缺失");
    }
    const files = b.attachments as Attachment[],
      fileIds = new Set<string>();
    let total = 0;
    const filesToInsert: Attachment[] = [];
    for (const f of files) {
      if (
        !/^[a-zA-Z0-9-]{1,80}$/.test(f.id) ||
        fileIds.has(f.id) ||
        incoming.get(f.record_id)?.kind !== f.kind
      )
        throw new HttpError(400, "附件关联无效");
      fileIds.add(f.id);
      const old = await db()
        .prepare("SELECT owner_id FROM attachments WHERE id=?")
        .bind(f.id)
        .first<{ owner_id: string }>();
      if (old) {
        if (old.owner_id !== u.userId) throw new HttpError(409, "附件 ID 冲突");
        continue;
      }
      const value = payload.files?.[f.id];
      if (typeof value !== "string")
        throw new HttpError(
          400,
          "JSON 不包含附件内容，请选择完整 ZIP 进行恢复",
        );
      const raw = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
      total += raw.length;
      if (
        raw.length !== f.size ||
        raw.length > 10 * 1024 * 1024 ||
        total > 20 * 1024 * 1024
      )
        throw new HttpError(413, "附件大小校验失败或超出恢复上限");
      const key = `${u.userId}/${f.id}`;
      await bucket().put(key, raw, { httpMetadata: { contentType: f.mime } });
      uploaded.push(key);
      filesToInsert.push({ ...f, object_key: key });
    }
    for (const { record: r } of incoming.values())
      for (const m of String(r.data.body || "").matchAll(
        /\/api\/files\/([a-zA-Z0-9-]+)/g,
      ))
        if (!fileIds.has(m[1])) throw new HttpError(400, "正文图片引用不完整");
    const statements: D1PreparedStatement[] = [];
    const ordered = [...incoming.entries()].sort(
      (a, b) =>
        kinds.indexOf(a[1].kind as (typeof kinds)[number]) -
          kinds.indexOf(b[1].kind as (typeof kinds)[number]) ||
        Number(!!a[1].record.parent_id) - Number(!!b[1].record.parent_id),
    );
    for (const [id, { kind, record: r }] of ordered)
      if (!existing.has(id))
        statements.push(
          db()
            .prepare(
              `INSERT INTO ${kind} (id,owner_id,title,status,date,project_id,milestone_id,task_id,parent_id,data,created_at,updated_at,completed_at,version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            )
            .bind(
              id,
              u.userId,
              r.title,
              r.status,
              r.date,
              r.project_id,
              r.milestone_id,
              r.task_id,
              r.parent_id,
              JSON.stringify(r.data),
              r.created_at || new Date().toISOString(),
              r.updated_at || new Date().toISOString(),
              r.completed_at || null,
              r.version || 1,
            ),
        );
    for (const f of filesToInsert)
      statements.push(
        db()
          .prepare(
            "INSERT INTO attachments (id,owner_id,record_id,kind,name,mime,size,object_key,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            f.id,
            u.userId,
            f.record_id,
            f.kind,
            f.name,
            f.mime,
            f.size,
            f.object_key,
            f.created_at,
          ),
      );
    for (const r of b.revisions) {
      const collision = await db()
        .prepare("SELECT owner_id FROM revisions WHERE id=?")
        .bind(r.id)
        .first<{ owner_id: string }>();
      if (collision && collision.owner_id !== u.userId)
        throw new HttpError(409, "修订 ID 冲突");
      if (incoming.get(r.achievement_id)?.kind !== "achievements")
        throw new HttpError(400, "修订关联无效");
      statements.push(
        db()
          .prepare(
            "INSERT OR IGNORE INTO revisions (id,owner_id,achievement_id,snapshot,created_at) VALUES (?,?,?,?,?)",
          )
          .bind(r.id, u.userId, r.achievement_id, r.snapshot, r.created_at),
      );
    }
    for (const s of b.sessions) {
      const collision = await db()
        .prepare("SELECT owner_id FROM sessions WHERE id=?")
        .bind(s.id)
        .first<{ owner_id: string }>();
      if (collision && collision.owner_id !== u.userId)
        throw new HttpError(409, "计时 ID 冲突");
      if (incoming.get(s.log_id)?.kind !== "logs")
        throw new HttpError(400, "计时关联无效");
      statements.push(
        db()
          .prepare(
            "INSERT OR IGNORE INTO sessions (id,owner_id,log_id,started_at,heartbeat_at,seconds,status) VALUES (?,?,?,?,?,?,'ended')",
          )
          .bind(
            s.id,
            u.userId,
            s.log_id,
            s.started_at,
            s.heartbeat_at,
            s.seconds,
          ),
      );
    }
    if (statements.length) await db().batch(statements);
    return Response.json({
      imported: seen.size - [...seen].filter((id) => existing.has(id)).length,
      skipped: [...seen].filter((id) => existing.has(id)).length,
      files: filesToInsert.length,
    });
  } catch (e) {
    for (const key of uploaded)
      try {
        await bucket().delete(key);
      } catch {}
    return errorResponse(e);
  }
}
