// The nightly check of the prayer records (v25). Finds the records not seen before in the synced
// Dropbox folders, copies them into tests/records/ (kept on this PC only), plays each one back
// through the app in a hidden Chrome (several small variations, as in the 5 Nov check-up) and
// writes tests/records/check-report.md: for each new prayer, how it went on the phone and in the
// replays, and OK or "needs a look". Nothing is changed in the app.
//   node tests/check-records.mjs            the new records only
//   node tests/check-records.mjs --init     mark every record there now as seen, check nothing
//   node tests/check-records.mjs --all      check every record there again
// The Dropbox folder: G:\Dropbox (or the PRAYER_DROPBOX setting). Needs tests/node_modules
// (npm install in tests/) and a Chrome from Playwright in %LOCALAPPDATA%\ms-playwright.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RECORDS = path.join(ROOT, "tests", "records");
const SEEN = path.join(RECORDS, "seen.json");
const REPORT = path.join(RECORDS, "check-report.md");
const LOG = path.join(RECORDS, "check-log.txt");
const DROPBOX = process.env.PRAYER_DROPBOX || "G:\\Dropbox";
const args = new Set(process.argv.slice(2));
const KEYS = { "الفجر": "fajr", "الظهر": "dhuhr", "العصر": "asr", "المغرب": "maghrib", "العشاء": "isha" };

// where the phone's records arrive: the app's own folder(s) under Apps, and the folder used by hand
function sources() {
  const dirs = [path.join(DROPBOX, "Iphone", "Prayer counter")];
  const apps = path.join(DROPBOX, "Apps");
  if (fs.existsSync(apps)) for (const d of fs.readdirSync(apps)) dirs.push(path.join(apps, d));
  const files = [];
  for (const d of dirs) {
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) if (/^prayer_.*\.txt$/.test(f)) files.push(path.join(d, f));
  }
  return files;
}
const load = (p, d) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return d; } };

// a record's name here: v25-fajr-auto-2026-11-05-1703.txt (from its file name and first line)
function localName(file, text) {
  const head = text.split("\n")[0];
  const m = /^prayer_(\d{4}-\d\d-\d\d)_(\d\d)-(\d\d)_(\w+)_v(\d+|x)\.txt$/.exec(path.basename(file));
  const posture = /posture=(\w+)/.exec(head)?.[1] || "x";
  const v = /^prayer-counter v(\d+)/.exec(head)?.[1] || m?.[5] || "x";
  const key = m?.[4] || KEYS[head.split(" ")[2]] || "prayer";
  return m ? `v${v}-${key}-${posture}-${m[1]}-${m[2]}${m[3]}.txt` : `v${v}-${key}-${posture}-${path.basename(file)}`;
}

// how the prayer went on the phone, from the record itself
function onPhone(text) {
  const ev = text.split("\n").find((l) => l.startsWith("EVENTS ")) || "";
  const match = text.split("\n").find((l) => l.startsWith("MATCH ")) || "";
  const end = /end (salam|button)/.exec(ev)?.[1] || "?";
  const [missed, extra] = (/missed (\d+), extra (\d+)/.exec(match) || [0, "?", "?"]).slice(1);
  return { end, missed, extra, undo: (ev.match(/undo:/g) || []).length };
}

// a small server for the app and the tests (one address, so the page may read the records)
function serve() {
  const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".txt": "text/plain; charset=utf-8" };
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const p = path.join(ROOT, u.endsWith("/") ? u + "index.html" : u);
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": types[path.extname(p)] || "application/octet-stream", "Cache-Control": "no-store" });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

function chrome() {
  const base = path.join(process.env.LOCALAPPDATA || "", "ms-playwright");
  const found = [];
  if (fs.existsSync(base)) for (const d of fs.readdirSync(base)) {
    for (const exe of [path.join(base, d, "chrome-headless-shell-win64", "chrome-headless-shell.exe"), path.join(base, d, "chrome-win64", "chrome.exe"), path.join(base, d, "chrome-win", "chrome.exe")]) if (fs.existsSync(exe)) found.push(exe);
  }
  return found.sort().reverse()[0];
}

// played back in the page: three face shapes x three variations, and how long the screen showed a step
// other than the right one (the final steps of that replay; 1.5 s allowed for it to catch up)
async function replayAll(page, names) {
  return page.evaluate(async (names) => {
    const B = "/tests/";
    for (const f of ["browser-all.js", "browser-replay.js"]) (0, eval)(await (await fetch(B + f, { cache: "no-store" })).text());
    const wrong = (r) => {
      const segs = r.segs || [], trail = (r.viewTrail || []).map(([t, p]) => [t - (r.recT0 || 0), p]);
      if (!segs.length) return 0;
      let w = 0;
      for (let tau = 0; tau < segs[segs.length - 1][1]; tau += 100) {
        const ti = segs.findIndex(([s, e]) => tau >= s && tau < e);
        let si = 0; for (const [t, p] of trail) if (t <= tau) si = p;
        if (ti >= 0 && si !== ti && tau - segs[ti][0] > 1500) w += 100;
      }
      return w / 1000;
    };
    const out = {};
    for (const name of names) {
      const r0 = await window.loadRecord(name, B);
      if (!r0) { out[name] = null; continue; }
      const runs = [];
      for (const [v0, hk] of r0.guesses) for (const [vk, opts] of Object.entries({ plain: {}, wobble: { yawNoise: 0.04 }, dropped: { yawGlide: true, dropTurned: true } })) {
        const r = await window.replayRecord(r0.samples, v0, hk, r0.raises, r0.prayer, r0.posture, opts);
        const [missed, extra] = (/missed (\d+), extra (\d+)/.exec(r.match || "") || [0, 9, 9]).slice(1).map(Number);
        runs.push({ v: `${vk} ${hk}`, ended: String(r.ended).startsWith("NOT") ? "not ended" : r.ended, missed, extra, backs: r.screenBacks || 0, wrong: wrong(r) });
      }
      out[name] = runs;
    }
    return out;
  }, names);
}

