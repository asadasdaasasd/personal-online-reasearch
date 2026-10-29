export const dynamic = "force-dynamic";
import {
  identity,
  db,
  bucket,
  find,
  kindOf,
  errorResponse,
  HttpError,
} from "@/lib/server";
const types: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  py: "text/plain",
  txt: "text/plain",
  json: "application/json",
  yaml: "text/plain",
  yml: "text/plain",
  md: "text/markdown",
};
export async function GET(req: Request) {
  try {
    const u = await identity(),
      id = new URL(req.url).searchParams.get("record");
    return Response.json(
      (
        await db()
          .prepare(
            "SELECT id,name,mime,size,record_id,kind FROM attachments WHERE owner_id=? AND record_id=?",
          )
          .bind(u.userId, id)
          .all()
      ).results,
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(req: Request) {
  try {
    const u = await identity(req);
    if (Number(req.headers.get("content-length")) > 11 * 1024 * 1024)
      throw new HttpError(413, "单个文件不得超过 10 MB");
    const f = await req.formData(),
      file = f.get("file"),
      kind = kindOf(String(f.get("kind"))),
      record = String(f.get("record"));
    await find(kind, record, u.userId);
    if (!(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024)
      throw new HttpError(400, "请选择 10 MB 以内的有效文件");
    const ext = file.name.split(".").pop()?.toLowerCase() || "",
      mime = types[ext];
    if (!mime) throw new HttpError(400, "不支持该文件类型");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (
      (ext === "png" &&
        !(
          bytes[0] === 137 &&
          bytes[1] === 80 &&
          bytes[2] === 78 &&
          bytes[3] === 71
        )) ||
      (["jpg", "jpeg"].includes(ext) &&
        !(bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)) ||
      (ext === "webp" &&
        !(
          new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
          new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
        ))
    )
      throw new HttpError(400, "图片文件内容与扩展名不符");
    const id = crypto.randomUUID(),
      key = `${u.userId}/${id}`,
      name = file.name.replace(/[\r\n\\/]/g, "_").slice(0, 200);
    await bucket().put(key, bytes, { httpMetadata: { contentType: mime } });
    try {
      await db()
        .prepare(
          "INSERT INTO attachments (id,owner_id,record_id,kind,name,mime,size,object_key,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          u.userId,
          record,
          kind,
          name,
          mime,
          file.size,
          key,
          new Date().toISOString(),
        )
        .run();
    } catch (e) {
      await bucket().delete(key);
      throw e;
    }
    return Response.json(
      { id, name, mime, size: file.size, url: `/api/files/${id}` },
      { status: 201 },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
