import { db, bucket } from "./server";
export function queueDeletion(key: string, owner: string) {
  return db()
    .prepare(
      "INSERT OR IGNORE INTO file_garbage (object_key,owner_id,created_at) VALUES (?,?,?)",
    )
    .bind(key, owner, new Date().toISOString());
}
export async function collectGarbage(owner: string) {
  const rows = await db()
    .prepare("SELECT object_key FROM file_garbage WHERE owner_id=? LIMIT 30")
    .bind(owner)
    .all<{ object_key: string }>();
  for (const r of rows.results) {
    try {
      await bucket().delete(r.object_key);
      await db()
        .prepare("DELETE FROM file_garbage WHERE object_key=? AND owner_id=?")
        .bind(r.object_key, owner)
        .run();
    } catch {
      console.error("Deferred private object cleanup pending");
    }
  }
}
