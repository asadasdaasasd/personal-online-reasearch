import { createRequire } from "node:module";
import fs from "node:fs";
import assert from "node:assert/strict";
import ts from "typescript";
const output = ts.transpileModule(fs.readFileSync("lib/domain.ts", "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
fs.mkdirSync(".sites-runtime", { recursive: true });
fs.writeFileSync(".sites-runtime/domain-test.mjs", output);
const { statistics, emptyStore, recordInput, weekStart, progress } =
  await import("../.sites-runtime/domain-test.mjs");
assert.equal(weekStart("2026-11-01"), "2026-10-26");
assert.equal(progress([]), 0);
assert.equal(progress([{ status: "done" }, { status: "active" }]), 50);
const state = emptyStore();
state.logs = [
  { date: "2026-10-29", status: "done", data: { hours: 2.5 } },
  { date: "2026-10-28", status: "done", data: { hours: 1.25 } },
  { date: "2026-10-29", status: "draft", data: { hours: 20 } },
];
state.milestones = [{ id: "m", status: "active" }];
state.tasks = [
  {
    status: "done",
    milestone_id: "m",
    completed_at: "2026-10-25T18:00:00Z",
    data: {},
  },
  { status: "active", milestone_id: "m", data: { dueDate: "2026-10-28" } },
];
const s = statistics(state, "2026-10-29");
assert.equal(s.todayHours, 2.5);
assert.equal(s.weekHours, 3.75);
assert.equal(s.streak, 2);
assert.equal(s.stageProgress, 50);
assert.equal(s.weekDone, 1);
assert.equal(s.overdue, 1);
for (const bad of [
  { title: "", date: "2026-10-29" },
  { title: "x", date: "2026-02-30" },
  { title: "x", date: "2026-10-29", data: { hours: 25 } },
  { title: "x", date: "2026-10-29", data: { metrics: "[]" } },
])
  assert.throws(() => recordInput.parse(bad));
assert.equal(
  recordInput.parse({
    title: " x ",
    date: "2026-10-29",
    data: { parameters: '{"custom":1}' },
  }).title,
  "x",
);
console.log(
  "PASS 15 domain assertions: statistics, Beijing dates, draft exclusion, streaks, progress and validation",
);
