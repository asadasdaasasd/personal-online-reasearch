import assert from "node:assert/strict";
const base = "http://127.0.0.1:5174";
const request = async (
  path,
  { user = "isolation-a", method = "GET", body, expected = 200 } = {},
) => {
  const r = await fetch(base + path, {
    method,
    headers: {
      "oai-authenticated-user-id": user,
      "oai-authenticated-user-email": user + "@sites.test",
      "content-type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await r.text();
  assert.equal(r.status, expected, text);
  return JSON.parse(text);
};
const input = {
  title: "[隔离测试] 账户 A 项目",
  status: "active",
  date: "2026-10-29",
  project_id: null,
  milestone_id: null,
  task_id: null,
  parent_id: null,
  data: {},
};
const p = await request("/api/records/projects", {
  method: "POST",
  body: input,
  expected: 201,
});
await request("/api/records/projects/" + p.id, {
  user: "isolation-b",
  expected: 404,
});
await request("/api/records/projects/" + p.id, {
  user: "isolation-b",
  method: "PUT",
  body: { ...input, title: "拒绝跨用户修改", version: p.version },
  expected: 404,
});
await request("/api/records/projects/" + p.id, {
  user: "isolation-b",
  method: "DELETE",
  expected: 404,
});
await request("/api/records/tasks", {
  user: "isolation-b",
  method: "POST",
  body: { ...input, project_id: p.id },
  expected: 404,
});
const list = await request("/api/records", { user: "isolation-b" });
assert.ok(!list.projects.some((r) => r.id === p.id));
const backup = await request("/api/backup", { user: "isolation-b" });
assert.ok(!backup.records.projects.some((r) => r.id === p.id));
const noAuth = await fetch(base + "/api/records");
assert.equal(noAuth.status, 401);
await request("/api/records/projects/" + p.id, { method: "DELETE" });
console.log(
  "PASS cross-user read/write/delete/relation/list/backup isolation and anonymous rejection against built Worker",
);
