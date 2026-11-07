// Replays EVERY saved record (tests/records/*.txt, each prayer once) through the app in a hidden
// Chrome and measures what he sees on the screen, to compare two versions before a release (v28):
//   node tests/replay-all.mjs                       the app in docs/
//   node tests/replay-all.mjs --docs <dir>          another copy of the app (e.g. git archive v27 docs)
//   node tests/replay-all.mjs --out <file.json>     also save every result (to compare two runs)
//   node tests/replay-all.mjs --only isha           only the records whose name has this in it
// For each record, 9 replays (3 face shapes x plain / wobbly / dropped head turns), and:
//   end      how many ended at the salam
//   bows     how many counted every ruku and sujood right (no bow missed, none extra)
//   back     how many times the screen went back a step (what confuses while praying)
//   wrong    the longest time the screen showed a wrong step (s; 1.5 s allowed to catch up)
//   lag      how late each step showed on the screen after it began (s): the middle one and the worst
// Kept on this PC only, like the records (they are his prayers).
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RECORDS = path.join(ROOT, "tests", "records");
const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const DOCS = path.resolve(arg("--docs") || path.join(ROOT, "docs"));
const OUT = arg("--out");
const ONLY = arg("--only");

function serve() {
  const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".txt": "text/plain; charset=utf-8" };
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

// each prayer once (the same record sent twice, or saved under two names, is one prayer)
function records() {
  const seen = new Set(), names = [];
  for (const f of fs.readdirSync(RECORDS).sort()) {
    if (!/^v\d+-.*\.txt$/.test(f) || (ONLY && !f.includes(ONLY))) continue;
    const text = fs.readFileSync(path.join(RECORDS, f), "utf8");
    if (!text.startsWith("prayer-counter")) continue;
    const samples = text.split("\n").find((l) => l.startsWith("SAMPLES ")) || "";
    const h = crypto.createHash("sha1").update(samples).digest("hex");
    if (seen.has(h)) continue;
    seen.add(h); names.push(f.replace(/\.txt$/, ""));
  }
  return names;
}

async function main() {
  const names = records();
  const server = await serve();
  const browser = await chromium.launch({ executablePath: chrome(), headless: true });
  let res;
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/docs/?sim`);
    await page.waitForFunction(() => !!window.__pc, null, { timeout: 30000 });
    res = await page.evaluate(async (names) => {
      for (const f of ["browser-all.js", "browser-replay.js"]) (0, eval)(await (await fetch("/tests/" + f, { cache: "no-store" })).text());
      const measure = (r) => {
        const segs = r.segs || [], trail = (r.viewTrail || []).map(([t, p]) => [t - (r.recT0 || 0), p]);
        let wrong = 0; const lags = [];
        if (segs.length) {
          for (let tau = 0; tau < segs[segs.length - 1][1]; tau += 100) {
            const ti = segs.findIndex(([s, e]) => tau >= s && tau < e);
            let si = 0; for (const [t, p] of trail) if (t <= tau) si = p;
            if (ti >= 0 && si !== ti && tau - segs[ti][0] > 1500) wrong += 100;
          }
          segs.forEach(([s], i) => { if (i === 0) return; const hit = trail.find(([t, p]) => p === i && t >= s - 3000); if (hit) lags.push((hit[0] - s) / 1000); });
        }
        return { wrong: wrong / 1000, lags };
      };
      const out = {};
      for (const name of names) {
        const r0 = await window.loadRecord(name, "/tests/");
        if (!r0) continue;
        const runs = [];
        for (const [v0, hk] of r0.guesses) for (const [vk, opts] of Object.entries({ plain: {}, wobble: { yawNoise: 0.04 }, dropped: { yawGlide: true, dropTurned: true } })) {
          const r = await window.replayRecord(r0.samples, v0, hk, r0.raises, r0.prayer, r0.posture, opts);
          const [missed, extra] = (/missed (\d+), extra (\d+)/.exec(r.match || "") || [0, 9, 9]).slice(1).map(Number);
          const m = measure(r);
          runs.push({ v: `${vk} ${hk}`, ended: String(r.ended).startsWith("NOT") ? "not ended" : r.ended, steps: r.steps, missed, extra, back: r.screenBacks || 0, wrong: m.wrong, lags: m.lags, match: r.match, events: r.events, screen: r.screen });
        }
        out[name] = runs;
      }
      return out;
    }, names);
  } finally { await browser.close(); server.close(); }

  const q = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  const all = { lags: [], end: 0, bows: 0, back: 0, runs: 0, wrong: 0 };
  console.log(`app: ${DOCS}\n${"record".padEnd(38)} end  bows back wrong  lag(mid/worst)`);
  for (const [name, runs] of Object.entries(res)) {
    const n = runs.length, end = runs.filter((r) => r.ended === "salam").length, bows = runs.filter((r) => !r.missed && !r.extra).length;
    const back = runs.reduce((a, r) => a + r.back, 0), wrong = Math.max(0, ...runs.map((r) => r.wrong)), lags = runs.flatMap((r) => r.lags);
    all.lags.push(...lags); all.end += end; all.bows += bows; all.back += back; all.runs += n; all.wrong = Math.max(all.wrong, wrong);
    console.log(`${name.padEnd(38)} ${end}/${n}  ${bows}/${n}  ${String(back).padStart(3)}  ${wrong.toFixed(1).padStart(4)}  ${q(lags, 0.5).toFixed(1)}/${Math.max(0, ...lags).toFixed(1)}`);
  }
  console.log(`ALL: ended ${all.end}/${all.runs}, bows right ${all.bows}/${all.runs}, screen back ${all.back}, worst wrong ${all.wrong.toFixed(1)} s, lag middle ${q(all.lags, 0.5).toFixed(2)} s, 90% ${q(all.lags, 0.9).toFixed(2)} s, worst ${Math.max(0, ...all.lags).toFixed(1)} s`);
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
