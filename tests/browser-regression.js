// Browser regression: simulated prayers through the whole app.
// Use: serve docs/ on http://localhost:8766, open http://localhost:8766/?sim, then paste this
// file's text into the page (or the browser tool's javascript runner, with "await" in front).
// Prints one line per prayer: how it ended, number of steps, steps with no time, and the MATCH line.
(async () => {
  localStorage.clear();
  let rnd = 11; const noise = () => { rnd = (rnd * 16807) % 2147483647; return 1 + ((rnd / 2147483647) - 0.5) * 0.08; };
  // o: cy (face height in the picture), hands (both hands up), yaw (head turn), sh (shoulders {sy, sw}),
  // arms (true/false: the body tool is seen, with both arms up or not)
  const feed = (w, ms, o = {}) => {
    for (let i = 0; i < ms; i += 100) {
      const ww = w == null ? null : w * noise();
      const s = o.sh ? { sy: o.sh.sy, sw: o.sh.sw * (1 + (noise() - 1) / 2) } : null;
      const b = o.arms == null ? null : { up: { x: 0, y: -1, z: 0 }, raised: false, armsUp: o.arms, yaw: 0, head: true, hips: false, feet: false, lm: null };
      __pc.feed(ww, o.yaw ?? 0, undefined, o.hands ?? false, ww == null ? null : { cx: 0.5, cy: o.cy ?? 0.45, h: o.h ?? ww * 1.3 }, s, b);
    }
  };
  const raise = (w = 0.3, cy, sh) => { feed(w, 600, { hands: true, cy, sh }); feed(w, 500, { cy, sh }); };
  const salam = (w = 0.3, cy, sh) => { feed(w, 12000, { cy, sh }); feed(w, 1000, { yaw: 0.5, cy, sh }); feed(w, 600, { cy, sh }); feed(w, 1000, { yaw: -0.5, cy, sh }); };
  const start = async (key, posture, w = 0.3, cy) => { document.querySelector(`[data-posture="${posture}"]`).click(); document.querySelector(`[data-key="${key}"]`).click(); await new Promise((r) => setTimeout(r, 30)); feed(w, 3500, { cy }); feed(w, 1500, { hands: true, cy }); };
  const sum = () => {
    let note = "";
    if (__pc.state().mode === "pray") { note = `NOT ENDED (on "${__pc.state().step} ${__pc.state().group}") `; document.getElementById("btnStop").click(); }
    const h = __pc.history()[0];
    return `${note}${h.how} steps=${h.segs.length} dashes=${h.segs.filter((s) => s.end - s.start < 300).length} ${h.trace.match}`;
  };
  const done = () => document.getElementById("rHome").click();
  const rak = () => { raise(); feed(0.42, 6000); feed(0.3, 300); raise(); feed(0.3, 2000); feed(0.45, 1000, { cy: 0.7 }); feed(null, 2500); feed(0.45, 4000, { cy: 0.7 }); feed(0.3, 4000); feed(0.45, 1000, { cy: 0.7 }); feed(null, 2500); feed(0.45, 4000, { cy: 0.7 }); };
  const plain = () => { feed(0.42, 6000); feed(0.3, 3000); feed(0.45, 8000); feed(null, 1500); feed(0.3, 5000); feed(0.45, 9000); };
  const standRak = () => { raise(0.12, 0.25); feed(0.20, 6000, { cy: 0.45 }); feed(0.12, 300, { cy: 0.25 }); raise(0.12, 0.25); feed(0.12, 2000, { cy: 0.25 }); feed(0.35, 1500, { cy: 0.75 }); feed(null, 6000); feed(0.21, 5000, { cy: 0.55 }); feed(0.36, 1000, { cy: 0.78 }); feed(null, 7000); };
  const chairRak = () => { raise(0.13, 0.42); feed(0.2, 6000, { cy: 0.55 }); feed(0.13, 300, { cy: 0.42 }); raise(0.13, 0.42); feed(0.13, 2000, { cy: 0.42 }); feed(0.25, 1500, { cy: 0.7 }); feed(null, 3000); feed(0.13, 3000, { cy: 0.42 }); feed(0.25, 1000, { cy: 0.7 }); feed(null, 3000); };
  const out = {};

  // ---- sitting, standing, and v7-style "first rak'ah standing" (phone sees him standing) ----
  await start("dhuhr", "sit"); feed(0.3, 30000); rak(); feed(0.3, 30000); rak(); feed(0.3, 15000); raise(); feed(0.3, 30000); rak(); feed(0.3, 30000); rak(); salam(); out.dhuhrRaises = sum(); done();
  await start("dhuhr", "sit"); feed(0.3, 30000); plain(); feed(0.3, 30000); plain(); feed(0.3, 20000); feed(0.3, 30000); plain(); feed(0.3, 30000); plain(); salam(); out.dhuhrNoRaises = sum(); done();
  await start("fajr", "sit"); feed(0.3, 30000); raise(); feed(0.31, 6000); raise(); feed(0.3, 2000); feed(0.45, 1000, { cy: 0.7 }); feed(null, 2500); feed(0.45, 4000, { cy: 0.7 }); feed(0.3, 4000); feed(0.45, 1000, { cy: 0.7 }); feed(null, 2500); feed(0.45, 4000, { cy: 0.7 }); feed(0.3, 30000); rak(); salam(); out.missedRukuTwoRaises = sum(); done();
  await start("fajr", "sit"); feed(0.3, 30000); raise(); feed(0.42, 6000); feed(0.3, 300); raise(); feed(0.3, 2000); feed(0.45, 1000, { cy: 0.7 }); feed(null, 2500); feed(0.45, 4000, { cy: 0.7 }); feed(0.3, 4000); feed(0.31, 4000); feed(0.3, 30000); rak(); salam(); out.missedSujood2 = sum(); done();
  await start("fajr", "sit"); feed(0.3, 15000); feed(0.45, 500); feed(0.3, 15000); raise(); feed(0.42, 6000); feed(0.3, 300); raise(); feed(0.3, 2000); feed(0.45, 3000, { cy: 0.7 }); feed(0.27, 600, { cy: 0.7 }); feed(0.45, 3000, { cy: 0.7 }); feed(0.3, 4000); feed(0.45, 1000, { cy: 0.7 }); feed(null, 2500); feed(0.45, 4000, { cy: 0.7 }); feed(0.3, 30000); rak(); salam(); out.twitches = sum(); done();
  await start("fajr", "sit"); feed(0.3, 30000); raise(); feed(0.42, 6000); feed(0.3, 200); feed(0.3, 600, { hands: true }); feed(0.45, 1000, { cy: 0.7 }); feed(null, 2500); feed(0.45, 4000, { cy: 0.7 }); feed(0.3, 4000); feed(0.45, 1000, { cy: 0.7 }); feed(null, 2500); feed(0.45, 4000, { cy: 0.7 }); feed(0.3, 30000); rak(); salam(); out.quickRiseAfterRaise = sum(); done();
  await start("fajr", "stand", 0.12, 0.25); feed(0.12, 30000, { cy: 0.25 }); standRak(); feed(0.12, 30000, { cy: 0.25 }); standRak(); salam(0.21, 0.55); out.standing = sum(); done();
  await start("dhuhr", "mixed", 0.12, 0.12); feed(0.12, 30000, { cy: 0.12 }); standRak(); feed(0.12, 2000, { cy: 0.12 }); feed(0.13, 1000, { cy: 0.3 }); feed(0.13, 30000, { cy: 0.42 }); chairRak(); feed(0.13, 15000, { cy: 0.42 }); raise(0.13, 0.42); feed(0.13, 30000, { cy: 0.42 }); chairRak(); feed(0.13, 30000, { cy: 0.42 }); chairRak(); salam(0.13, 0.42); out.mixedFaceSeenStanding = sum(); done();
  await start("fajr", "sit"); feed(0.3, 30000); rak(); feed(0.3, 30000); raise(); feed(0.42, 6000); feed(0.3, 300); raise(); feed(0.3, 40000); feed(0.45, 1000, { cy: 0.7 }); feed(null, 2500); feed(0.45, 4000, { cy: 0.7 }); feed(0.3, 4000); feed(0.45, 1000, { cy: 0.7 }); feed(null, 2500); feed(0.45, 4000, { cy: 0.7 }); salam(); out.fajrQunut = sum(); done();

  // ---- v8: "first rak'ah standing" with the phone set for sitting ----
  // sit and learn the face, then stand up: the face leaves through the top (the clock starts then)
  const startMixed = async (key) => { document.querySelector('[data-posture="mixed"]').click(); document.querySelector(`[data-key="${key}"]`).click(); await new Promise((r) => setTimeout(r, 30)); feed(0.13, 3500, { cy: 0.42 }); feed(0.13, 2000, { cy: 0.42 }); feed(0.15, 300, { cy: 0.47 }); feed(0.13, 200, { cy: 0.2 }); feed(0.13, 100, { cy: 0.08 }); };
  // sit down: the face comes in from the top and rests at its sitting place for `rest` ms
  const sitDown = (rest) => { feed(0.13, 100, { cy: 0.1 }); feed(0.14, 300, { cy: 0.3 }); feed(0.13, rest, { cy: 0.42 }); };
  const sujoods = () => { feed(0.25, 1500, { cy: 0.7 }); feed(null, 3000); feed(0.13, 3000, { cy: 0.42 }); feed(0.25, 1000, { cy: 0.7 }); feed(null, 3000); };
  const rest2 = () => { feed(0.13, 30000, { cy: 0.42 }); chairRak(); salam(0.13, 0.42); };
  // A: reading and ruku standing (out of the picture), sit down, the two sujoods
  await startMixed("fajr"); feed(null, 49000); sitDown(1000); sujoods(); rest2(); out.mixedA_rukuUnseen = sum(); done();
  // A, the standing ruku showed for a moment: the face came in from the top (big) and went back up
  await startMixed("fajr"); feed(null, 40000); feed(0.2, 100, { cy: 0.1 }); feed(0.22, 2500, { cy: 0.6 }); feed(0.18, 200, { cy: 0.2 }); feed(0.15, 100, { cy: 0.08 }); feed(null, 4000); sitDown(1000); sujoods(); rest2(); out.mixedA_rukuSeen = sum(); done();
  // B: reading standing, sit down, then takbeer, ruku, "sami' Allahu", sujood, sujood on the chair
  await startMixed("fajr"); feed(null, 40000); sitDown(2000); chairRak(); rest2(); out.mixedB = sum(); done();
  // A, sat down and went to sujood after half a second / with no rest at all
  await startMixed("fajr"); feed(null, 49000); sitDown(500); sujoods(); rest2(); out.mixedA_quickSujood = sum(); done();
  await startMixed("fajr"); feed(null, 49000); sitDown(0); sujoods(); rest2(); out.mixedA_noRest = sum(); done();
  // A, while standing the face keeps showing at the top edge (cut off) and going again: not a ruku
  await startMixed("fajr"); for (let i = 0; i < 16; i++) { feed(0.11, 1000, { cy: 0.05 }); feed(null, 1500); } feed(null, 9000); sitDown(1000); sujoods(); rest2(); out.mixedA_topFlicker = sum(); done();
  // A, but sitting down 30% farther back / 30% closer than when the face was learned
  const sitAt = (w, cy, rest) => { feed(w, 100, { cy: 0.1 }); feed(w, 300, { cy: cy - 0.12 }); feed(w, rest, { cy }); };
  const sujoodsAt = (w, cy) => { feed(w * 1.9, 1500, { cy: cy + 0.28 }); feed(null, 3000); feed(w, 3000, { cy }); feed(w * 1.9, 1000, { cy: cy + 0.28 }); feed(null, 3000); };
  const restAt = (w, cy) => { feed(w, 30000, { cy }); raise(w, cy); feed(w * 1.5, 6000, { cy: cy + 0.13 }); feed(w, 300, { cy }); raise(w, cy); feed(w, 2000, { cy }); sujoodsAt(w, cy); salam(w, cy); };
  await startMixed("fajr"); feed(null, 49000); sitAt(0.09, 0.40, 1000); sujoodsAt(0.09, 0.40); restAt(0.09, 0.40); out.mixedA_satFartherBack = sum(); done();
  await startMixed("fajr"); feed(null, 49000); sitAt(0.17, 0.45, 1000); sujoodsAt(0.17, 0.45); restAt(0.17, 0.45); out.mixedA_satCloser = sum(); done();
  // A, the standing ruku showed and he straightened up too fast: the face was lost in the middle of the picture
  await startMixed("fajr"); feed(null, 40000); feed(0.2, 100, { cy: 0.1 }); feed(0.22, 2500, { cy: 0.6 }); feed(0.16, 200, { cy: 0.3 }); feed(null, 6000); sitDown(1000); sujoods(); rest2(); out.mixedA_rukuSeenLostMidway = sum(); done();
  // A, the standing ruku seen at about the sitting size, held still 2 s / 1 s (looks like sitting for a moment)
  const rukuChairLike = (ms) => { feed(0.14, 100, { cy: 0.1 }); feed(0.14, 300, { cy: 0.35 }); feed(0.14, ms, { cy: 0.5 }); feed(0.14, 200, { cy: 0.25 }); feed(0.13, 100, { cy: 0.08 }); };
  await startMixed("fajr"); feed(null, 40000); rukuChairLike(2000); feed(null, 4000); sitDown(1000); sujoods(); rest2(); out.mixedA_rukuChairLike2s = sum(); done();
  await startMixed("fajr"); feed(null, 40000); rukuChairLike(1000); feed(null, 4000); sitDown(1000); sujoods(); rest2(); out.mixedA_rukuChairLike1s = sum(); done();
  // B, after sitting down the face is lost for 3.5 s a bit above the sitting place: still sitting
  await startMixed("fajr"); feed(null, 40000); sitDown(2000); feed(0.13, 300, { cy: 0.37 }); feed(null, 3500); feed(0.13, 1000, { cy: 0.42 }); chairRak(); rest2(); out.mixedB_faceLostAfterSit = sum(); done();
  // A, with the sitting face right at the top edge of the picture (bad placement): still works
  const startMixedTop = async (key) => { document.querySelector('[data-posture="mixed"]').click(); document.querySelector(`[data-key="${key}"]`).click(); await new Promise((r) => setTimeout(r, 30)); feed(0.13, 3500, { cy: 0.1 }); feed(0.13, 2000, { cy: 0.1 }); feed(0.15, 300, { cy: 0.14 }); feed(0.13, 100, { cy: 0.08 }); };
  await startMixedTop("fajr"); feed(null, 49000); feed(0.13, 100, { cy: 0.06 }); feed(0.13, 1000, { cy: 0.1 }); feed(0.25, 1500, { cy: 0.38 }); feed(null, 3000); feed(0.13, 3000, { cy: 0.1 }); feed(0.25, 1000, { cy: 0.38 }); feed(null, 3000); feed(0.13, 30000, { cy: 0.1 }); raise(0.13, 0.1); feed(0.2, 6000, { cy: 0.23 }); feed(0.13, 300, { cy: 0.1 }); raise(0.13, 0.1); feed(0.13, 2000, { cy: 0.1 }); feed(0.25, 1500, { cy: 0.38 }); feed(null, 3000); feed(0.13, 3000, { cy: 0.1 }); feed(0.25, 1000, { cy: 0.38 }); feed(null, 3000); salam(0.13, 0.1); out.mixedA_seatAtTopEdge = sum(); done();
  // like the Dhuhr record of 19 Oct (v10): standing, the face peeks in at the top edge (sitting size,
  // y 0.12-0.2) instead of leaving; the standing ruku shows as a big face looking down at the phone
  // (2.7x, y 0.55) for 7 s; then he sits down, rests 4 s, and does the two sujoods
  const startMixedPeek = async (key) => { document.querySelector('[data-posture="mixed"]').click(); document.querySelector(`[data-key="${key}"]`).click(); await new Promise((r) => setTimeout(r, 30)); feed(0.13, 3500, { cy: 0.42 }); feed(0.13, 2000, { cy: 0.42 }); feed(0.15, 300, { cy: 0.47 }); feed(0.13, 300, { cy: 0.25 }); };
  await startMixedPeek("fajr"); for (let i = 0; i < 12; i++) { feed(0.13, 2000, { cy: 0.15 }); feed(null, 400); }
  feed(0.35, 7000, { cy: 0.55 }); feed(0.13, 300, { cy: 0.2 }); feed(null, 600); feed(0.13, 2000, { cy: 0.15 });
  feed(0.14, 300, { cy: 0.3 }); feed(0.13, 4000, { cy: 0.42 }); sujoods(); rest2(); out.mixedA_peekAtTop_bigRuku = sum(); done();
  // a Dhuhr, case A, with the middle tashahhud and rak'ahs 3 and 4
  await startMixed("dhuhr"); feed(null, 49000); sitDown(1000); sujoods(); feed(0.13, 30000, { cy: 0.42 }); chairRak(); feed(0.13, 15000, { cy: 0.42 }); raise(0.13, 0.42); feed(0.13, 30000, { cy: 0.42 }); chairRak(); feed(0.13, 30000, { cy: 0.42 }); chairRak(); salam(0.13, 0.42); out.mixedA_dhuhr = sum(); done();

  // ---- v8: shoulders (sitting) ----
  const up = { sy: 0.85, sw: 0.5 }, ruku = { sy: 0.88, sw: 0.68 }, suj = { sy: 0.97, sw: 0.66 };
  // a ruku the face hardly shows (size +3%, no drop) but the shoulders do
  const shRak = (sh) => { raise(0.3, 0.45, sh && up); feed(0.31, 5000, { cy: 0.47, sh: sh && ruku }); feed(0.3, 300, { sh: sh && up }); raise(0.3, 0.45, sh && up); feed(0.3, 2000, { sh: sh && up }); feed(0.45, 1000, { cy: 0.7, sh: sh && suj }); feed(null, 2500, { sh: sh && suj }); feed(0.45, 3000, { cy: 0.7, sh: sh && suj }); feed(0.3, 3000, { sh: sh && up }); feed(0.45, 1000, { cy: 0.7, sh: sh && suj }); feed(null, 2500, { sh: sh && suj }); feed(0.45, 3000, { cy: 0.7, sh: sh && suj }); };
  await start("fajr", "sit"); feed(0.3, 30000, { sh: up }); shRak(true); feed(0.3, 30000, { sh: up }); shRak(true); salam(0.3, 0.45, up); out.shouldersRuku = sum(); done();
  await start("fajr", "sit"); feed(0.3, 30000); shRak(false); feed(0.3, 30000); shRak(false); salam(); out.sameWithoutShoulders = sum(); done();
  // the normal sitting Dhuhr with the shoulders seen, moving with every bow: nothing may change
  const shFeed = (w, ms, o = {}) => feed(w, ms, { ...o, sh: w == null || (o.cy ?? 0.45) > 0.6 ? suj : w > 0.35 ? ruku : up });
  const shRakAll = () => { raise(0.3, 0.45, up); shFeed(0.42, 6000); shFeed(0.3, 300); raise(0.3, 0.45, up); shFeed(0.3, 2000); shFeed(0.45, 1000, { cy: 0.7 }); shFeed(null, 2500); shFeed(0.45, 4000, { cy: 0.7 }); shFeed(0.3, 4000); shFeed(0.45, 1000, { cy: 0.7 }); shFeed(null, 2500); shFeed(0.45, 4000, { cy: 0.7 }); };
  await start("dhuhr", "sit"); shFeed(0.3, 30000); shRakAll(); shFeed(0.3, 30000); shRakAll(); shFeed(0.3, 15000); raise(0.3, 0.45, up); shFeed(0.3, 30000); shRakAll(); shFeed(0.3, 30000); shRakAll(); salam(0.3, 0.45, up); out.dhuhrWithShoulders = sum(); done();
  // v12: the takbeers and "sami' Allahu" raises too quick for the hand tool, seen only by the body tool's arms
  { const armsRaise = () => { feed(0.3, 500, { arms: true }); feed(0.3, 400, { arms: false }); };
    const armsRak = () => { armsRaise(); feed(0.42, 6000, { arms: false }); feed(0.3, 300, { arms: false }); armsRaise(); feed(0.3, 2000, { arms: false }); feed(0.45, 1000, { cy: 0.7, arms: false }); feed(null, 2500, { arms: false }); feed(0.45, 4000, { cy: 0.7, arms: false }); feed(0.3, 4000, { arms: false }); feed(0.45, 1000, { cy: 0.7, arms: false }); feed(null, 2500, { arms: false }); feed(0.45, 4000, { cy: 0.7, arms: false }); };
    await start("fajr", "sit"); feed(0.3, 30000, { arms: false }); armsRak(); feed(0.3, 30000, { arms: false }); armsRak(); salam();
    const ev = __pc.history()[0]?.trace.events || "";
    out.armsOnlyRaises = `${sum()} | raises by the arms: ${(ev.match(/raise \(arms\)/g) || []).length}`; done(); }
  // a sujood with the face hidden 6 s: the shoulders come back up 1.5 s before the face is found
  await start("fajr", "sit"); feed(0.3, 30000, { sh: up }); shRak(true); feed(0.3, 30000, { sh: up }); raise(0.3, 0.45, up); feed(0.42, 6000, { sh: ruku }); feed(0.3, 300, { sh: up }); raise(0.3, 0.45, up); feed(0.3, 2000, { sh: up }); feed(0.45, 1000, { cy: 0.7, sh: suj }); feed(null, 4500, { sh: suj }); feed(null, 1500, { sh: up }); feed(0.3, 3000, { sh: up }); feed(0.45, 1000, { cy: 0.7, sh: suj }); feed(null, 2500, { sh: suj }); feed(0.45, 3000, { cy: 0.7, sh: suj }); salam(0.3, 0.45, up); out.faceHiddenShouldersUp = sum(); done();

  localStorage.clear();
  console.log(out);
  return out;
})();
// Results (all end with the salam, nothing missed/extra unless noted).
// v7, unchanged in v8 (same bows and times; v8 checked against v7 side by side):
// dhuhrRaises 26 steps; dhuhrNoRaises 26 (1 dash: rak'ah 3 reading, no stand-up raise);
// missedRukuTwoRaises 13 (missed 1, ruku timed between raises); missedSujood2 13 (missed 1);
// twitches 13; quickRiseAfterRaise 13; standing 13; mixedFaceSeenStanding 26 (sat down);
// fajrQunut 13.
// v8: mixedA_rukuUnseen 13 (missed 1 = rak'ah 1 ruku, 2 dashes, sat down 49.1 s);
// mixedA_rukuSeen 13 (the standing ruku counted, sat down 47.0 s); mixedB 13 (sat down 40.1 s);
// mixedA_quickSujood and mixedA_noRest 13 (missed 1); mixedA_topFlicker 13 (missed 1, no extra);
// mixedA_satFartherBack and mixedA_satCloser 13 (missed 1); mixedA_rukuSeenLostMidway 13 (missed 0);
// mixedA_rukuChairLike2s and 1s 13 (missed 0: the ruku counted); mixedB_faceLostAfterSit 13 (missed 0);
// mixedA_seatAtTopEdge 13 (missed 1); v11: mixedA_peekAtTop_bigRuku 13 (missed 0, the standing ruku counted);
// mixedA_dhuhr 26 (missed 1); shouldersRuku 13 (sameWithoutShoulders: missed 2);
// dhuhrWithShoulders 26; faceHiddenShouldersUp 13 (that sujood ends when the shoulders come up).
// v12: armsOnlyRaises 13 (missed 0) with 4 raises by the arms.