async function main() {
  fs.mkdirSync(RECORDS, { recursive: true });
  const seen = load(SEEN, {});
  const files = sources();
  if (args.has("--init")) {
    for (const f of files) seen[path.basename(f)] ??= localName(f, fs.readFileSync(f, "utf8"));
    fs.writeFileSync(SEEN, JSON.stringify(seen, null, 1));
    console.log(JSON.stringify({ marked: Object.keys(seen).length }));
    return;
  }
  const todo = files.filter((f) => args.has("--all") || !seen[path.basename(f)]);
  const when = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  if (!todo.length) {
    fs.writeFileSync(REPORT, `# Nightly check, ${when}\n\nNo new records.\n\nALL OK\n`);
    fs.appendFileSync(LOG, `${when}: no new records\n`);
    console.log(JSON.stringify({ new: 0, problems: [] }));
    return;
  }
  const items = todo.map((f) => {
    const text = fs.readFileSync(f, "utf8");
    const name = localName(f, text);
    fs.writeFileSync(path.join(RECORDS, name), text);
    return { file: path.basename(f), name, phone: onPhone(text), v: Number(/^prayer-counter v(\d+)/.exec(text)?.[1] || 0) };
  });
  const server = await serve();
  const exe = chrome();
  if (!exe) throw new Error("no Chrome from Playwright found in %LOCALAPPDATA%\\ms-playwright");
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  let res;
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/docs/?sim`);
    await page.waitForFunction(() => !!window.__pc, null, { timeout: 30000 });
    res = await replayAll(page, items.map((x) => x.name.replace(/\.txt$/, "")));
  } finally { await browser.close(); server.close(); }

  const lines = [`# Nightly check, ${when}`, "", `New records: ${items.length}`, ""];
  const problems = [];
  for (const it of items) {
    const runs = res[it.name.replace(/\.txt$/, "")] || [];
    const n = runs.length;
    // (records before v24 miss the frame that ended the prayer: a replay of them may not reach the end)
    const notEnded = runs.filter((r) => r.ended !== "salam").length;
    const off = runs.filter((r) => r.missed || r.extra).length;
    const back = runs.filter((r) => r.backs).length;
    const worst = Math.max(0, ...runs.map((r) => r.wrong));
    const why = [];
    if (it.phone.end !== "salam") why.push("on the phone it was ended with the button (the salam was not seen)");
    if (it.phone.missed !== "0" || it.phone.extra !== "0") why.push(`on the phone: missed ${it.phone.missed}, extra ${it.phone.extra}`);
    // (from v23 the screen waits 1 s before it shows a step: a step taken back sooner was never seen)
    if (it.phone.undo && it.v < 23) why.push(`on the phone ${it.phone.undo} step(s) were taken back`);
    if (notEnded > (it.v < 24 ? n : 0)) why.push(`${notEnded} of ${n} replays did not end at the salam`);
    if (off) why.push(`${off} of ${n} replays missed or added a bow`);
    if (back) why.push(`the screen went back a step in ${back} of ${n} replays`);
    if (worst > 2) why.push(`the screen showed a wrong step for up to ${worst.toFixed(1)} s`);
    const verdict = why.length ? "NEEDS A LOOK" : "OK";
    if (why.length) problems.push(`${it.name}: ${why.join("; ")}`);
    lines.push(`## ${it.file} (saved as ${it.name})`, "",
      `- On the phone: ended by ${it.phone.end}; missed ${it.phone.missed}, extra ${it.phone.extra}; steps taken back: ${it.phone.undo}`,
      `- Replays (${n}): ended at the salam ${n - notEnded}/${n}; bows right ${n - off}/${n}; screen went back in ${back}/${n}; longest wrong step on the screen ${worst.toFixed(1)} s`,
      `- Each replay: ${runs.map((r) => `${r.v}: ${r.ended}, ${r.missed}/${r.extra}${r.backs ? `, back ${r.backs}` : ""}${r.wrong ? `, wrong ${r.wrong}s` : ""}`).join(" | ")}`,
      ...why.map((w) => `- Why to look: ${w}`), `- Verdict: **${verdict}**`, "");
    seen[it.file] = it.name;
  }
  lines.push(problems.length ? `NEEDS A LOOK: ${problems.length} of ${items.length} prayers` : "ALL OK");
  fs.writeFileSync(REPORT, lines.join("\n") + "\n");
  fs.writeFileSync(SEEN, JSON.stringify(seen, null, 1));
  fs.appendFileSync(LOG, `${when}: ${items.length} new, ${problems.length} to look at\n`);
  console.log(JSON.stringify({ new: items.length, problems }));
}

main().catch((e) => {
  fs.mkdirSync(RECORDS, { recursive: true });
  fs.writeFileSync(REPORT, `# Nightly check FAILED\n\n${e?.stack || e}\n`);
  console.log(JSON.stringify({ error: String(e?.message || e) }));
  process.exitCode = 1;
});
