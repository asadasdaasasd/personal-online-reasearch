"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { useRef, useState } from "react";
import {
  Bold,
  Italic,
  Heading2,
  List,
  Code,
  ImagePlus,
  Eye,
  Pencil,
  Table2,
  Sigma,
  X,
} from "lucide-react";
export function Markdown({ text }: { text: string }) {
  const [zoom, setZoom] = useState("");
  return (
    <>
      <div className="prose">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex, rehypeHighlight]}
          components={{
            img: ({ src, alt }) => (
              <button
                type="button"
                className="image-button"
                onClick={() => setZoom(String(src || ""))}
              >
                <img src={src} alt={alt || "科研图片"} loading="lazy" />
                <span>{alt}</span>
              </button>
            ),
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ),
          }}
        >
          {text}
        </ReactMarkdown>
      </div>
      {zoom && (
        <div
          className="lightbox"
          role="dialog"
          aria-label="图片预览"
          onClick={() => setZoom("")}
        >
          <button aria-label="关闭预览">
            <X />
          </button>
          <img src={zoom} alt="放大预览" />
        </div>
      )}
    </>
  );
}
export function MarkdownEditor({
  value,
  onChange,
  onUpload,
  disabled,
}: {
  value: string;
  onChange: (s: string) => void;
  onUpload?: (f: File) => Promise<{ url: string; name: string }>;
  disabled?: boolean;
}) {
  const area = useRef<HTMLTextAreaElement>(null),
    input = useRef<HTMLInputElement>(null),
    latest = useRef(value);
  latest.current = value;
  const [preview, setPreview] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  function insert(before: string, after = "") {
    const current = latest.current;
    const el = area.current,
      start = el?.selectionStart ?? current.length,
      end = el?.selectionEnd ?? start;
    onChange(
      current.slice(0, start) +
        before +
        current.slice(start, end) +
        after +
        current.slice(end),
    );
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + before.length, end + before.length);
    });
  }
  return (
    <div className="markdown-editor">
      <div className="editor-toolbar">
        {[
          [Bold, "粗体", "**", "**"],
          [Italic, "斜体", "*", "*"],
          [Heading2, "标题", "\n## ", ""],
          [List, "列表", "\n- ", ""],
          [Code, "代码块", "\n```python\n", "\n```\n"],
          [Table2, "表格", "\n| 列名 | 数值 |\n| --- | --- |\n|  |  |\n", ""],
          [Sigma, "公式", "\n$$\n", "\n$$\n"],
        ].map(([Icon, label, a, b]) => {
          const I = Icon as typeof Bold;
          return (
            <button
              key={String(label)}
              type="button"
              title={String(label)}
              aria-label={String(label)}
              onClick={() => insert(String(a), String(b))}
            >
              <I size={16} />
            </button>
          );
        })}
        {onUpload && (
          <button
            type="button"
            title="在光标位置插入图片"
            aria-label="插入图片"
            disabled={disabled || busy}
            onClick={() => input.current?.click()}
          >
            <ImagePlus size={16} />
          </button>
        )}
        <span className="spacer" />
        <button type="button" onClick={() => setPreview(!preview)}>
          {preview ? <Pencil size={15} /> : <Eye size={15} />}{" "}
          {preview ? "编辑" : "预览"}
        </button>
        <input
          hidden
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file || !onUpload) return;
            setBusy(true);
            setError("");
            try {
              const r = await onUpload(file);
              insert(`\n![${r.name.replace(/[\[\]]/g, "")}](${r.url})\n`);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
              e.target.value = "";
            }
          }}
        />
      </div>
      {busy && <p className="hint">正在上传图片…</p>}
      {error && <p className="error">{error}</p>}
      {preview ? (
        <div className="editor-preview">
          <Markdown text={value || "*在编辑区记录你的发现…*"} />
        </div>
      ) : (
        <textarea
          ref={area}
          className="markdown-input"
          aria-label="Markdown 正文"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="从一个想法开始… 支持 Markdown、代码、表格与 LaTeX 公式。"
        />
      )}
      <div className="editor-footer">
        Markdown · LaTeX · 图片说明可在 ![说明文字] 中编辑
        <span>{value.length} 字符</span>
      </div>
    </div>
  );
}
