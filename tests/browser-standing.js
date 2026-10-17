// Standing prayers watched by the body (v10). Use: open the app with ?sim, paste this file, then
// `await standingTests()`. Each simulated body gives the bend of the back in degrees (0 = standing
// straight, ~85 = ruku, ~140 = sujood, ~10 = sitting on the floor), whether both arms are up, and
// the head turn. No face is fed (from the floor the face tool does not see it).
window.standingTests = async () => {
  localStorage.clear();
  let rnd = 3; const r01 = () => { rnd = (rnd * 16807) % 2147483647; return rnd / 2147483647; };
  const wob = (a) => (r01() - 0.5) * 2 * a;
  const bodyAt = (deg, o = {}) => {
    const a = ((deg + wob(3)) * Math.PI) / 180;
    return { up: { x: wob(0.02), y: -Math.cos(a), z: -Math.sin(a) }, raised: !!o.raised, yaw: o.noHead ? null : (o.yaw ?? 0) + wob(0.04),
      head: !o.noHead, hips: !o.noHips, feet: true, lm: null };
  };
  // hold a bend for ms (100 ms frames); o.lost = no body seen
  const hold = (deg, ms, o = {}) => { for (let i = 0; i < ms; i += 100) __pc.feed(null, 0, undefined, false, null, null, o.lost ? null : bodyAt(deg, o)); };
  const ramp = (a, b, ms) => { for (let i = 0; i < ms; i += 100) __pc.feed(null, 0, undefined, false, null, null, bodyAt(a + ((b - a) * i) / ms)); };
  const raise = () => { hold(3, 600, { raised: true }); hold(3, 400); };
  const start = async (key) => {
    document.querySelector('[data-posture="stand"]').click(); document.querySelector(`[data-key="${key}"]`).click();
    await new Promise((r) => setTimeout(r, 30));
    hold(2, 3500); raise();
  };
  // o.jalsa = bend while sitting between the sujoods; o.lostInSujood = body not seen for a while in sujood 1
  const rak = (o = {}) => {
    raise(); ramp(3, 85, 600); hold(85, 4000); ramp(85, 3, 600); raise(); hold(3, 1500);
    ramp(3, 140, 1200); hold(140, 1500); hold(140, o.lostInSujood ? 1500 : 0, { lost: true }); hold(140, 2500);
    ramp(140, o.jalsa ?? 12, 1000); hold(o.jalsa ?? 12, 3000);
    ramp(o.jalsa ?? 12, 140, 1000); hold(140, 4000);
  };
  const standUp = () => { ramp(140, 3, 1500); hold(3, 30000); };
  const sitUp = () => { ramp(140, 12, 1200); };
  const salam = () => { hold(12, 15000); hold(12, 1500, { yaw: -0.5 }); hold(12, 500); hold(12, 1000, { yaw: 0.5 }); hold(12, 3000); };
  const ended = () => {
    let how = "";
    if (__pc.state().mode === "pray") { how = `NOT ENDED (on "${__pc.state().step} ${__pc.state().group}") `; document.getElementById("btnStop").click(); }
    const h = __pc.history()[0];
    document.getElementById("rHome").click();
    return `${how}${h.how} steps=${h.segs.length} dashes=${h.segs.filter((s) => s.end - s.start < 300).length} ${h.trace.match.split(" | ").slice(-1)[0]}`;
  };
  const out = {};
  await start("fajr"); hold(3, 30000); rak(); standUp(); rak(); sitUp(); salam(); out.fajr = ended();
  await start("fajr"); hold(3, 30000); rak({ lostInSujood: true }); standUp(); rak(); sitUp(); salam(); out.fajrBodyLostInSujood = ended();
  await start("fajr"); hold(3, 30000); rak({ jalsa: 22 }); standUp(); rak({ jalsa: 22 }); sitUp(); salam(); out.fajrJalsaLeaning22 = ended();
  await start("dhuhr"); hold(3, 30000); rak(); standUp(); rak(); sitUp(); hold(12, 15000);
  ramp(12, 3, 1500); raise(); hold(3, 30000); rak(); standUp(); rak(); sitUp(); salam(); out.dhuhr = ended();
  // sitting between the sujoods bent 30 degrees (between "upright" and "bowed"): coming up 60 degrees
  // from the sujood counts as sitting up
  await start("fajr"); hold(3, 30000); rak({ jalsa: 30 }); standUp(); rak({ jalsa: 30 }); sitUp(); salam(); out.fajrJalsaLeaning30 = ended();
  // sitting on the floor leaning 28 degrees, the body lost for 1 s in the tashahhud: not a bow
  await start("fajr"); hold(3, 30000); rak(); standUp(); rak(); ramp(140, 28, 1200); hold(28, 6000); hold(28, 1000, { lost: true }); hold(28, 8000);
  hold(28, 1500, { yaw: -0.5 }); hold(28, 500); hold(28, 1000, { yaw: 0.5 }); hold(28, 3000); out.lostWhileSittingLeaning = ended();
  // a shallow sujood (on a chair: 80 degrees) and sitting up to 27 degrees between them
  const chairRak = () => { raise(); ramp(3, 85, 600); hold(85, 4000); ramp(85, 3, 600); raise(); hold(3, 1500); ramp(3, 80, 1000); hold(80, 4000); ramp(80, 27, 800); hold(27, 3000); ramp(27, 80, 800); hold(80, 4000); };
  await start("fajr"); hold(3, 30000); chairRak(); ramp(80, 3, 1200); hold(3, 30000); chairRak(); ramp(80, 27, 800); hold(27, 15000);
  hold(27, 1500, { yaw: -0.5 }); hold(27, 500); hold(27, 1000, { yaw: 0.5 }); hold(27, 3000); out.shallowSujoodOnChair = ended();
  // every third frame without a body while coming up from the sujoods and the ruku
  { const flick = (a, b, ms) => { for (let i = 0; i < ms; i += 100) __pc.feed(null, 0, undefined, false, null, null, (i / 100) % 3 === 2 ? null : bodyAt(a + ((b - a) * i) / ms)); };
    await start("fajr"); hold(3, 30000);
    for (let r = 0; r < 2; r++) { raise(); ramp(3, 85, 600); hold(85, 4000); flick(85, 3, 1200); raise(); hold(3, 1500); ramp(3, 140, 1200); hold(140, 4000); flick(140, 12, 1500); hold(12, 3000); ramp(12, 140, 1000); hold(140, 4000); if (r === 0) { flick(140, 3, 1800); hold(3, 30000); } }
    flick(140, 12, 1500); salam(); out.framesDroppedWhileRising = ended(); }
  // the hips flicker out for a frame now and then while the standing back is learned; the head is
  // out of the picture for a while during the reading (no head turn then)
  document.querySelector('[data-posture="stand"]').click(); document.querySelector('[data-key="fajr"]').click(); await new Promise((r) => setTimeout(r, 30));
  __pc.feed(null, 0, undefined, false, null, null, null); // an empty first frame
  for (let i = 0; i < 35; i++) __pc.feed(null, 0, undefined, false, null, null, bodyAt(2, { noHips: i % 7 === 3 }));
  const learned = __pc.state().mode === "takbeer" ? "learned in 3.5 s" : `NOT learned (still ${__pc.state().mode})`;
  raise(); hold(3, 10000, { noHead: true }); hold(3, 20000); rak(); standUp(); rak(); sitUp(); salam(); out.calibFlickerAndNoHead = `${learned}; ${ended()}`;
  // the body lost at 48 degrees on the way down (deepest seen 48), then sitting up leaning 28 degrees
  await start("fajr"); hold(3, 30000);
  for (let r = 0; r < 2; r++) {
    raise(); ramp(3, 85, 600); hold(85, 4000); ramp(85, 3, 600); raise(); hold(3, 1500);
    ramp(3, 48, 600); hold(48, 4000, { lost: true }); ramp(140, 28, 800); hold(28, 3000); ramp(28, 140, 1000); hold(140, 4000);
    if (r === 0) standUp();
  }
  sitUp(); salam(); out.lostAt48ThenSit28 = ended();
  // a calm way down into sujood (12 degrees a second), the body lost at 40 degrees
  await start("fajr"); hold(3, 30000);
  for (let r = 0; r < 2; r++) {
    raise(); ramp(3, 85, 600); hold(85, 4000); ramp(85, 3, 600); raise(); hold(3, 1500);
    ramp(3, 40, 3100); hold(40, 4000, { lost: true }); ramp(140, 12, 1000); hold(12, 3000); ramp(12, 140, 1000); hold(140, 4000);
    if (r === 0) standUp();
  }
  sitUp(); salam(); out.calmDescentLostAt40 = ended();
  // last tashahhud: a glance to one side, then the head down (not seen) for 20 s, then ONE turn:
  // not a salam; the real salam after it ends the prayer
  await start("fajr"); hold(3, 30000); rak(); standUp(); rak(); sitUp(); hold(12, 5000);
  hold(12, 1000, { yaw: 0.45 }); hold(12, 20000, { noHead: true }); hold(12, 1000, { yaw: -0.45 });
  const notYet = __pc.state().mode === "pray" ? "still praying after one turn" : "ENDED ON ONE TURN";
  hold(12, 3000); hold(12, 1500, { yaw: -0.5 }); hold(12, 500); hold(12, 1000, { yaw: 0.5 }); hold(12, 3000);
  out.oldTurnThenHeadDown = `${notYet}; ${ended()}`;
  // placement check messages
  const b = (o) => ({ up: { x: 0, y: -1, z: 0 }, raised: false, yaw: 0, head: true, hips: true, feet: true, lm: null, ...o });
  let t = 9e6;
  out.checks = [__pc.checkBody(null, t += 100), __pc.checkBody(b({ head: false }), t += 100), __pc.checkBody(b({ hips: false }), t += 100),
    __pc.checkBody(b({}), t += 100), __pc.checkBody(b({ raised: true }), t += 100)].join(" / ");
  localStorage.clear();
  return out;
};
// v10 results: fajr, fajrBodyLostInSujood, fajrJalsaLeaning22, fajrJalsaLeaning30,
// lostWhileSittingLeaning, shallowSujoodOnChair, framesDroppedWhileRising, calibFlickerAndNoHead:
// salam steps=13 missed 0; dhuhr: salam steps=26 missed 0.
