// Runs every browser test (browser-all.js runAll: the sims, the salam, the screens, the times, the
// qibla, the records) in a hidden Chrome, without the browser pane, and saves the results as JSON:
//   node tests/run-all.mjs --out <file.json>                 the app in docs/
//   node tests/run-all.mjs --docs <dir> --out <file.json>    another copy of the app (e.g. git archive v27 docs)
// Two such files compared line by line show what a change did (v28).
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const DOCS = path.resolve(arg("--docs") || path.join(ROOT, "docs"));
const OUT = arg("--out");

function serve() {
  const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".txt": "text/plain; charset=utf-8" };
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const base = u.startsWith("/docs/") ? DOCS : ROOT;
    const rel = u.startsWith("/docs/") ? u.slice(5) : u;
    const p = path.join(base, rel.endsWith("/") ? rel + "index.html" : rel);
    if (!p.startsWith(base) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": types[path.extname(p)] || "application/octet-stream", "Cache-Control": "no-store" });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}
function chrome() {
  const base = path.join(process.env.LOCALAPPDATA || "", "ms-playwright");
  const found = [];
  if (fs.existsSync(base)) for (const d of fs.readdirSync(base)) {
    for (const exe of [path.join(base, d, "chrome-headless-shell-win64", "chrome-headless-shell.exe"), path.join(base, d, "chrome-win64", "chrome.exe")]) if (fs.existsSync(exe)) found.push(exe);
  }
  return found.sort().reverse()[0];
}

const server = await serve();
const browser = await chromium.launch({ executablePath: chrome(), headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${server.address().port}/docs/?sim`);
  await page.waitForFunction(() => !!window.__pc, null, { timeout: 30000 });
  const res = await page.evaluate(async () => {
    (0, eval)(await (await fetch("/tests/browser-all.js", { cache: "no-store" })).text());
    return window.runAll({ base: "/tests/" });
  });
  if (errors.length) res.pageErrors = errors;
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
  console.log(`done: ${Object.keys(res).join(", ")}${errors.length ? ` | PAGE ERRORS: ${errors.join(" / ")}` : ""}`);
} finally { await browser.close(); server.close(); }
