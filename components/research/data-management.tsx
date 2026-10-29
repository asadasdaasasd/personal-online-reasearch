"use client";
import { useState } from "react";
import {
  ShieldCheck,
  Database,
  FolderOpen,
  FileText,
  RotateCcw,
  ArrowDownToLine,
} from "lucide-react";
import JSZip from "jszip";
import {
  type Store,
  type ResearchRecord,
  dateToday,
  kinds,
  labels,
} from "@/lib/domain";
import type { ResearchBackup } from "@/lib/backup-format";
import { api } from "./editor";
function download(name: string, content: BlobPart, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export function DataManagement({
  store,
  reload,
  notify,
}: {
  store: Store;
  reload: () => Promise<void>;
  notify: (s: string) => void;
}) {
  const [busy, setBusy] = useState(false),
    [pending, setPending] = useState<{
      backup: ResearchBackup;
      files: Record<string, string>;
    } | null>(null),
    [error, setError] = useState("");
  async function exportBackup(format: string) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/backup?format=${format}`);
      if (!r.ok) {
        const d = (await r.json()) as { error: string };
        throw new Error(d.error);
      }
      download(
        `research-os-${dateToday()}.${format}`,
        await r.arrayBuffer(),
        format === "zip" ? "application/zip" : "application/json",
      );
      notify("备份已生成，请妥善保管下载文件");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function csv(k: "tasks" | "experiments" | "logs") {
    const headers = ["id", "title", "date", "status", "project_id", "data"];
    const cell = (v: unknown) => {
      let text = typeof v === "object" ? JSON.stringify(v) : String(v ?? "");
      if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
      return '"' + text.replaceAll('"', '""') + '"';
    };
    download(
      `${k}-${dateToday()}.csv`,
      "\uFEFF" +
        [
          headers.join(","),
          ...store[k].map((r) =>
            headers.map((h) => cell(r[h as keyof ResearchRecord])).join(","),
          ),
        ].join("\r\n"),
      "text/csv;charset=utf-8",
    );
  }
  return (
    <>
      <section className="privacy-banner">
        <ShieldCheck size={23} />
        <div>
          <h3>为长期研究，保留一份自己的备份。</h3>
          <p>
            完整 ZIP 包含结构化数据、修订版本、计时、Markdown 文档与原始附件。
          </p>
        </div>
      </section>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      <div className="settings-grid">
        <section className="panel settings-card">
          <span className="data-icon">
            <Database size={22} />
          </span>
          <h3>完整研究数据</h3>
          <p>
            带格式版本的
            JSON，保留所有项目、目标、任务、日志、实验、成果及关联。附件内容单独存储。
          </p>
          <button
            className="button"
            disabled={busy}
            onClick={() => exportBackup("json")}
          >
            <ArrowDownToLine size={16} />
            导出 JSON
          </button>
        </section>
        <section className="panel settings-card">
          <span className="data-icon">
            <FolderOpen size={22} />
          </span>
          <h3>文档与附件备份</h3>
          <p>
            完整 ZIP 同时包含 Markdown
            与图片，文档使用相对图片路径，可离线阅读。
          </p>
          <button
            className="button primary"
            disabled={busy}
            onClick={() => exportBackup("zip")}
          >
            <ArrowDownToLine size={16} />
            {busy ? "正在生成…" : "下载完整 ZIP"}
          </button>
          <p className="hint">
            单次附件合计上限 20 MB，超出时会明确中止并提示替代方式。
          </p>
        </section>
        <section className="panel settings-card">
          <span className="data-icon">
            <FileText size={22} />
          </span>
          <h3>通用 CSV</h3>
          <p>适用于 Excel 或后续分析，JSON 扩展字段完整保留。</p>
          <div className="row wrap">
            {(["tasks", "experiments", "logs"] as const).map((k) => (
              <button className="button" key={k} onClick={() => csv(k)}>
                {labels[k]}
              </button>
            ))}
          </div>
        </section>
        <section className="panel settings-card">
          <span className="data-icon">
            <RotateCcw size={22} />
          </span>
          <h3>导入与恢复</h3>
          <p>
            仅合并新增记录；相同 ID 自动跳过，绝不覆盖已有研究数据。带附件请使用
            ZIP。
          </p>
          <label className="button upload-button">
            选择 JSON / ZIP
            <input
              hidden
              type="file"
              accept=".json,.zip"
              disabled={busy}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setError("");
                setBusy(true);
                try {
                  if (f.size > 25 * 1024 * 1024)
                    throw new Error("恢复文件不得超过 25 MB");
                  let backup,
                    files: Record<string, string> = {};
                  if (f.name.toLowerCase().endsWith(".zip")) {
                    const zip = await JSZip.loadAsync(f);
                    const entry = zip.file("backup.json");
                    if (!entry) throw new Error("ZIP 中缺少 backup.json");
                    backup = JSON.parse(await entry.async("string"));
                    let size = 0;
                    for (const a of backup.attachments || []) {
                      if (size + a.size > 20 * 1024 * 1024)
                        throw new Error("附件恢复超出 20 MB 上限");
                      const file = zip.file(`files/${a.id}`);
                      if (file) {
                        files[a.id] = await file.async("base64");
                        size += a.size;
                      }
                    }
                  } else backup = JSON.parse(await f.text());
                  if (backup.format !== "research-os" || backup.version !== 1)
                    throw new Error("不支持的备份格式或版本");
                  setPending({ backup, files });
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                  e.target.value = "";
                }
              }}
            />
          </label>
        </section>
      </div>
      {pending && (
        <section className="panel import-confirm">
          <h3>确认恢复内容</h3>
          <p>
            {kinds
              .map(
                (k) =>
                  `${labels[k]} ${pending.backup.records?.[k]?.length || 0} 条`,
              )
              .join(" · ")}
          </p>
          <p>
            行为：合并新增记录，同 ID
            跳过。当前账户数据不会被覆盖。恢复的计时会标记为已结束。
          </p>
          <div className="row">
            <button className="button" onClick={() => setPending(null)}>
              取消
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={async () => {
                if (
                  !confirm(
                    "再次确认：将这些记录合并到当前账户？重复记录保持现状。",
                  )
                )
                  return;
                setBusy(true);
                try {
                  const r = await api<{ imported: number; skipped: number }>(
                    "/api/backup",
                    {
                      method: "POST",
                      body: JSON.stringify({
                        ...pending,
                        confirm: "MERGE_ONLY",
                      }),
                    },
                  );
                  setPending(null);
                  await reload();
                  notify(
                    `恢复完成：新增 ${r.imported} 条，跳过 ${r.skipped} 条`,
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              确认合并恢复
            </button>
          </div>
        </section>
      )}
      <p className="hint">
        建议每周导出备份，并在重要成果提交后另存一份。下载文件包含私人研究资料，请存放在可信位置。
      </p>
    </>
  );
}
