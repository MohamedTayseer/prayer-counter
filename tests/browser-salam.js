// Salam tests (v9): the face looks a little to one side even when facing the phone, as in the
// 2026-10-17 Asr record (head turn about -0.12 at rest). Use: open the app with ?sim, paste this
// file, then `await salamTests()`. Each line says how the prayer ended and when (s after start).
window.salamTests = async () => {
  localStorage.clear();
  let rnd = 5; const r01 = () => { rnd = (rnd * 16807) % 2147483647; return rnd / 2147483647; };
  const wob = (a) => (r01() - 0.5) * 2 * a;
  // o: cy, hands, yaw (head turn), yawWobble
  const feed = (w, ms, o = {}) => {
    for (let i = 0; i < ms; i += 100) {
      const ww = w == null ? null : w * (1 + wob(0.04));
      __pc.feed(ww, (o.yaw ?? -0.12) + wob(o.yawWobble ?? 0.03), undefined, o.hands ?? false, ww == null ? null : { cx: 0.5, cy: o.cy ?? 0.45, h: ww * 1.3 }, null);
    }
  };
  const raise = () => { feed(0.3, 600, { hands: true }); feed(0.3, 500); };
  const rak = () => { raise(); feed(0.42, 6000); feed(0.3, 300); raise(); feed(0.3, 2000); feed(0.45, 1000, { cy: 0.7 }); feed(null, 2500); feed(0.45, 4000, { cy: 0.7 }); feed(0.3, 4000); feed(0.45, 1000, { cy: 0.7 }); feed(null, 2500); feed(0.45, 4000, { cy: 0.7 }); };
  const startFajr = async () => { document.querySelector('[data-posture="sit"]').click(); document.querySelector('[data-key="fajr"]').click(); await new Promise((r) => setTimeout(r, 30)); feed(0.3, 3500); feed(0.3, 1500, { hands: true }); };
  const ended = () => {
    let how;
    if (__pc.state().mode === "pray") { document.getElementById("btnStop").click(); how = "NOT SEEN (stopped by hand)"; }
    const h = __pc.history()[0];
    document.getElementById("rHome").click();
    return `${how || h.how} at ${((h.end - h.t0) / 1000).toFixed(1)}s`;
  };
  const prayUpToLast = async () => { await startFajr(); feed(0.3, 30000); rak(); feed(0.3, 30000); rak(); };
  const out = {};
  // 1. like the record's salam: right to -0.6, then left only to +0.28 (abs) for 0.8 s, wobbling +-0.06
  //    (from facing the phone that is a turn of 0.40)
  for (const seed of [5, 9, 13, 17, 29]) {
    rnd = seed;
    await prayUpToLast(); feed(0.3, 12000);
    feed(0.3, 1500, { yaw: -0.6, yawWobble: 0.06 }); feed(0.3, 600); feed(0.3, 800, { yaw: 0.28, yawWobble: 0.06 }); feed(0.3, 5000);
    out[`smallSecondTurn seed ${seed}`] = ended();
  }
  // 2. looking a little to the side twice during the tashahhud (0.2 from facing, 10 s apart): not a salam;
  //    the real salam comes 8 s after the second glance
  rnd = 21;
  await prayUpToLast(); feed(0.3, 5000);
  feed(0.3, 1500, { yaw: -0.32 }); feed(0.3, 10000); feed(0.3, 1500, { yaw: 0.08 }); feed(0.3, 8000);
  const before = __pc.state().mode === "pray" ? "still praying" : "ENDED EARLY";
  feed(0.3, 1500, { yaw: -0.65 }); feed(0.3, 500); feed(0.3, 1000, { yaw: 0.4 }); feed(0.3, 3000);
  out.glancesThenSalam = `${ended()} (just before the real salam: ${before})`;
  // 3. one turn, then nothing for 10 s, then the other side: too far apart for one salam
  rnd = 33;
  await prayUpToLast(); feed(0.3, 5000);
  feed(0.3, 1500, { yaw: -0.65 }); feed(0.3, 10000); feed(0.3, 1500, { yaw: 0.4 }); feed(0.3, 5000);
  out.turnsTooFarApart = ended();
  localStorage.clear();
  return out;
};
// Results: v8 saw smallSecondTurn in 1 of 5 runs (the other 4 ended by hand, as in the record);
// v9 in 5 of 5 (at 134.8 s). glancesThenSalam: both end at the real salam (148.7 s).
// turnsTooFarApart: v8 ended it (20 s allowed), v9 does not (turns must be within 8 s).
