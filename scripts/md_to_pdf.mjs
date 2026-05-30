// Render a Markdown file to PDF via headless Chrome.
//
// Usage: node scripts/md_to_pdf.mjs <input.md> [output.pdf]
//
// Why this path: we already have `marked` in web/node_modules and Chrome.app
// on the machine. No new installs needed.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");

const input = process.argv[2];
if (!input) {
  console.error("usage: node scripts/md_to_pdf.mjs <input.md> [output.pdf]");
  process.exit(1);
}
const inputPath = path.resolve(input);
const outputPath = path.resolve(
  process.argv[3] || inputPath.replace(/\.md$/, ".pdf"),
);

const md = fs.readFileSync(inputPath, "utf-8");

// Pull marked from web/node_modules to avoid a fresh install at repo root.
const { marked } = await import(path.join(REPO, "web", "node_modules", "marked", "lib", "marked.esm.js"));

marked.setOptions({ gfm: true, breaks: false });
const body = marked.parse(md);

const title = (md.match(/^#\s+(.+)$/m)?.[1] ?? path.basename(inputPath, ".md")).trim();

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  @page {
    size: A4;
    margin: 18mm 16mm 18mm 16mm;
    @bottom-center { content: counter(page) " / " counter(pages); font-size: 9pt; color: #666; }
  }
  :root {
    --fg: #1a1a1a;
    --muted: #555;
    --border: #d0d7de;
    --accent: #d97706;
    --code-bg: #f6f8fa;
    --table-stripe: #fafbfc;
  }
  html, body {
    margin: 0;
    padding: 0;
    color: var(--fg);
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.55;
  }
  h1, h2, h3, h4 {
    font-weight: 700;
    color: #0f172a;
    line-height: 1.25;
    letter-spacing: -0.01em;
  }
  h1 { font-size: 22pt; margin: 0 0 6pt; border-bottom: 2px solid var(--accent); padding-bottom: 6pt; page-break-after: avoid; }
  h2 { font-size: 16pt; margin: 24pt 0 8pt; border-bottom: 1px solid var(--border); padding-bottom: 4pt; page-break-after: avoid; }
  h3 { font-size: 12.5pt; margin: 16pt 0 6pt; page-break-after: avoid; }
  h4 { font-size: 11pt; margin: 12pt 0 4pt; color: var(--muted); page-break-after: avoid; }
  p, ul, ol { margin: 6pt 0; }
  ul, ol { padding-left: 18pt; }
  li { margin: 2pt 0; }
  strong { color: #0f172a; }
  em { color: #334155; }
  hr { border: 0; border-top: 1px solid var(--border); margin: 18pt 0; }

  blockquote {
    border-left: 3px solid var(--accent);
    padding: 4pt 10pt;
    margin: 8pt 0;
    color: var(--muted);
    background: #fffbeb;
    page-break-inside: avoid;
  }
  blockquote p:first-child { margin-top: 0; }
  blockquote p:last-child { margin-bottom: 0; }

  code {
    font-family: "JetBrains Mono", "SF Mono", ui-monospace, Consolas, monospace;
    background: var(--code-bg);
    padding: 1pt 4pt;
    border-radius: 3px;
    font-size: 9.5pt;
    border: 1px solid var(--border);
  }
  pre {
    font-family: "JetBrains Mono", "SF Mono", ui-monospace, Consolas, monospace;
    background: var(--code-bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 10pt 12pt;
    overflow-x: hidden;
    white-space: pre;
    font-size: 8pt;
    line-height: 1.4;
    page-break-inside: avoid;
  }
  pre code {
    background: transparent;
    border: 0;
    padding: 0;
    font-size: inherit;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 8pt 0;
    font-size: 9.5pt;
    page-break-inside: avoid;
  }
  th, td {
    border: 1px solid var(--border);
    padding: 5pt 7pt;
    text-align: left;
    vertical-align: top;
  }
  th { background: var(--code-bg); font-weight: 600; }
  tr:nth-child(even) td { background: var(--table-stripe); }

  a { color: var(--accent); text-decoration: none; }

  /* First-page title block: keep TL;DR with the title */
  h1 + blockquote { margin-top: 4pt; page-break-before: avoid; }

  /* Avoid leaving a heading orphaned at page bottom */
  h2, h3, h4 { break-after: avoid-page; }

  /* Print-only: hide the ID anchors GitHub adds */
  .anchor { display: none; }
</style>
</head>
<body>
${body}
</body>
</html>`;

const tmpHtml = path.join(os.tmpdir(), `mdpdf-${Date.now()}.html`);
fs.writeFileSync(tmpHtml, html);

const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const cmd = [
  `"${chrome}"`,
  "--headless=new",
  "--disable-gpu",
  "--no-pdf-header-footer",
  `--print-to-pdf="${outputPath}"`,
  `--print-to-pdf-no-header`,
  `--virtual-time-budget=5000`,
  `"file://${tmpHtml}"`,
].join(" ");

try {
  execSync(cmd, { stdio: "pipe" });
  const bytes = fs.statSync(outputPath).size;
  console.log(`Wrote ${outputPath} (${(bytes / 1024).toFixed(1)} KB)`);
} finally {
  try { fs.unlinkSync(tmpHtml); } catch {}
}
