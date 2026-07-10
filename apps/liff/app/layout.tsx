import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "School Harness",
  description: "欠席連絡・お知らせ確認",
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
