import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  settings: text("settings").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
});
const columns = () => ({
  id: text("id").primaryKey(),
  owner_id: text("owner_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  status: text("status").notNull(),
  date: text("date").notNull(),
  project_id: text("project_id").references(
    (): AnySQLiteColumn => projects.id,
    { onDelete: "restrict" },
  ),
  milestone_id: text("milestone_id").references(
    (): AnySQLiteColumn => milestones.id,
    { onDelete: "restrict" },
  ),
  task_id: text("task_id").references((): AnySQLiteColumn => tasks.id, {
    onDelete: "restrict",
  }),
  parent_id: text("parent_id").references((): AnySQLiteColumn => tasks.id, {
    onDelete: "restrict",
  }),
  data: text("data").notNull().default("{}"),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
  completed_at: text("completed_at"),
  version: integer("version").notNull().default(1),
});
const table = (name: string) =>
  sqliteTable(name, columns(), (t) => [
    index(name + "_owner_date").on(t.owner_id, t.date),
    index(name + "_project").on(t.project_id),
    index(name + "_milestone").on(t.milestone_id),
    index(name + "_task").on(t.task_id),
  ]);
export const projects = table("projects");
export const milestones = table("milestones");
export const tasks = table("tasks");
export const logs = table("logs");
export const experiments = table("experiments");
export const achievements = table("achievements");
export const reviews = table("reviews");
export const revisions = sqliteTable(
  "revisions",
  {
    id: text("id").primaryKey(),
    owner_id: text("owner_id")
      .notNull()
      .references(() => users.id),
    achievement_id: text("achievement_id")
      .notNull()
      .references(() => achievements.id, { onDelete: "cascade" }),
    snapshot: text("snapshot").notNull(),
    created_at: text("created_at").notNull(),
  },
  (t) => [index("revision_achievement").on(t.achievement_id)],
);
export const attachments = sqliteTable(
  "attachments",
  {
    id: text("id").primaryKey(),
    owner_id: text("owner_id")
      .notNull()
      .references(() => users.id),
    record_id: text("record_id").notNull(),
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    object_key: text("object_key").notNull(),
    created_at: text("created_at").notNull(),
  },
  (t) => [
    index("attachment_owner_record").on(t.owner_id, t.record_id),
    uniqueIndex("attachment_key").on(t.object_key),
  ],
);
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    owner_id: text("owner_id")
      .notNull()
      .references(() => users.id),
    log_id: text("log_id")
      .notNull()
      .references(() => logs.id, { onDelete: "cascade" }),
    started_at: text("started_at").notNull(),
    heartbeat_at: text("heartbeat_at").notNull(),
    seconds: integer("seconds").notNull().default(0),
    status: text("status").notNull(),
  },
  (t) => [index("session_owner").on(t.owner_id)],
);
export const fileGarbage = sqliteTable(
  "file_garbage",
  {
    object_key: text("object_key").primaryKey(),
    owner_id: text("owner_id")
      .notNull()
      .references(() => users.id),
    created_at: text("created_at").notNull(),
  },
  (t) => [index("garbage_owner").on(t.owner_id)],
);
