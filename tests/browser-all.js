// Runs every browser test and the replays of the real records, and returns one object with all the
// results, to compare two versions line by line.
// Use: serve docs/ on 8766 and tests/ on 8768 (with CORS, see .claude/launch.json), open
// http://localhost:8766/?sim in the browser pane, then run there:
//   (0, eval)(await (await fetch("http://localhost:8768/browser-all.js")).text()); await runAll()
// runAll({ postures: ["auto"] }) replays the records as "auto" too (from v13); opts.replay = options for
// replayRecord (e.g. { shoulders: false }), opts.handLog = false: only the counted raises.
window.runAll = async (opts = {}) => {
  const base = opts.base || "http://localhost:8768/";
  const text = async (f) => (await fetch(base + f, { cache: "no-store" })).text();
  const run = async (f) => (0, eval)(await text(f));
  const out = {};
  out.regression = await run("browser-regression.js");
  await run("browser-old-sims.js"); out.old = await window.runOld();
  await run("browser-standing.js"); out.standing = await window.standingTests();
  await run("browser-salam.js"); out.salam = await window.salamTests();
  if (window.autoTests || opts.auto !== false) {
    try { await run("browser-auto.js"); if (window.autoTests) out.auto = await window.autoTests(); } catch (e) { out.auto = `not run: ${e.message}`; }
  }
  try { await run("browser-ui.js"); if (window.uiTests) out.ui = await window.uiTests(); } catch (e) { out.ui = `not run: ${e.message}`; }
  // the real records (kept on the PC only): each replayed with three guesses of the face size
  await run("browser-replay.js");
  const records = opts.records || ["v6-asr-2026-10-16", "v8-asr-2026-10-17", "v10-dhuhr-mixed-2026-10-19", "v12-isha-mixed-2026-10-19",
    "v13-dhuhr-auto-2026-10-21", "v13-fajr-auto-2026-10-21", "v14-dhuhr-auto-2026-10-28",
    "v16-asr-auto-2026-10-30", "v16-maghrib-auto-2026-10-30", "v16-fajr-auto-2026-10-30"];
  out.replays = {};
  for (const name of records) {
    const rec = await window.loadRecord(name, base, opts);
    if (!rec) continue;
    for (const p of [...new Set([rec.posture, ...(opts.postures || [])])]) {
      for (const [v0, hk] of rec.guesses) {
        const r = await window.replayRecord(rec.samples, v0, hk, rec.raises, rec.prayer, p, opts.replay || {});
        out.replays[`${name} ${p} ${v0}/${hk}`] = `${r.ended} steps=${r.steps} | ${r.match}`;
      }
    }
  }
  localStorage.clear();
  return out;
};

// One saved record (tests/records/<name>.txt), ready for replayRecord, or null when it is not there.
// raises: the counted raises, and (unless opts.handLog === false) every time both hands were seen up
// beside the face, counted or not - logged ~0.45 s after they went down. guesses: [V0, hk] to try
// (from v13 the records keep the real face width: only the face's height over width is guessed).
window.loadRecord = async (name, base = "http://localhost:8768/", opts = {}) => {
  let rec;
  try { rec = await (await fetch(`${base}records/${name}.txt`, { cache: "no-store" })).text(); } catch { return null; }
  if (!rec.startsWith("prayer-counter")) return null;
  const head = rec.split("\n")[0];
  const posture = /posture=(\w+)/.exec(head)[1];
  const prayer = { "الفجر": "fajr", "الظهر": "dhuhr", "العصر": "asr", "المغرب": "maghrib", "العشاء": "isha" }[head.split(" ")[2]];
  const samples = rec.split("\n").find((l) => l.startsWith("SAMPLES ")).split(" ").slice(2).join(" ");
  const events = rec.split("\n").find((l) => l.startsWith("EVENTS ")).slice(7).split("; ");
  const raises = events.filter((e) => /^\d+:(raise|fix: .*raise)/.test(e)).map((e) => Number(e.split(":")[0]) * 100);
  if (opts.handLog !== false) for (const e of events) {
    const m = /^(\d+):hands up ([\d.]+)s .*= raise$/.exec(e);
    if (m) { const to = Number(m[1]) * 100 - 450; raises.push([Math.min(to - 100, to - Number(m[2]) * 1000), to]); }
  }
  const guesses = Number(head.split(" ")[1].slice(1)) >= 13 ? [[0, 0.7], [0, 0.85], [0, 1.0]] : [[0.06, 1.0], [0.075, 1.33], [0.09, 1.47]];
  return { head, posture, prayer, samples, raises, guesses };
};
