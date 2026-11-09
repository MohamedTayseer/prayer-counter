// (v31) Two cases from 9 Nov, as sims in a hidden Chrome:  node tests/v31-sims.mjs [--docs <dir>]
// 1. Up from the ruku with both hands raised while the face still looks close, upright only a moment,
//    then the sujood (Maghrib): the ruku and the sujood must stay two bows.
// 2. The takbeer not seen (Dhuhr): a ruku and a sujood while waiting start the prayer, both counted;
//    one lean, or a long one, while waiting starts nothing.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const DOCS = path.resolve(argv.includes("--docs") ? argv[argv.indexOf("--docs") + 1] : path.join(ROOT, "docs"));
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const p = path.join(DOCS, u.endsWith("/") ? u + "index.html" : u);
  if (!p.startsWith(DOCS) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css" };
  res.writeHead(200, { "Content-Type": types[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const base = path.join(process.env.LOCALAPPDATA || "", "ms-playwright");
const exe = fs.readdirSync(base).map((d) => path.join(base, d, "chrome-headless-shell-win64", "chrome-headless-shell.exe")).filter((e) => fs.existsSync(e)).sort().reverse()[0];
const browser = await chromium.launch({ executablePath: exe, headless: true });
let failed = 0;
const want = (name, ok, got) => { console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : `   got: ${got}`}`); if (!ok) failed++; };
try {
  const run = async (fn) => {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`http://127.0.0.1:${server.address().port}/?sim`);
    await page.waitForFunction(() => !!window.__pc, null, { timeout: 30000 });
    const r = await page.evaluate(fn);
    await page.close();
    if (errors.length) r.errors = errors;
    return r;
  };
  // the helpers, defined in the page each time
  const H = `
    const W = 0.2, cy0 = 0.45, h0 = 0.15; let t = 1000000;
    const up = (ms, hands = false) => { for (let i = 0; i < ms / 100; i++) __pc.feed(W, -0.2, (t += 100), hands, { cx: 0.5, cy: cy0, h: h0 }); };
    const bow = (ms, k = 1.35, hands = false) => { for (let i = 0; i < ms / 100; i++) __pc.feed(W * k, -0.2, (t += 100), hands, { cx: 0.5, cy: cy0 + 0.05, h: h0 * k }); };
    const begin = (key) => { document.querySelector('[data-posture="auto"]').click(); document.querySelector('[data-key="' + key + '"]').click(); };
    const ev = () => (__pc.history()[0]?.trace?.events || "");
    const end = () => document.getElementById("endBtn")?.click();
  `;
  const r1 = await run(new Function(`return (async () => { ${H}
    begin("maghrib"); await new Promise((r) => setTimeout(r, 30));
    up(3500); up(600, true); up(8000);                 // takbeer, reading
    up(500, true); bow(2200);                          // raise, ruku
    bow(900, 1.35, true);                              // coming up with the hands raised, the face still close
    up(600); bow(2000); up(2000); bow(2000); up(3000); // a moment upright, sujood 1, sitting, sujood 2, up
    return { mode: __pc.state().mode, ptr: __pc.state().ptr, step: __pc.state().step, bows: __pc.obs().bows.length, ev: __pc.camera.events().join("; ") };
  })()`));
  want("maghrib: ruku and sujood stay two bows (on to the 2nd rak'ah's reading, step 6)", r1.ptr === 6 && !r1.errors, JSON.stringify(r1));

  const r2 = await run(new Function(`return (async () => { ${H}
    begin("dhuhr"); await new Promise((r) => setTimeout(r, 30));
    up(4000); up(6000);                                 // waiting; the takbeer not seen; reading
    bow(2200); up(1500);                                // ruku, up
    const before = __pc.state().mode;
    bow(1500);                                          // sujood 1 begins
    const s1 = __pc.state();
    bow(500); up(2000); bow(2000); up(3000);            // sujood 1 ends, sitting, sujood 2, up
    const s2 = __pc.state();
    return { before, mode1: s1.mode, ptr1: s1.ptr, ptr2: s2.ptr, events: __pc.camera ? __pc.camera.events().join("; ") : "" };
  })()`));
  want("dhuhr: still waiting after one bow", r2.before === "takbeer", JSON.stringify(r2));
  want("dhuhr: started at the second bow (sujood 1, step 3)", r2.mode1 === "pray" && r2.ptr1 === 3, JSON.stringify(r2));
  want("dhuhr: then on to rak'ah 2 (step 6)", r2.ptr2 === 6, JSON.stringify(r2));
  want("dhuhr: the record says the takbeer was not seen", /takbeer not seen/.test(r2.events), r2.events);

  const r3 = await run(new Function(`return (async () => { ${H}
    begin("dhuhr"); await new Promise((r) => setTimeout(r, 30));
    up(4000); bow(2000); up(8000);                      // one lean, then upright
    const a = __pc.state().mode;
    bow(12000); up(1000); bow(2000); up(3000);          // a long lean (looking at the phone), then a short one
    return { a, b: __pc.state().mode };
  })()`));
  want("waiting: one lean starts nothing", r3.a === "takbeer", JSON.stringify(r3));
  want("waiting: a long lean and a short one start nothing", r3.b === "takbeer", JSON.stringify(r3));

  const r4 = await run(new Function(`return (async () => { ${H}
    begin("dhuhr"); await new Promise((r) => setTimeout(r, 30));
    up(4000); up(600, true); up(8000); up(500, true); bow(2200); up(1500); bow(2000);
    return { mode: __pc.state().mode, ptr: __pc.state().ptr };
  })()`));
  want("the takbeer seen: as before (sujood 1, step 3)", r4.mode === "pray" && r4.ptr === 3, JSON.stringify(r4));
} finally { await browser.close(); server.close(); }
process.exitCode = failed ? 1 : 0;
