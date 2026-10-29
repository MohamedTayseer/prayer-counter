// The automatic mode ("تلقائي", v13): no way of praying is chosen and nothing is learned before the
// prayer. Use: open the app with ?sim, paste this file, then `await autoTests()` (or run
// browser-all.js). Each line: how it ended, steps, steps with no time, and the MATCH line; the
// sitting ones must match the same prayers in the "sit" mode (browser-regression.js).
window.autoTests = async () => {
  localStorage.clear();
  let rnd = 11; const noise = () => { rnd = (rnd * 16807) % 2147483647; return 1 + ((rnd / 2147483647) - 0.5) * 0.08; };
  // o: cy, h, hands (both up), yaw, sh (shoulders), arms (body tool seen with both arms up or not)
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
  const sum = () => {
    let note = "";
    if (__pc.state().mode === "pray") { note = `NOT ENDED (on "${__pc.state().step} ${__pc.state().group}") `; document.getElementById("btnStop").click(); }
    const h = __pc.history()[0];
    const ev = h.trace.events;
    const n = (re) => (ev.match(re) || []).length;
    const extra = [n(/stood up/g) && `stood up x${n(/stood up/g)}`, n(/; \d+:sat down/g) && `sat down x${n(/; \d+:sat down/g)}`, n(/undo: sat down/g) && `undo sit x${n(/undo: sat down/g)}`].filter(Boolean).join(", ");
    return `${note}${h.how} steps=${h.segs.length} dashes=${h.segs.filter((s) => s.end - s.start < 300).length} ${h.trace.match}${extra ? ` | ${extra}` : ""}`;
  };
  const done = () => document.getElementById("rHome").click();
  // the automatic mode; o.place = "front" (default) or "lap"
  const go = async (key, o = {}) => {
    document.querySelector('[data-posture="auto"]').click();
    document.querySelector(`[data-place="${o.place || "front"}"]`).click();
    document.querySelector(`[data-key="${key}"]`).click();
    await new Promise((r) => setTimeout(r, 30));
  };
  const out = {};

  // ---- sitting prayers: the same simulated prayers as in the "sit" mode (the 3.5 s that were the
  // learning there are now just waiting for the takbeer) ----
  const start = async (key, w = 0.3, cy, o) => { await go(key, o); feed(w, 3500, { cy }); feed(w, 1500, { hands: true, cy }); };
  const rak = () => { raise(); feed(0.42, 6000); feed(0.3, 300); raise(); feed(0.3, 2000); feed(0.45, 1000, { cy: 0.7 }); feed(null, 2500); feed(0.45, 4000, { cy: 0.7 }); feed(0.3, 4000); feed(0.45, 1000, { cy: 0.7 }); feed(null, 2500); feed(0.45, 4000, { cy: 0.7 }); };
  const plain = () => { feed(0.42, 6000); feed(0.3, 3000); feed(0.45, 8000); feed(null, 1500); feed(0.3, 5000); feed(0.45, 9000); };
  await start("dhuhr"); feed(0.3, 30000); rak(); feed(0.3, 30000); rak(); feed(0.3, 15000); raise(); feed(0.3, 30000); rak(); feed(0.3, 30000); rak(); salam(); out.dhuhrRaises = sum(); done();
  await start("dhuhr"); feed(0.3, 30000); plain(); feed(0.3, 30000); plain(); feed(0.3, 20000); feed(0.3, 30000); plain(); feed(0.3, 30000); plain(); salam(); out.dhuhrNoRaises = sum(); done();
  await start("fajr"); feed(0.3, 30000); raise(); feed(0.31, 6000); raise(); feed(0.3, 2000); feed(0.45, 1000, { cy: 0.7 }); feed(null, 2500); feed(0.45, 4000, { cy: 0.7 }); feed(0.3, 4000); feed(0.45, 1000, { cy: 0.7 }); feed(null, 2500); feed(0.45, 4000, { cy: 0.7 }); feed(0.3, 30000); rak(); salam(); out.missedRukuTwoRaises = sum(); done();
  await start("fajr"); feed(0.3, 30000); raise(); feed(0.42, 6000); feed(0.3, 300); raise(); feed(0.3, 2000); feed(0.45, 1000, { cy: 0.7 }); feed(null, 2500); feed(0.45, 4000, { cy: 0.7 }); feed(0.3, 4000); feed(0.31, 4000); feed(0.3, 30000); rak(); salam(); out.missedSujood2 = sum(); done();
  await start("fajr"); feed(0.3, 15000); feed(0.45, 500); feed(0.3, 15000); raise(); feed(0.42, 6000); feed(0.3, 300); raise(); feed(0.3, 2000); feed(0.45, 3000, { cy: 0.7 }); feed(0.27, 600, { cy: 0.7 }); feed(0.45, 3000, { cy: 0.7 }); feed(0.3, 4000); feed(0.45, 1000, { cy: 0.7 }); feed(null, 2500); feed(0.45, 4000, { cy: 0.7 }); feed(0.3, 30000); rak(); salam(); out.twitches = sum(); done();
  await start("fajr"); feed(0.3, 30000); raise(); feed(0.42, 6000); feed(0.3, 200); feed(0.3, 600, { hands: true }); feed(0.45, 1000, { cy: 0.7 }); feed(null, 2500); feed(0.45, 4000, { cy: 0.7 }); feed(0.3, 4000); feed(0.45, 1000, { cy: 0.7 }); feed(null, 2500); feed(0.45, 4000, { cy: 0.7 }); feed(0.3, 30000); rak(); salam(); out.quickRiseAfterRaise = sum(); done();
  await start("fajr"); feed(0.3, 30000); rak(); feed(0.3, 30000); raise(); feed(0.42, 6000); feed(0.3, 300); raise(); feed(0.3, 40000); feed(0.45, 1000, { cy: 0.7 }); feed(null, 2500); feed(0.45, 4000, { cy: 0.7 }); feed(0.3, 4000); feed(0.45, 1000, { cy: 0.7 }); feed(null, 2500); feed(0.45, 4000, { cy: 0.7 }); salam(); out.fajrQunut = sum(); done();
  const up = { sy: 0.85, sw: 0.5 }, ruku = { sy: 0.88, sw: 0.68 }, suj = { sy: 0.97, sw: 0.66 };
  const shRak = (sh) => { raise(0.3, 0.45, sh && up); feed(0.31, 5000, { cy: 0.47, sh: sh && ruku }); feed(0.3, 300, { sh: sh && up }); raise(0.3, 0.45, sh && up); feed(0.3, 2000, { sh: sh && up }); feed(0.45, 1000, { cy: 0.7, sh: sh && suj }); feed(null, 2500, { sh: sh && suj }); feed(0.45, 3000, { cy: 0.7, sh: sh && suj }); feed(0.3, 3000, { sh: sh && up }); feed(0.45, 1000, { cy: 0.7, sh: sh && suj }); feed(null, 2500, { sh: sh && suj }); feed(0.45, 3000, { cy: 0.7, sh: sh && suj }); };
  await start("fajr"); feed(0.3, 30000, { sh: up }); shRak(true); feed(0.3, 30000, { sh: up }); shRak(true); salam(0.3, 0.45, up); out.shouldersRuku = sum(); done();
  { const armsRaise = () => { feed(0.3, 500, { arms: true }); feed(0.3, 400, { arms: false }); };
    const armsRak = () => { armsRaise(); feed(0.42, 6000, { arms: false }); feed(0.3, 300, { arms: false }); armsRaise(); feed(0.3, 2000, { arms: false }); feed(0.45, 1000, { cy: 0.7, arms: false }); feed(null, 2500, { arms: false }); feed(0.45, 4000, { cy: 0.7, arms: false }); feed(0.3, 4000, { arms: false }); feed(0.45, 1000, { cy: 0.7, arms: false }); feed(null, 2500, { arms: false }); feed(0.45, 4000, { cy: 0.7, arms: false }); };
    await start("fajr"); feed(0.3, 30000, { arms: false }); armsRak(); feed(0.3, 30000, { arms: false }); armsRak(); salam(); out.armsOnlyRaises = sum(); done(); }
  // on the lap: the face big and high in the picture (it touches the top edge) - never "standing"
  await start("fajr", 0.3, 0.2, { place: "lap" }); feed(0.3, 30000, { cy: 0.2 }); feed(0.3, 1500, { cy: 0.1 }); feed(null, 2000); feed(0.3, 30000, { cy: 0.2 }); rak(); feed(0.3, 30000, { cy: 0.2 }); rak(); salam(0.3, 0.2); out.lapHighFace = sum(); done();
  // sitting: leaned forward to tap the phone (face big and low), then sat back and made the takbeer
  await go("fajr"); feed(0.42, 1500, { cy: 0.6 }); feed(0.3, 2500); feed(0.3, 1500, { hands: true }); feed(0.3, 30000); rak(); feed(0.3, 30000); rak(); salam(); out.sitAfterTapping = sum(); done();
  // sitting, the face goes up and out of the picture for 2 s in the first reading (stretching): taken
  // for standing up, then for sitting down again; the prayer is still counted right
  await start("fajr"); feed(0.3, 10000); feed(0.3, 300, { cy: 0.3 }); feed(0.3, 300, { cy: 0.15 }); feed(0.3, 100, { cy: 0.1 }); feed(null, 2000); feed(0.3, 300, { cy: 0.3 }); feed(0.3, 18000); rak(); feed(0.3, 30000); rak(); salam(); out.sitFaceUpAndOut = sum(); done();

  // ---- first rak'ah standing, phone set for sitting: he taps the phone (bending over it), stands
  // up (the face goes up out of the picture): the clock starts then ----
  const startUp = async (key, o) => { await go(key, o); feed(0.2, 1500, { cy: 0.5 }); feed(0.18, 200, { cy: 0.3 }); feed(0.15, 200, { cy: 0.12 }); feed(0.13, 100, { cy: 0.06 }); };
  const sitDown = (rest) => { feed(0.13, 100, { cy: 0.1 }); feed(0.14, 300, { cy: 0.3 }); feed(0.13, rest, { cy: 0.42 }); };
  const sujoods = () => { feed(0.25, 1500, { cy: 0.7 }); feed(null, 3000); feed(0.13, 3000, { cy: 0.42 }); feed(0.25, 1000, { cy: 0.7 }); feed(null, 3000); };
  const chairRak = () => { raise(0.13, 0.42); feed(0.2, 6000, { cy: 0.55 }); feed(0.13, 300, { cy: 0.42 }); raise(0.13, 0.42); feed(0.13, 2000, { cy: 0.42 }); feed(0.25, 1500, { cy: 0.7 }); feed(null, 3000); feed(0.13, 3000, { cy: 0.42 }); feed(0.25, 1000, { cy: 0.7 }); feed(null, 3000); };
  const rest2 = () => { feed(0.13, 30000, { cy: 0.42 }); chairRak(); salam(0.13, 0.42); };
  // A: reading and ruku standing (out of the picture), sit down, the two sujoods
  await startUp("fajr"); feed(null, 49000); sitDown(1000); sujoods(); rest2(); out.mixedA_rukuUnseen = sum(); done();
  // B: reading standing, sit down, then takbeer, ruku, "sami' Allahu", sujood, sujood on the chair
  await startUp("fajr"); feed(null, 40000); sitDown(2000); chairRak(); rest2(); out.mixedB = sum(); done();
  // A, sat down and went to sujood with no rest at all
  await startUp("fajr"); feed(null, 49000); sitDown(0); sujoods(); rest2(); out.mixedA_noRest = sum(); done();
  // A, the face keeps showing at the top edge while standing (cut off) and going again
  await startUp("fajr"); for (let i = 0; i < 16; i++) { feed(0.11, 1000, { cy: 0.05 }); feed(null, 1500); } feed(null, 9000); sitDown(1000); sujoods(); rest2(); out.mixedA_topFlicker = sum(); done();
  // like the Dhuhr record of 19 Oct: standing, the face peeks in high in the picture (y 0.15); the
  // standing ruku shows as a big face looking down at the phone (2.7x, y 0.55) for 7 s; he rises
  // (peeks again), sits down, rests 4 s and does the two sujoods
  // (peek = the face cut off by the top edge: y 0.1; a peek 0.15 high is just inside the picture; in
  // the record the peeks showed for 0.3-1 s and were gone for 0.3-0.6 s)
  const peekRuku = (py = 0.1, on = 2000, off = 400) => { for (let i = 0; i < 24000 / (on + off); i++) { feed(0.13, on, { cy: py }); feed(null, off); } feed(0.35, 7000, { cy: 0.55 }); feed(0.13, 300, { cy: 0.2 }); feed(null, 600); feed(0.13, 2000, { cy: py }); feed(0.14, 300, { cy: 0.3 }); feed(0.13, 4000, { cy: 0.42 }); sujoods(); rest2(); };
  await startUp("fajr"); peekRuku(); out.mixedA_peek_bigRuku = sum(); done();
  await startUp("fajr"); peekRuku(0.15, 1000, 600); out.mixedA_peekInside_bigRuku = sum(); done();
  // (the same, but never gone long enough or cut off to show standing, and no takbeer seen: the clock
  // only starts when the face goes up after the standing ruku - the ruku is missed)
  await startUp("fajr"); peekRuku(0.15); out.mixedA_peekInsideNeverGone = sum(); done();
  // sitting down, two sujoods, then the face goes up high for half a second while sitting (as at 25 s in
  // the Dhuhr record): still sitting
  await startUp("fajr"); feed(null, 49000); sitDown(1000); sujoods(); feed(0.13, 2000, { cy: 0.42 }); feed(0.14, 600, { cy: 0.15 }); feed(0.13, 28000, { cy: 0.42 }); chairRak(); salam(0.13, 0.42); out.mixedA_headUpAfterSujoods = sum(); done();
  // the standing ruku seen at about the sitting size, held 2 s, then back up (looks like sitting for a moment)
  await startUp("fajr"); feed(null, 40000); feed(0.14, 100, { cy: 0.1 }); feed(0.14, 300, { cy: 0.35 }); feed(0.14, 2000, { cy: 0.5 }); feed(0.14, 200, { cy: 0.25 }); feed(0.13, 100, { cy: 0.08 }); feed(null, 4000); sitDown(1000); sujoods(); rest2(); out.mixedA_rukuChairLike2s = sum(); done();
  // a Dhuhr, case A, with the middle tashahhud and rak'ahs 3 and 4
  await startUp("dhuhr"); feed(null, 49000); sitDown(1000); sujoods(); feed(0.13, 30000, { cy: 0.42 }); chairRak(); feed(0.13, 15000, { cy: 0.42 }); raise(0.13, 0.42); feed(0.13, 30000, { cy: 0.42 }); chairRak(); feed(0.13, 30000, { cy: 0.42 }); chairRak(); salam(0.13, 0.42); out.mixedA_dhuhr = sum(); done();
  // B, but his face sits high in the picture (y 0.22, whole): after standing it is first taken for
  // peeking in, then for sitting once it has rested there 5 s
  { const chairRakAt = (cy) => { raise(0.13, cy); feed(0.2, 6000, { cy: cy + 0.13 }); feed(0.13, 300, { cy }); raise(0.13, cy); feed(0.13, 2000, { cy }); feed(0.25, 1500, { cy: cy + 0.28 }); feed(null, 3000); feed(0.13, 3000, { cy }); feed(0.25, 1000, { cy: cy + 0.28 }); feed(null, 3000); };
    await startUp("fajr"); feed(null, 40000); feed(0.13, 100, { cy: 0.08 }); feed(0.13, 7000, { cy: 0.22 }); chairRakAt(0.22); feed(0.13, 30000, { cy: 0.22 }); chairRakAt(0.22); salam(0.13, 0.22); out.mixedB_seatHigh = sum(); done(); }
  // (review of v13) sitting down, sujood 1, then sitting up straighter between the sujoods (the face
  // 0.6 face heights above where it settled) and the face lost for a moment there: still sitting
  await startUp("fajr"); feed(null, 49000); sitDown(1000); feed(0.25, 1500, { cy: 0.7 }); feed(null, 3000); feed(0.13, 1000, { cy: 0.42 }); feed(0.13, 1500, { cy: 0.32 }); feed(null, 600); feed(0.13, 500, { cy: 0.32 }); feed(0.25, 1000, { cy: 0.7 }); feed(null, 3000); rest2(); out.mixedA_upInJalsa = sum(); done();
  // (review of v13) sitting, the face high in the picture (y 0.22) and lost for 0.6 s in the first
  // reading: not standing up
  { const w = 0.2, cy = 0.22; // (a whole face: its top at 0.09)
    const rakAt = () => { raise(w, cy); feed(w * 1.4, 6000, { cy: cy + 0.1 }); feed(w, 300, { cy }); raise(w, cy); feed(w, 2000, { cy }); feed(w * 1.5, 1000, { cy: cy + 0.25 }); feed(null, 2500); feed(w * 1.5, 4000, { cy: cy + 0.25 }); feed(w, 4000, { cy }); feed(w * 1.5, 1000, { cy: cy + 0.25 }); feed(null, 2500); feed(w * 1.5, 4000, { cy: cy + 0.25 }); };
    await start("fajr", w, cy); feed(w, 12000, { cy }); feed(null, 600); feed(w, 17000, { cy }); rakAt(); feed(w, 30000, { cy }); rakAt(); salam(w, cy); out.sitHighFaceLost = sum(); done();
    // ...and the same before the takbeer: leaned in to tap the phone (face low), sat back, the face
    // lost 0.6 s two seconds later, then the takbeer
    await go("fajr"); feed(0.25, 1500, { cy: 0.5 }); feed(w, 2000, { cy }); feed(null, 600); feed(w, 1500, { cy }); feed(w, 1500, { cy, hands: true }); feed(w, 30000, { cy }); rakAt(); feed(w, 30000, { cy }); rakAt(); salam(w, cy); out.sitHighLostBeforeTakbeer = sum(); done(); }
  // (review of v13) sitting, looking down for 5 s after tapping (no face seen), then the takbeer
  await go("fajr"); feed(null, 5000); feed(0.3, 2000); feed(0.3, 1500, { hands: true }); feed(0.3, 30000); rak(); feed(0.3, 30000); rak(); salam(); out.sitNoFaceFirst5s = sum(); done();
  // he tapped the phone from the side and stood: the face was never seen until he sat down
  await go("fajr"); feed(null, 45000); sitDown(1000); sujoods(); rest2(); out.mixedA_neverSeenStanding = sum(); done();

  // ---- like the Isha of 19 Oct (v12): the face seen low and turned while standing at the phone,
  // both arms up (takbeer), the face lost while sitting down, then the four rak'ahs sitting with the
  // bows as dips (y 0.42 -> 0.5, a bit bigger), 2.4 s apart; readings 30/12/20/10 s; last tashahhud 19 s ----
  { const up0 = 0.2, cy0 = 0.42;
    const dip = (ms, k = 1.3, cy = 0.5) => { feed(up0 * 1.1, 300, { cy: 0.46 }); feed(up0 * k, ms, { cy }); feed(up0 * 1.1, 300, { cy: 0.46 }); };
    const group = () => { dip(1700, 1.3, 0.51); feed(up0, 2400, { cy: cy0 }); dip(1600, 1.4, 0.52); feed(up0, 2400, { cy: cy0 }); dip(1800, 1.4, 0.52); };
    await go("isha"); feed(0.25, 1000, { cy: 0.57, yaw: -0.6, arms: false }); feed(0.25, 500, { cy: 0.57, yaw: -0.6, arms: true }); feed(0.27, 8500, { cy: 0.56, yaw: -0.5, arms: false });
    feed(null, 3500); feed(up0, 18000, { cy: cy0 }); group(); feed(up0, 12000, { cy: cy0 }); group(); feed(up0, 12000, { cy: cy0 }); raise(up0, cy0); feed(up0, 7000, { cy: cy0 }); group(); feed(up0, 10000, { cy: cy0 }); group(); salam(up0, cy0);
    out.ishaLike = sum(); done(); }

  // ---- v14 (21 Oct records) ----
  // Dhuhr: standing at the table the face came and went (big, cut off by the top edge) while the body tool
  // saw the head and the hips (not the feet): the face must watch, not the body
  { const bt = () => ({ up: { x: 0, y: -1, z: 0 }, raised: false, armsUp: false, yaw: 0, head: true, hips: true, feet: false, lm: null });
    await go("fajr");
    for (let i = 0; i < 12; i++) __pc.feed(null, 0, undefined, false, null, null, bt());
    for (let i = 0; i < 30; i++) { const on = i % 3 === 0; __pc.feed(on ? 0.25 : null, 0, undefined, false, on ? { cx: 0.5, cy: 0.08, h: 0.2 } : null, null, bt()); }
    const eye = __pc.auto().eye;
    feed(null, 40000); feed(0.13, 100, { cy: 0.1 }); feed(0.14, 300, { cy: 0.3 }); feed(0.13, 2000, { cy: 0.42 }); chairRak(); rest2();
    out.tableStandingBodySeen = `${sum()} | eye ${eye === false ? "face" : eye ? "BODY" : "none"}`; done(); }
  // Fajr: a deep sujood cut in two by a flicker (the face box smaller at the bottom edge for 0.6 s; two
  // pieces under 1 s each): one sujood, not none (v13 threw both away)
  { const splitRak = () => { raise(); feed(0.42, 6000); feed(0.3, 300); raise(); feed(0.3, 2000); feed(0.45, 700, { cy: 0.75 }); feed(0.3, 600, { cy: 0.75 }); feed(0.45, 700, { cy: 0.75 }); feed(0.3, 3000); feed(0.45, 1000, { cy: 0.7 }); feed(null, 2500); feed(0.45, 4000, { cy: 0.7 }); };
    await start("fajr"); feed(0.3, 30000); splitRak(); feed(0.3, 30000); rak(); salam(); out.sujoodSplitByFlicker = sum(); done();
    document.querySelector('[data-posture="sit"]').click(); document.querySelector('[data-key="fajr"]').click(); await new Promise((r) => setTimeout(r, 30)); feed(0.3, 3500); feed(0.3, 1500, { hands: true });
    feed(0.3, 30000); splitRak(); feed(0.3, 30000); rak(); salam(); out.sujoodSplitByFlicker_sit = sum(); done(); }
  // Fajr: in the first reading the face goes down to the bottom edge with the head turned far to the
  // side for 2 s (not a bow), and the sujood is split as above: the count must still be right
  { await start("fajr"); feed(0.3, 2500); feed(0.3, 300, { cy: 0.7, yaw: 0.2 }); feed(0.31, 1700, { cy: 0.86, yaw: 1.2 }); feed(0.3, 25500);
    const splitRak = () => { raise(); feed(0.36, 2500, { cy: 0.62 }); feed(0.3, 300); raise(); feed(0.3, 600); feed(0.44, 700, { cy: 0.76 }); feed(0.3, 600, { cy: 0.76 }); feed(0.44, 800, { cy: 0.76 }); feed(0.3, 1500); feed(0.38, 2300, { cy: 0.69 }); };
    splitRak(); feed(0.3, 9000); rak(); salam(); out.fajr21Oct = sum(); done(); }

  // ---- the whole body in the picture and no face (phone on the floor): the body tool watches ----
  { let r2 = 3; const r01 = () => { r2 = (r2 * 16807) % 2147483647; return r2 / 2147483647; };
    const wob = (a) => (r01() - 0.5) * 2 * a;
    const bodyAt = (deg, o = {}) => { const a = ((deg + wob(3)) * Math.PI) / 180; return { up: { x: wob(0.02), y: -Math.cos(a), z: -Math.sin(a) }, raised: !!o.raised, armsUp: !!o.armsUp, yaw: (o.yaw ?? 0) + wob(0.04), head: true, hips: true, feet: true, lm: null }; };
    const hold = (deg, ms, o = {}) => { for (let i = 0; i < ms; i += 100) __pc.feed(o.face ?? null, 0, undefined, false, o.face ? { cx: 0.5, cy: 0.2, h: o.face * 1.3 } : null, null, o.lost ? null : bodyAt(deg, o)); };
    const ramp = (a, b, ms) => { for (let i = 0; i < ms; i += 100) __pc.feed(null, 0, undefined, false, null, null, bodyAt(a + ((b - a) * i) / ms)); };
    const braise = () => { hold(3, 600, { raised: true, armsUp: true }); hold(3, 400); };
    const brak = () => { braise(); ramp(3, 85, 600); hold(85, 4000); ramp(85, 3, 600); braise(); hold(3, 1500); ramp(3, 140, 1200); hold(140, 4000); ramp(140, 12, 1000); hold(12, 3000); ramp(12, 140, 1000); hold(140, 4000); };
    const bsalam = () => { hold(12, 15000); hold(12, 1500, { yaw: -0.5 }); hold(12, 500); hold(12, 1000, { yaw: 0.5 }); hold(12, 3000); };
    // he bends down to tap the phone on the floor (a big face for a moment), then stands back
    await go("fajr"); hold(60, 1000, { face: 0.3 }); hold(3, 3000); braise(); hold(3, 30000); brak(); ramp(140, 3, 1500); hold(3, 30000); brak(); ramp(140, 12, 1200); bsalam();
    out.bodyStanding = `${sum()} | eye ${__pc.history()[0].trace.events.includes("watched by the body") ? "body" : "face"}`; done();
    // ...and the takbeer quickly, 2 s after stepping back from the phone (the body not decided yet)
    await go("fajr"); hold(60, 1000, { face: 0.3 }); hold(3, 2000); braise(); hold(3, 30000); brak(); ramp(140, 3, 1500); hold(3, 30000); brak(); ramp(140, 12, 1200); bsalam();
    out.bodyStandingQuickTakbeer = `${sum()} | eye ${__pc.history()[0].trace.events.includes("watched by the body") ? "body" : "face"}`; done(); }

  // ---- v17 (30 Oct records): rising from ruku quickly with the head still a little forward - the face
  // back at its upright height and the shoulders back up, but the face still 18% bigger than upright -
  // and the raise of rising from ruku seen for 0.4 s, or not at all. The ruku and the first sujood must
  // stay two bows (v16 ran them together: the steps fell one behind, the last tashahhud and the salam
  // were missed). Real face sizes (a face 0.2 wide, 0.145 high), no wobble, so the margins are exact. ----
  { const fn = (w, ms, o = {}) => { for (let i = 0; i < ms; i += 100) __pc.feed(w, o.yaw ?? 0, undefined, o.hands ?? false, w == null ? null : { cx: 0.5, cy: o.cy ?? 0.42, h: o.h ?? 0.145 }, o.sh ?? up); };
    const R = { cy: 0.51, h: 0.185, sh: ruku }, S = { cy: 0.56, h: 0.2, sh: suj }, D = { cy: 0.43, h: 0.165 };
    const quickRak = (hands) => {
      fn(0.2, 500, { hands: true }); fn(0.2, 400); // the takbeer before ruku
      fn(0.266, 2200, R); // ruku
      fn(0.236, 400, D); fn(0.236, 400, { ...D, hands }); fn(0.236, 400, D); // up again for 1.2 s, the face still big
      fn(0.28, 2200, S); fn(0.2, 1800); fn(0.28, 2200, S); // sujood, sitting between, sujood
    };
    for (const hands of [true, false]) {
      await go("fajr"); fn(0.2, 3500); fn(0.2, 1500, { hands: true }); fn(0.2, 10000);
      quickRak(hands); fn(0.2, 10000); quickRak(hands);
      fn(0.2, 12000); fn(0.2, 1000, { yaw: 0.5 }); fn(0.2, 600); fn(0.2, 1000, { yaw: -0.5 }); // last tashahhud, salam
      out[hands ? "quickRiseFaceBig" : "quickRiseFaceBigNoHands"] = sum(); done();
    }
  }

  localStorage.clear();
  console.log(out);
  return out;
};
// Results (v13), all end with the salam:
// the sitting ones = the "sit" mode's (same bows and labels; fajrQunut, shouldersRuku, armsOnlyRaises
// differ only by a few tenths in some sujood ends, as nothing is learned before the takbeer);
// lapHighFace, sitAfterTapping, sitHighFaceLost, sitHighLostBeforeTakbeer, sitNoFaceFirst5s 13
// (missed 0, never "standing"); sitFaceUpAndOut 13 (missed 0, stood up and sat down again);
// mixedA_rukuUnseen, mixedA_noRest, mixedA_topFlicker, mixedA_headUpAfterSujoods, mixedA_upInJalsa,
// mixedA_neverSeenStanding 13 (missed 1 = the unseen standing ruku); mixedA_dhuhr 26 (missed 1);
// mixedB, mixedB_seatHigh 13 (missed 0); mixedA_peek_bigRuku, mixedA_peekInside_bigRuku,
// mixedA_rukuChairLike2s 13 (missed 0: "sat down" undone, the standing ruku counted);
// mixedA_peekInsideNeverGone 13 (missed 1: the clock only starts after the standing ruku);
// ishaLike 26 (missed 0); bodyStanding 13 (watched by the body).
// Replays as "auto": v6 Asr missed 1/1/0 (v12 "mixed": 0/1/1), v8 Asr = "sit", v10 Dhuhr 0/1/1 (= v12).
// v14: tableStandingBodySeen 13 (missed 0, watched by the face; v13: by the body); sujoodSplitByFlicker
// and _sit 13 (missed 0; v13 missed 1); fajr21Oct 13 (missed 0, the turned-away moment extra; v13
// missed 1); bodyStanding, bodyStandingQuickTakbeer 13 (watched by the body). Everything else = v13.
// Replays of the 21 Oct records (real face sizes): Fajr 13 steps, salam, all bows right (the 4 s
// moment extra); Dhuhr (no face heights: y 0.5) 26 steps, salam, missed 1 (r1 sujood 1).
// v17: quickRiseFaceBig, quickRiseFaceBigNoHands 13 (missed 0, salam; v16: NOT ENDED on "الرفع من الركوع 2",
// the ruku and the first sujood run together in both rak'ahs). Everything else = v16.
// Replays of the 30 Oct records (with the shoulders and every "hands up ... = raise" fed): Asr 26 steps,
// all 12 bows right + 1 extra (v16: the ruku and sujood 1 of rak'ah 2 as one); Maghrib 20 steps, salam,
// 3 extra after rak'ah 3; Fajr 13 steps, salam (with only the counted raises, v16: not ended, the second
// sujood of rak'ah 2 missing - as on the phone).
