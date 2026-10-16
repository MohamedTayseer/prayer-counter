// Browser regression: 10 simulated prayers through the whole app.
// Use: serve docs/ on http://localhost:8766, open http://localhost:8766/?sim, then paste this
// file's text into the page (or the browser tool's javascript runner). Prints one line per prayer:
// how it ended, number of steps, steps with no time, and the MATCH summary.
(async () => {
  localStorage.clear();
  let rnd = 11; const noise = () => { rnd = (rnd * 16807) % 2147483647; return 1 + ((rnd / 2147483647) - 0.5) * 0.08; };
  const feed = (w, ms, o = {}) => { for (let i = 0; i < ms; i += 100) { const ww = w == null ? null : w * noise(); __pc.feed(ww, o.yaw ?? 0, undefined, o.hands ?? false, ww == null ? null : { cx: 0.5, cy: o.cy ?? 0.45, h: o.h ?? ww * 1.3 }); } };
  const raise = (w = 0.3, cy) => { feed(w, 600, { hands: true, cy }); feed(w, 500, { cy }); };
  const salam = (w = 0.3, cy) => { feed(w, 12000, { cy }); feed(w, 1000, { yaw: 0.5, cy }); feed(w, 600, { cy }); feed(w, 1000, { yaw: -0.5, cy }); };
  const start = async (key, posture, w = 0.3, cy) => { document.querySelector(`[data-posture="${posture}"]`).click(); document.querySelector(`[data-key="${key}"]`).click(); await new Promise((r) => setTimeout(r, 30)); feed(w, 3500, { cy }); feed(w, 1500, { hands: true, cy }); };
  const sum = () => { const h = __pc.history()[0]; const m = h.trace.match; return `${h.how} steps=${h.segs.length} dashes=${h.segs.filter((s) => s.end - s.start < 300).length} ${m.slice(m.indexOf("|") + 2)}`; };
  const done = () => document.getElementById("rHome").click();
  const rak = () => { raise(); feed(0.42, 6000); feed(0.3, 300); raise(); feed(0.3, 2000); feed(0.45, 1000, { cy: 0.7 }); feed(null, 2500); feed(0.45, 4000, { cy: 0.7 }); feed(0.3, 4000); feed(0.45, 1000, { cy: 0.7 }); feed(null, 2500); feed(0.45, 4000, { cy: 0.7 }); };
  const plain = () => { feed(0.42, 6000); feed(0.3, 3000); feed(0.45, 8000); feed(null, 1500); feed(0.3, 5000); feed(0.45, 9000); };
  const standRak = () => { raise(0.12, 0.25); feed(0.20, 6000, { cy: 0.45 }); feed(0.12, 300, { cy: 0.25 }); raise(0.12, 0.25); feed(0.12, 2000, { cy: 0.25 }); feed(0.35, 1500, { cy: 0.75 }); feed(null, 6000); feed(0.21, 5000, { cy: 0.55 }); feed(0.36, 1000, { cy: 0.78 }); feed(null, 7000); };
  const chairRak = () => { raise(0.13, 0.42); feed(0.2, 6000, { cy: 0.55 }); feed(0.13, 300, { cy: 0.42 }); raise(0.13, 0.42); feed(0.13, 2000, { cy: 0.42 }); feed(0.25, 1500, { cy: 0.7 }); feed(null, 3000); feed(0.13, 3000, { cy: 0.42 }); feed(0.25, 1000, { cy: 0.7 }); feed(null, 3000); };
  const out = {};
  await start("dhuhr", "sit"); feed(0.3, 30000); rak(); feed(0.3, 30000); rak(); feed(0.3, 15000); raise(); feed(0.3, 30000); rak(); feed(0.3, 30000); rak(); salam(); out.dhuhrRaises = sum(); done();
  await start("dhuhr", "sit"); feed(0.3, 30000); plain(); feed(0.3, 30000); plain(); feed(0.3, 20000); feed(0.3, 30000); plain(); feed(0.3, 30000); plain(); salam(); out.dhuhrNoRaises = sum(); done();
  await start("fajr", "sit"); feed(0.3, 30000); raise(); feed(0.31, 6000); raise(); feed(0.3, 2000); feed(0.45, 1000, { cy: 0.7 }); feed(null, 2500); feed(0.45, 4000, { cy: 0.7 }); feed(0.3, 4000); feed(0.45, 1000, { cy: 0.7 }); feed(null, 2500); feed(0.45, 4000, { cy: 0.7 }); feed(0.3, 30000); rak(); salam(); out.missedRukuTwoRaises = sum(); done();
  await start("fajr", "sit"); feed(0.3, 30000); raise(); feed(0.42, 6000); feed(0.3, 300); raise(); feed(0.3, 2000); feed(0.45, 1000, { cy: 0.7 }); feed(null, 2500); feed(0.45, 4000, { cy: 0.7 }); feed(0.3, 4000); feed(0.31, 4000); feed(0.3, 30000); rak(); salam(); out.missedSujood2 = sum(); done();
  await start("fajr", "sit"); feed(0.3, 15000); feed(0.45, 500); feed(0.3, 15000); raise(); feed(0.42, 6000); feed(0.3, 300); raise(); feed(0.3, 2000); feed(0.45, 3000, { cy: 0.7 }); feed(0.27, 600, { cy: 0.7 }); feed(0.45, 3000, { cy: 0.7 }); feed(0.3, 4000); feed(0.45, 1000, { cy: 0.7 }); feed(null, 2500); feed(0.45, 4000, { cy: 0.7 }); feed(0.3, 30000); rak(); salam(); out.twitches = sum(); done();
  await start("fajr", "sit"); feed(0.3, 30000); raise(); feed(0.42, 6000); feed(0.3, 200); feed(0.3, 600, { hands: true }); feed(0.45, 1000, { cy: 0.7 }); feed(null, 2500); feed(0.45, 4000, { cy: 0.7 }); feed(0.3, 4000); feed(0.45, 1000, { cy: 0.7 }); feed(null, 2500); feed(0.45, 4000, { cy: 0.7 }); feed(0.3, 30000); rak(); salam(); out.quickRiseAfterRaise = sum(); done();
  await start("fajr", "stand", 0.12, 0.25); feed(0.12, 30000, { cy: 0.25 }); standRak(); feed(0.12, 30000, { cy: 0.25 }); standRak(); salam(0.21, 0.55); out.standing = sum(); done();
  await start("dhuhr", "mixed", 0.12, 0.12); feed(0.12, 30000, { cy: 0.12 }); standRak(); feed(0.12, 2000, { cy: 0.12 }); feed(0.13, 1000, { cy: 0.3 }); feed(0.13, 30000, { cy: 0.42 }); chairRak(); feed(0.13, 15000, { cy: 0.42 }); raise(0.13, 0.42); feed(0.13, 30000, { cy: 0.42 }); chairRak(); feed(0.13, 30000, { cy: 0.42 }); chairRak(); salam(0.13, 0.42); out.mixedFaceSeenStanding = sum(); done();
  await start("fajr", "sit"); feed(0.3, 30000); rak(); feed(0.3, 30000); raise(); feed(0.42, 6000); feed(0.3, 300); raise(); feed(0.3, 40000); feed(0.45, 1000, { cy: 0.7 }); feed(null, 2500); feed(0.45, 4000, { cy: 0.7 }); feed(0.3, 4000); feed(0.45, 1000, { cy: 0.7 }); feed(null, 2500); feed(0.45, 4000, { cy: 0.7 }); salam(); out.fajrQunut = sum(); done();
  localStorage.clear();
  console.log(out);
  return out;
})();
// v7 results (all salam, nothing missed/extra unless noted):
// dhuhrRaises 26 steps; dhuhrNoRaises 26 (1 dash: rak'ah 3 reading, no stand-up raise);
// missedRukuTwoRaises 13 (missed 1, ruku timed between raises); missedSujood2 13 (missed 1);
// twitches 13; quickRiseAfterRaise 13; standing 13; mixedFaceSeenStanding 26 (sat down);
// fajrQunut 13.
