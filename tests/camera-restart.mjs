// (v30) The camera stops under the prayer (8 Nov: a phone call) and the app takes it again by itself.
// Runs in a hidden Chrome with a fake camera:  node tests/camera-restart.mjs
// The test clock is the sim's; the camera is real (Chrome's fake one), the looking loop is not run.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const p = path.join(ROOT, u.endsWith("/") ? u + "index.html" : u);
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css" };
  res.writeHead(200, { "Content-Type": types[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const base = path.join(process.env.LOCALAPPDATA || "", "ms-playwright");
const exe = fs.readdirSync(base).flatMap((d) => [path.join(base, d, "chrome-headless-shell-win64", "chrome-headless-shell.exe")]).filter((e) => fs.existsSync(e)).sort().reverse()[0];
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
let failed = 0;
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${server.address().port}/docs/?sim`);
  await page.waitForFunction(() => !!window.__pc, null, { timeout: 30000 });
  const out = await page.evaluate(async () => {
    const C = __pc.camera, wait = (ms) => new Promise((r) => setTimeout(r, ms));
    document.querySelector('[data-posture="auto"]').click();
    document.querySelector('[data-key="isha"]').click(); await wait(30);
    let t = 1000000;
    for (let i = 0; i < 35; i++) __pc.feed(0.2, 0, (t += 100), false, { cx: 0.5, cy: 0.45, h: 0.15 });
    for (let i = 0; i < 6; i++) __pc.feed(0.2, 0, (t += 100), true, { cx: 0.5, cy: 0.45, h: 0.15 });
    const r = { mode: __pc.state().mode };
    await C.start();
    const first = C.stream();
    C.seen(t);
    const n0 = C.events().length;
    C.watch(t + 1000); r.after1s = C.events().slice(n0);
    C.watch(t + 1600); r.after1_6s = C.events().slice(n0);
    C.watch(t + 3200); await wait(500); // (asks for the camera afresh)
    r.afterRetry = C.events().slice(n0);
    r.newStream = C.stream() !== first && C.stream()?.getVideoTracks()[0]?.readyState;
    r.oldStream = first.getVideoTracks()[0].readyState;
    C.seen(t + 4000); r.back = C.events().slice(n0);
    r.camAfter = { stalledAt: C.cam().stalledAt, tries: C.cam().tries };
    // stops again and stays stopped: at most 5 tries
    C.seen(t + 10000);
    for (let k = 1; k <= 12; k++) { C.watch(t + 10000 + 1600 * k); await wait(150); }
    r.triesWhenNeverBack = C.cam().tries;
    // the prayer ends while it asks: nothing more is written, the new camera is let go
    C.seen(t + 40000); C.watch(t + 41600); C.watch(t + 43200); C.stop();
    await wait(400);
    r.streamAfterEnd = C.stream();
    r.mode = __pc.state().mode;
    return r;
  });
  const want = (name, ok) => { console.log(`${ok ? "ok  " : "FAIL"} ${name}`); if (!ok) failed++; };
  console.log(JSON.stringify(out, null, 1));
  want("praying", out.mode === "pray");
  want("nothing after 1 s", out.after1s.length === 0);
  want("stopped after 1.5 s", out.after1_6s.length === 1 && /camera stopped \(live/.test(out.after1_6s[0]));
  want("asked again", out.afterRetry.some((e) => /camera asked again/.test(e)) && out.newStream === "live" && out.oldStream === "ended");
  want("back", /camera back after 4\.0s/.test(out.back.at(-1)) && out.camAfter.stalledAt === 0 && out.camAfter.tries === 0);
  want("at most 5 tries", out.triesWhenNeverBack === 5);
  want("no camera left after the end", out.streamAfterEnd === null);
  want("no page errors", errors.length === 0 || (console.log(errors), false));
} finally { await browser.close(); server.close(); }
process.exitCode = failed ? 1 : 0;
