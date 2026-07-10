import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "School Harness 管理画面",
  description: "塾・習い事教室向けオープンソース運営管理システム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
