// サーバー側でPDFを生成すると日本語フォントの同梱が必要になり、
// Cloudflare Workersのバンドルサイズ制約と相性が悪い(CJKフォントは数MB〜十数MB)。
// そのため、印刷用にレイアウトされたHTMLを返し、ブラウザの「印刷 > PDFに保存」で
// PDF化してもらう方式を採る(日本語表示も確実)。

export interface InvoiceHtmlData {
  schoolName: string;
  studentName: string;
  yearMonth: string;
  items: { label: string; amount: number }[];
  total: number;
  issuedAt: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

export function renderInvoiceHtml(data: InvoiceHtmlData): string {
  const rows = data.items
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.label)}</td><td class="amount">${formatYen(item.amount)}</td></tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<title>請求書 ${escapeHtml(data.yearMonth)} - ${escapeHtml(data.studentName)}</title>
<style>
  body { font-family: "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif; padding: 48px; color: #111; max-width: 640px; margin: 0 auto; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .meta { color: #555; margin-bottom: 32px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border-bottom: 1px solid #ddd; padding: 10px 4px; text-align: left; }
  th.amount, td.amount { text-align: right; }
  .total { font-size: 20px; font-weight: bold; margin-top: 20px; text-align: right; }
  .footer { margin-top: 48px; color: #888; font-size: 12px; }
  @media print {
    body { padding: 0; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
  <button class="no-print" onclick="window.print()" style="float:right;padding:8px 16px;">印刷 / PDF保存</button>
  <h1>請求書</h1>
  <p class="meta">${escapeHtml(data.yearMonth)} 分 ／ ${escapeHtml(data.studentName)} 様</p>
  <table>
    <thead><tr><th>項目</th><th class="amount">金額</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="total">合計: ${formatYen(data.total)}</p>
  <p class="footer">発行日: ${escapeHtml(data.issuedAt)} ／ ${escapeHtml(data.schoolName)}</p>
</body>
</html>`;
}
