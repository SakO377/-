import type { NextConfig } from "next";

// 静的エクスポート(output: "export")で out/ にHTML/JS/CSSを出力する。
// サーバーランタイム不要で、Cloudflare Pages にそのまま配置できる。
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
