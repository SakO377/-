// docs/ の配布用PDFを src/*.html から再生成するスクリプト。
// 使い方: playwright がインストールされた環境で `node docs/src/render.mjs`
// (Chromium が別の場所にある場合は executablePath を調整すること)
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(srcDir, "..");
const jobs = [
  { html: "guide.html", pdf: "School-Harness-つかいかたガイド_保護者生徒向け.pdf" },
  { html: "intro.html", pdf: "School-Harness-導入のご案内_教室運営者向け.pdf" },
];

const browser = await chromium.launch();
const page = await browser.newPage();

for (const job of jobs) {
  await page.goto(`file://${path.join(srcDir, job.html)}`, { waitUntil: "networkidle" });
  await page.pdf({
    path: path.join(outDir, job.pdf),
    format: "A4",
    printBackground: true,
    margin: { top: "10mm", bottom: "12mm", left: "10mm", right: "10mm" },
  });
  console.log(`ok: ${job.pdf}`);
}

await browser.close();
