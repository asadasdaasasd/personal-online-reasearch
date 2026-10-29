import assert from "node:assert/strict";
import fs from "node:fs";
import JSZip from "jszip";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:5173";
if (!base.startsWith("http://127.0.0.1:"))
  throw Error(
    "Integration test is restricted to the local disposable database.",
  );
const cookie = "__sites_local_auth=1",
  today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const authHeaders =
  process.env.TEST_AUTH_MODE === "headers"
    ? {
        "oai-authenticated-user-id": "local_seedy",
        "oai-authenticated-user-email": "seedy@sites.test",
      }
    : { cookie };
const passed = [];
async function req(
  path,
  method = "GET",
  body,
  expected = 200,
  authenticated = true,
) {
  const r = await fetch(base + path, {
    method,
    headers: {
      ...(authenticated ? authHeaders : {}),
      ...(body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
    },
    ...(body
      ? { body: body instanceof FormData ? body : JSON.stringify(body) }
      : {}),
  });
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  assert.equal(r.status, expected, `${method} ${path}: ${text.slice(0, 500)}`);
  return data;
}
function pass(s) {
  passed.push(s);
  console.log("PASS", s);
}
const input = (title, extra = {}) => ({
  title,
  status: "active",
  date: today,
  project_id: null,
  milestone_id: null,
  task_id: null,
  parent_id: null,
  data: {},
  ...extra,
});
const update = (r, change) => {
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
  return {
    title,
    status,
    date,
    project_id,
    milestone_id,
    task_id,
    parent_id,
    data,
    version,
    ...change,
  };
};
await req("/api/records", "GET", null, 401, false);
pass("Anonymous API reads rejected");
await req("/api/records/projects", "POST", input("anonymous"), 401, false);
pass("Anonymous writes rejected");
const p = await req(
  "/api/records/projects",
  "POST",
  input("[集成测试] 可复现研究项目", {
    data: { description: "本地自动测试数据，不会部署到生产。" },
  }),
  201,
);
const m = await req(
  "/api/records/milestones",
  "POST",
  input("[集成测试] 验证阶段", { project_id: p.id }),
  201,
);
let t = await req(
  "/api/records/tasks",
  "POST",
  input("[集成测试] 验证持久化流程", {
    project_id: p.id,
    milestone_id: m.id,
    data: { priority: "高", dueDate: today },
  }),
  201,
);
const child = await req(
  "/api/records/tasks",
  "POST",
  input("[集成测试] 子任务", {
    project_id: p.id,
    milestone_id: m.id,
    parent_id: t.id,
  }),
  201,
);
pass("Project → milestone → task → subtask created");
t = await req(
  `/api/records/tasks/${t.id}`,
  "PUT",
  update(t, { status: "done" }),
);
assert.ok(t.completed_at);
assert.equal(t.version, 2);
await req(`/api/records/tasks/${t.id}`, "PUT", update(t, { version: 1 }), 409);
pass("Task completion and stale-edit conflict protection");
await req(
  "/api/records/tasks",
  "POST",
  input("invalid link", { project_id: "missing-project" }),
  404,
);
pass("Foreign/missing project references rejected");
await req(`/api/records/projects/${p.id}`, "DELETE", null, 409);
pass("Referenced project deletion blocked");
let log = await req(
  "/api/records/logs",
  "POST",
  input("[集成测试] 科研日志", {
    status: "done",
    project_id: p.id,
    task_id: t.id,
    data: {
      hours: 2.5,
      work: "验证数据库保存与重新读取",
      body: "## 记录\n\n公式：$x^2$\n\n| A | B |\n|---|---|\n|1|2|",
    },
  }),
  201,
);
assert.equal((await req(`/api/records/logs/${log.id}`)).data.hours, 2.5);
pass("Structured log and Markdown persist across reads");
const exp = await req(
  "/api/records/experiments",
  "POST",
  input("[集成测试] 参数与结果", {
    project_id: p.id,
    task_id: t.id,
    data: {
      parameters: '{"samples":100,"mode":"test"}',
      metrics: '{"accuracy":0.97,"latency":12}',
      results: "结果已保存",
      conclusion: "链路可复现",
    },
  }),
  201,
);
await req(
  "/api/records/experiments",
  "POST",
  input("invalid params", { data: { parameters: "invalid JSON" } }),
  400,
);
pass("Experiment parameters/results persist; invalid JSON rejected");
let a = await req(
  "/api/records/achievements",
  "POST",
  input("[集成测试] 阶段研究成果", {
    status: "draft",
    project_id: p.id,
    milestone_id: m.id,
    data: {
      type: "技术报告",
      taskIds: [t.id],
      experimentIds: [exp.id],
      body: "# 成果\n\n这是本地验证记录。",
    },
  }),
  201,
);
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=",
  "base64",
);
const form = new FormData();
form.set("kind", "achievements");
form.set("record", a.id);
form.set("file", new File([png], "research-test.png", { type: "image/png" }));
const file = await req("/api/files", "POST", form, 201);
const downloaded = await fetch(base + file.url, { headers: authHeaders });
assert.equal(downloaded.status, 200);
assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), png);
await req(file.url, "GET", null, 401, false);
a = await req(
  `/api/records/achievements/${a.id}`,
  "PUT",
  update(a, {
    status: "done",
    data: { ...a.data, body: a.data.body + `\n\n![图表说明](${file.url})` },
  }),
);
assert.ok(
  (await req(`/api/records/achievements/${a.id}`)).data.body.includes(file.url),
);
const history = await req(`/api/revisions/${a.id}`);
assert.equal(history.length, 1);
assert.equal(JSON.parse(history[0].snapshot).status, "draft");
await req(file.url, "DELETE", null, 409);
pass(
  "Private R2 image upload/read, persisted Markdown image, revisions and reference protection",
);
await req("/api/timer", "POST", { action: "start", log_id: log.id });
const session = await req("/api/timer");
assert.equal(session.log_id, log.id);
await req("/api/timer", "POST", { action: "pause" });
assert.equal((await req("/api/timer")).status, "paused");
await req("/api/timer", "POST", { action: "resume" });
await req("/api/timer", "POST", { action: "end" });
assert.equal(await req("/api/timer"), null);
pass("Timer start, persisted resume, pause and end");
const backup = await req("/api/backup");
assert.equal(backup.version, 1);
assert.ok(backup.records.achievements.some((r) => r.id === a.id));
assert.ok(backup.attachments.some((f) => f.id === file.id));
assert.ok(backup.revisions.length > 0);
const zipResponse = await fetch(base + "/api/backup?format=zip", {
  headers: authHeaders,
});
assert.equal(zipResponse.status, 200);
const zip = await JSZip.loadAsync(await zipResponse.arrayBuffer());
assert.deepEqual(await zip.file("files/" + file.id).async("nodebuffer"), png);
const markdown = await zip.file("achievements/" + a.id + ".md").async("string");
assert.ok(markdown.includes("../files/" + file.id));
pass(
  "Full JSON and ZIP include originals, relationships, revisions, sessions, image bytes and portable Markdown",
);
await req(
  "/api/backup",
  "POST",
  { confirm: "MERGE_ONLY", backup: { ...backup, version: 99 } },
  400,
);
const merge = await req("/api/backup", "POST", {
  confirm: "MERGE_ONLY",
  backup,
});
assert.equal(merge.imported, 0);
assert.ok(merge.skipped > 0);
pass(
  "Invalid backup version rejected; repeated imports skip instead of overwriting",
);
const emptyBackup = {
  format: "research-os",
  version: 1,
  records: Object.fromEntries(Object.keys(backup.records).map((k) => [k, []])),
  attachments: [],
  revisions: [],
  sessions: [],
};
const recoveryId = crypto.randomUUID();
emptyBackup.records.projects = [
  { ...p, id: recoveryId, title: "[集成测试] 恢复新增项目" },
];
const recovered = await req("/api/backup", "POST", {
  confirm: "MERGE_ONLY",
  backup: emptyBackup,
});
assert.equal(recovered.imported, 1);
assert.equal(
  (await req("/api/records/projects/" + recoveryId)).title,
  "[集成测试] 恢复新增项目",
);
pass("Backup merge actually restores a new persistent record");
const state = await req("/api/records");
assert.ok(state.tasks.some((r) => r.id === t.id && r.status === "done"));
assert.ok(state.logs.some((r) => r.id === log.id && r.data.hours >= 2.5));
pass("Dashboard source data includes real completed task and research time");
await req("/api/records/projects/does-not-exist", "GET", null, 404);
const cross = await fetch(base + "/api/records/projects", {
  method: "POST",
  headers: {
    ...authHeaders,
    origin: "https://untrusted.example",
    "content-type": "application/json",
  },
  body: JSON.stringify(input("cross origin")),
});
assert.equal(cross.status, 403);
pass("Unknown record and cross-origin writes rejected");
const restoredFileId = crypto.randomUUID(),
  restoredRecordId = crypto.randomUUID();
