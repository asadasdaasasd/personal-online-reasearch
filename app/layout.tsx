import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Research OS · 个人科研工作台",
  description: "连接目标、实验与发现的私人科研工作台。",
  icons: {
    icon: "/research-mark.svg",
    shortcut: "/research-mark.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
