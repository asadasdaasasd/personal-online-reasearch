"use client";
import { useState, useEffect, useRef } from "react";
import {
  X,
  Save,
  Upload,
  Trash2,
  History,
  Plus,
  ArrowUpRight,
} from "lucide-react";
import {
  type Kind,
  type ResearchRecord,
  type Store,
  type RecordData,
  labels,
  statuses,
  dateToday,
  recordInput,
} from "@/lib/domain";
import { fields } from "@/lib/forms";
import { MarkdownEditor, Markdown } from "./markdown";
let expectedOwner = "";
export function setApiOwner(id: string) {
  expectedOwner = id;
}
export async function api<T = unknown>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const requestHeaders = new Headers(options?.headers);
  if (expectedOwner) requestHeaders.set("X-Research-Owner", expectedOwner);
  if (!(options?.body instanceof FormData))
    requestHeaders.set("Content-Type", "application/json");
  const r = await fetch(url, {
    ...options,
    headers: requestHeaders,
  });
  const d = (await r.json()) as Record<string, unknown>;
  if (!r.ok) throw new Error(String(d.error || "请求失败"));
  return d as T;
}
export function toInput(r: ResearchRecord) {
  return {
    title: r.title,
    status: r.status,
    date: r.date,
    project_id: r.project_id,
    milestone_id: r.milestone_id,
    task_id: r.task_id,
    parent_id: r.parent_id,
    data: r.data,
    version: r.version,
  };
}
type FileInfo = { id: string; name: string; mime: string; size: number };
export function Editor({
  ownerId,
  kind,
  record,
  store,
  initialDate,
  onClose,
  onSaved,
  onNavigate,
}: {
  ownerId: string;
  kind: Kind;
  record?: ResearchRecord;
  store: Store;
  initialDate?: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onNavigate: (k: Kind, r: ResearchRecord) => void;
}) {
  const [value, setValue] = useState(() =>
    record
      ? toInput(record)
      : {
          title:
            kind === "logs"
              ? `${initialDate || dateToday()} 科研日志`
              : kind === "reviews"
                ? `${dateToday()} 周度复盘`
                : "",
          status: ["logs", "achievements"].includes(kind) ? "draft" : "planned",
          date: initialDate || dateToday(),
          project_id: null as string | null,
          milestone_id: null as string | null,
          task_id: null as string | null,
          parent_id: null as string | null,
          data: (kind === "tasks"
            ? { priority: "中" }
            : kind === "achievements"
              ? { type: "其他" }
              : {}) as RecordData,
          version: undefined as number | undefined,
        },
  );
  const [id, setId] = useState(record?.id),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [files, setFiles] = useState<FileInfo[]>([]),
    [view, setView] = useState(
      !!record && ["logs", "achievements", "experiments"].includes(kind),
    ),
    [revisions, setRevisions] = useState<
      { id: string; snapshot: string; created_at: string }[] | null
    >(null),
    [dirty, setDirty] = useState(false),
    [restorable, setRestorable] = useState(false);
  const saving = useRef(false),
    valueRef = useRef(value),
    idRef = useRef(id);
  valueRef.current = value;
  idRef.current = id;
  const draftKey = `research-os-draft:${ownerId}:${kind}:${record?.id || initialDate || "new"}`;
  useEffect(() => {
    setRestorable(!!localStorage.getItem(draftKey));
    if (record)
      api<FileInfo[]>(`/api/files?record=${record.id}`)
        .then(setFiles)
        .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!dirty) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify(value));
    } catch {
      setError("本机草稿存储失败，请立即保存到云端");
    }
    const t = setTimeout(() => {
      if (["logs", "achievements"].includes(kind) && value.title.trim())
        void save(false);
    }, 1800);
    const before = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", before);
    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeunload", before);
    };
  }, [value, dirty]);
  function change(key: string, v: unknown) {
    setValue((p) => ({ ...p, [key]: v }));
    setDirty(true);
    setMessage("有未保存更改");
    setError("");
  }
  function data(key: string, v: RecordData[string]) {
    change("data", { ...valueRef.current.data, [key]: v });
  }
  async function save(close = false) {
    if (saving.current) return;
    const snapshot = valueRef.current;
    try {
      recordInput.parse(snapshot);
    } catch (e) {
      setError("请检查标题、日期、时长及 JSON 参数格式。");
      return;
    }
    saving.current = true;
    setBusy(true);
    setMessage("正在保存…");
    setError("");
    try {
      const r = await api<ResearchRecord>(
        `/api/records/${kind}${idRef.current ? "/" + idRef.current : ""}`,
        {
          method: idRef.current ? "PUT" : "POST",
          body: JSON.stringify(snapshot),
        },
      );
      idRef.current = r.id;
      setId(r.id);
      if (valueRef.current === snapshot) {
        setValue(toInput(r));
        setDirty(false);
        localStorage.removeItem(draftKey);
      } else setValue((p) => ({ ...p, version: r.version }));
      setMessage("已保存到云端");
      await onSaved();
      if (close) onClose();
    } catch (e) {
      setMessage("保存失败 · 本机草稿已保留");
      setError((e as Error).message);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  async function upload(file: File) {
    if (!idRef.current) throw new Error("请先保存记录，再上传图片或附件");
    const f = new FormData();
    f.set("file", file);
    f.set("kind", kind);
    f.set("record", idRef.current);
    const r = await api<FileInfo & { url: string }>("/api/files", {
      method: "POST",
      body: f,
    });
    setFiles((p) => [...p, r]);
    return r;
  }
  const related = (k: Kind, ref: string | null) =>
    ref && store[k].find((r) => r.id === ref);
  const link = (k: Kind, ref: string | null) => {
    const r = related(k, ref);
    return r ? (
      <button className="linked" key={ref} onClick={() => onNavigate(k, r)}>
        {labels[k]} · {r.title}
        <ArrowUpRight size={14} />
      </button>
    ) : null;
  };
  return (
    <div className="modal-backdrop">
      <section
        className="editor-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`${labels[kind]}编辑器`}
      >
        <header className="dialog-header">
          <span className="eyebrow">
            {labels[kind]} {id && `/ ${id.slice(0, 8).toUpperCase()}`}
          </span>
          <div className="row">
            {record && (
              <button className="button" onClick={() => setView(!view)}>
                {view ? "编辑" : "阅读"}
              </button>
            )}
            <button
              className="icon-button"
              aria-label="关闭编辑器"
              onClick={() => {
                if (
                  !dirty ||
                  confirm("尚有未保存更改，本机草稿会保留。确定关闭？")
                )
                  onClose();
              }}
            >
              <X size={20} />
            </button>
          </div>
        </header>
        <div className="dialog-body">
          {error && (
            <div role="alert" className="error-banner">
              {error}
            </div>
          )}
          {restorable && (
            <div className="draft-banner">
              发现本机未提交草稿。
              <button
                onClick={() => {
                  try {
                    setValue(
                      JSON.parse(localStorage.getItem(draftKey) || "{}"),
                    );
                    setDirty(true);
                    setRestorable(false);
                    setView(false);
                  } catch {
                    setError("草稿格式不可用");
                  }
                }}
              >
                恢复草稿
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem(draftKey);
                  setRestorable(false);
                }}
              >
                丢弃草稿
              </button>
            </div>
          )}
          {view ? (
            <>
              <h1>{value.title}</h1>
              <div className="row wrap">
                <span className={`badge ${value.status}`}>
                  {statuses[value.status]}
                </span>
                <span className="muted">{value.date}</span>
              </div>
              <div className="relation-links">
                {link("projects", value.project_id)}
                {link("milestones", value.milestone_id)}
                {link("tasks", value.task_id)}
                {link("tasks", value.parent_id)}
                {(["taskIds", "experimentIds"] as const).flatMap((key) =>
                  ((value.data[key] || []) as string[]).map((id) =>
                    link(key === "taskIds" ? "tasks" : "experiments", id),
                  ),
                )}
              </div>
              {fields[kind].map((f) =>
                value.data[f.key] !== undefined && value.data[f.key] !== "" ? (
                  <section className="reading-section" key={f.key}>
                    <h3>{f.label}</h3>
                    <Markdown
                      text={
                        f.type === "json"
                          ? `\`\`\`json\n${value.data[f.key]}\n\`\`\``
                          : String(value.data[f.key])
                      }
                    />
                  </section>
                ) : null,
              )}
              <Markdown text={String(value.data.body || "")} />
              {kind === "projects" &&
                (
                  [
                    "milestones",
                    "tasks",
                    "logs",
                    "experiments",
                    "achievements",
                  ] as Kind[]
                ).map((k) => (
                  <section className="reading-section" key={k}>
                    <h3>{labels[k]}</h3>
                    {store[k]
                      .filter((r) => r.project_id === id)
                      .map((r) => link(k, r.id))}
                    {!store[k].some((r) => r.project_id === id) && (
                      <p className="muted">暂无关联记录</p>
                    )}
                  </section>
                ))}
            </>
          ) : (
            <>
              <input
                className="title-input"
                aria-label="标题"
                placeholder={`${labels[kind]}标题 *`}
                maxLength={240}
                value={value.title}
                onChange={(e) => change("title", e.target.value)}
              />
              <div className="form-grid">
                <label>
                  状态
                  <select
                    value={value.status}
                    aria-label="状态"
                    onChange={(e) => change("status", e.target.value)}
                  >
                    {Object.entries(statuses).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {["projects", "milestones", "tasks"].includes(kind)
                    ? "开始日期"
                    : "记录日期"}{" "}
                  *
                  <input
                    type="date"
                    required
                    value={value.date}
                    onChange={(e) => change("date", e.target.value)}
                  />
                </label>
                {kind !== "projects" && (
                  <label>
                    所属项目{["tasks", "milestones"].includes(kind) && " *"}
                    <select
                      value={value.project_id || ""}
                      onChange={(e) => {
                        change("project_id", e.target.value || null);
                        setValue((p) => ({
                          ...p,
                          milestone_id: null,
                          task_id: null,
                          parent_id: null,
                          data: { ...p.data, taskIds: [], experimentIds: [] },
                        }));
                      }}
                    >
                      <option value="">未关联</option>
                      {store.projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {!["projects", "milestones", "reviews"].includes(kind) && (
                  <label>
                    阶段目标
                    <select
                      value={value.milestone_id || ""}
                      onChange={(e) =>
                        change("milestone_id", e.target.value || null)
                      }
                    >
                      <option value="">未关联</option>
                      {store.milestones
                        .filter((m) => m.project_id === value.project_id)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.title}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                {["logs", "experiments"].includes(kind) && (
                  <label>
                    关联任务
                    <select
                      value={value.task_id || ""}
                      onChange={(e) =>
                        change("task_id", e.target.value || null)
                      }
                    >
                      <option value="">未关联</option>
                      {store.tasks
                        .filter((t) => t.project_id === value.project_id)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                {kind === "tasks" && (
                  <label>
                    父任务（子任务可选）
                    <select
                      value={value.parent_id || ""}
                      onChange={(e) =>
                        change("parent_id", e.target.value || null)
                      }
                    >
                      <option value="">顶层任务</option>
                      {store.tasks
                        .filter(
                          (t) =>
                            t.project_id === value.project_id &&
                            !t.parent_id &&
                            t.id !== id,
                        )
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                {fields[kind].map((f) => (
                  <label
                    key={f.key}
                    className={
                      f.type === "textarea" || f.type === "json" ? "full" : ""
                    }
                  >
                    {f.label}
                    {f.type === "textarea" || f.type === "json" ? (
                      <textarea
                        rows={f.type === "json" ? 5 : 3}
                        className={f.type === "json" ? "mono" : ""}
                        value={String(value.data[f.key] ?? "")}
                        placeholder={
                          f.type === "json"
                            ? '{"参数名称": 100, "模式": "自定义"}'
                            : ""
                        }
                        onChange={(e) => data(f.key, e.target.value)}
                      />
                    ) : f.type === "select" ? (
                      <select
                        value={String(value.data[f.key] || "")}
                        onChange={(e) => data(f.key, e.target.value)}
                      >
                        <option value="">请选择</option>
                        {f.options?.map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={f.type || "text"}
                        min={f.type === "number" ? 0 : undefined}
                        max={f.type === "number" ? 24 : undefined}
                        step={f.type === "number" ? "0.01" : undefined}
                        value={String(value.data[f.key] ?? "")}
                        onChange={(e) =>
                          data(
                            f.key,
                            f.type === "number"
                              ? Number(e.target.value)
                              : e.target.value,
                          )
                        }
                      />
                    )}
                  </label>
                ))}
              </div>
              {kind === "experiments" && (
                <KeyValues
                  value={String(value.data.parameters || "{}")}
                  onChange={(v) => data("parameters", v)}
                />
              )}
              {kind === "achievements" && (
                <div className="form-grid">
                  {(["tasks", "experiments"] as const).map((k) => (
                    <label key={k}>
                      关联{labels[k]}（可多选）
                      <select
                        multiple
                        value={
                          (value.data[
                            k === "tasks" ? "taskIds" : "experimentIds"
                          ] || []) as string[]
                        }
                        onChange={(e) =>
                          data(
                            k === "tasks" ? "taskIds" : "experimentIds",
                            Array.from(
                              e.target.selectedOptions,
                              (o) => o.value,
                            ),
                          )
                        }
                      >
                        {store[k]
                          .filter((r) => r.project_id === value.project_id)
                          .map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.title}
                            </option>
                          ))}
                      </select>
                    </label>
                  ))}
                </div>
              )}
              <label className="section-label">
                {kind === "logs" ? "自由科研笔记" : "正文与补充说明"}
              </label>
              <MarkdownEditor
                value={String(value.data.body || "")}
                onChange={(v) => data("body", v)}
                disabled={!id}
                onUpload={upload}
              />
            </>
          )}
          <section className="attachment-section">
            <h3>
              图片与附件 <span className="muted">{files.length}</span>
            </h3>
            {files.map((f) => (
              <div className="file-row" key={f.id}>
                <a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer">
                  {f.name} <small>{(f.size / 1024).toFixed(1)} KB</small>
                </a>
                <button
                  className="icon-button danger"
                  aria-label={`删除附件 ${f.name}`}
                  onClick={async () => {
                    if (
                      !confirm(
                        "确定删除此附件？正在被正文或历史版本引用的文件将受到保护。",
                      )
                    )
                      return;
                    try {
                      await api(`/api/files/${f.id}`, { method: "DELETE" });
                      setFiles((p) => p.filter((x) => x.id !== f.id));
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            {!view && (
              <label
                className={`button upload-button ${!id ? "disabled" : ""}`}
              >
                <Upload size={16} />
                上传附件
                <input
                  type="file"
                  hidden
                  disabled={!id || busy}
                  accept=".png,.jpg,.jpeg,.webp,.pdf,.docx,.xlsx,.csv,.py,.txt,.json,.yaml,.yml,.md"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      setBusy(true);
                      await upload(f);
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                      e.target.value = "";
                    }
                  }}
                />
              </label>
            )}
            <p className="hint">
              {id
                ? "单文件 ≤ 10 MB · 私有存储，登录后可访问"
                : "先保存记录，再上传图片与附件。"}
            </p>
          </section>
          {kind === "achievements" && id && (
            <section className="reading-section">
              <button
                className="button"
                onClick={async () => {
                  try {
                    setRevisions(await api(`/api/revisions/${id}`));
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <History size={15} />
                查看历史修订
              </button>
              {revisions?.length === 0 && (
                <p className="muted">
                  暂无历史修订，下一次编辑保存时自动保留。
                </p>
              )}
              {revisions?.map((r) => (
                <div className="file-row" key={r.id}>
                  <span>{new Date(r.created_at).toLocaleString("zh-CN")}</span>
                  <button
                    className="button"
                    onClick={() => {
                      if (
                        confirm(
                          "将此版本载入编辑器？保存后才会生效，当前版本也会保留。",
                        )
                      ) {
                        const old = JSON.parse(r.snapshot);
                        setValue({ ...toInput(old), version: value.version });
                        setDirty(true);
                        setView(false);
                      }
                    }}
                  >
                    载入此版本
                  </button>
                </div>
              ))}
            </section>
          )}
        </div>
        <footer className="dialog-footer">
          <span className={error ? "error" : "muted"} role="status">
            {message || "所有记录仅对你可见"}
          </span>
          <div className="row">
            {id && (
              <button
                className="button danger"
                disabled={busy}
                onClick={async () => {
                  if (
                    !confirm(
                      `确定永久删除这条${labels[kind]}及其附件、修订记录？此操作不可撤销。`,
                    )
                  )
                    return;
                  try {
                    await api(`/api/records/${kind}/${id}`, {
                      method: "DELETE",
                    });
                    localStorage.removeItem(draftKey);
                    await onSaved();
                    onClose();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                删除
              </button>
            )}
            {!view && (
              <button
                className="button primary"
                disabled={busy}
                onClick={() => save(true)}
              >
                <Save size={16} />
                {busy ? "保存中…" : "保存记录"}
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}
function KeyValues({
  value,
  onChange,
}: {
  value: string;
  onChange: (s: string) => void;
}) {
  let pairs: [string, unknown][] = [];
  try {
    pairs = Object.entries(JSON.parse(value));
  } catch {}
  const [key, setKey] = useState(""),
    [val, setVal] = useState("");
  return (
    <div className="key-values">
      <h3>结构化参数表</h3>
      {pairs.map(([k, v]) => (
        <div className="file-row" key={k}>
          <code>{k}</code>
          <span>{JSON.stringify(v)}</span>
          <button
            className="icon-button"
            aria-label={`移除参数 ${k}`}
            onClick={() =>
              onChange(
                JSON.stringify(
                  Object.fromEntries(pairs.filter((p) => p[0] !== k)),
                  null,
                  2,
                ),
              )
            }
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <div className="row">
        <input
          aria-label="参数名称"
          placeholder="参数名称"
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        <input
          aria-label="参数值"
          placeholder="参数值"
          value={val}
          onChange={(e) => setVal(e.target.value)}
        />
        <button
          className="button"
          disabled={!key.trim()}
          onClick={() => {
            let v: unknown = val;
            try {
              v = JSON.parse(val);
            } catch {}
            onChange(
              JSON.stringify(
                { ...Object.fromEntries(pairs), [key.trim()]: v },
                null,
                2,
              ),
            );
            setKey("");
            setVal("");
          }}
        >
          <Plus size={16} />
          添加
        </button>
      </div>
    </div>
  );
}