const fileBackup = {
  ...emptyBackup,
  records: {
    ...emptyBackup.records,
    projects: [],
    achievements: [
      {
        ...a,
        id: restoredRecordId,
        project_id: null,
        milestone_id: null,
        task_id: null,
        data: { body: "![恢复图片](/api/files/" + restoredFileId + ")" },
      },
    ],
  },
  attachments: [
    {
      ...backup.attachments.find((f) => f.id === file.id),
      id: restoredFileId,
      record_id: restoredRecordId,
      object_key: "ignored-on-restore",
    },
  ],
};
const restoredImage = await req("/api/backup", "POST", {
  confirm: "MERGE_ONLY",
  backup: fileBackup,
  files: { [restoredFileId]: png.toString("base64") },
});
assert.equal(restoredImage.files, 1);
const restoredBytes = await fetch(base + "/api/files/" + restoredFileId, {
  headers: authHeaders,
});
assert.deepEqual(Buffer.from(await restoredBytes.arrayBuffer()), png);
pass(
  "ZIP-compatible restore creates actual private image objects and linked documents",
);
await req("/api/records/achievements/" + restoredRecordId, "DELETE");
await req("/api/files/" + restoredFileId, "GET", null, 404);
pass("Deleting a complete achievement removes its private attachments safely");

fs.mkdirSync("outputs", { recursive: true });
fs.writeFileSync(
  "outputs/integration-results.json",
  JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      base,
      passed,
      recordIds: {
        project: p.id,
        milestone: m.id,
        task: t.id,
        child: child.id,
        log: log.id,
        experiment: exp.id,
        achievement: a.id,
        image: file.id,
      },
    },
    null,
    2,
  ),
);
console.log(`${passed.length} integration groups passed.`);
