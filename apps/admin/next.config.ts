import type { NextConfig } from "next";

// 静的エクスポート(output: "export")で out/ にHTML/JS/CSSを出力する。
// サーバーランタイム不要で、Cloudflare Pages にそのまま配置できる。
// APIのURLはビルド時に NEXT_PUBLIC_API_BASE_URL で差し込む。
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
