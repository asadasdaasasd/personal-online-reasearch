"use client";
import { useState } from "react";
import { Copy, MonitorDown, Check } from "lucide-react";

export function QuickEntry() {
  const [message, setMessage] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(location.origin);
      setMessage("网址已复制，可粘贴到浏览器收藏夹。");
    } catch {
      setMessage(`请收藏此网址：${location.origin}`);
    }
  }
  function download() {
    const blob = new Blob(
      [`[InternetShortcut]\r\nURL=${location.origin}/\r\n`],
      { type: "application/octet-stream" },
    );
    const href = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = href;
    a.download = "Research OS.url";
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
    setMessage(
      "将下载的 Research OS.url 移到 Windows 桌面，以后双击即可进入。",
    );
  }
  return (
    <section className="quick-entry">
      <h3>下次，一键回到研究</h3>
      <p>保存入口，随时继续你的工作。</p>
      <div className="row quick-entry-actions">
        <button className="button" onClick={download}>
          <MonitorDown size={16} />
          下载桌面快捷方式
        </button>
        <button className="button secondary" onClick={copy}>
          <Copy size={15} />
          复制网址
        </button>
      </div>
      {message && (
        <p className="hint" role="status">
          <Check size={14} />
          {message}
        </p>
      )}
      <details>
        <summary>手机或其他电脑怎么保存？</summary>
        <p>
          iPhone：用 Safari 打开，点“分享 →
          添加到主屏幕”。Android：在浏览器菜单选择“添加到主屏幕”。Mac
          或其他电脑：将网址加入书签或收藏夹。
        </p>
        <p>快捷方式只保存网址；打开后仍需验证账户。</p>
      </details>
    </section>
  );
}
