// Replays a pasted prayer record through the whole app (detection + matching + cues + salam).
// Use: open http://localhost:8766/?sim, paste this file, then:
//   await replayRecord(SAMPLES, 0.075, 1.33, [31700, 49600, 62900], "asr", "mixed")
// SAMPLES = the text after "SAMPLES t:size,score,y,turn,bowed " in the record.
// The record keeps face size relative to the upright size (reset when each bow ends), so real
// sizes are rebuilt from a guessed starting size V0; the face height is guessed as w * hk.
// Try a few guesses (e.g. V0/hk = 0.06/1.0, 0.075/1.33, 0.09/1.47). raises = hand-raise times
// (ms after the start) taken from the record's EVENTS.
// opts.yawNoise: add this much random wobble to the head turn on every frame (the record keeps only
// 4 values a second; the real values between them wobble), opts.seed: start of the random numbers.
// Records from v13 on keep the face's real width (10th field): then that is used and V0 is not
// needed; hk is then the face's height over its width in the picture (portrait video: about 0.8).
// A face seen with no height in the picture (v13 watched by the body) is put at y 0.5.
window.replayRecord = async (S, V0, hk, raises, prayer, posture, opts = {}) => {
  localStorage.clear();
  let rnd = opts.seed || 7; const wobble = () => { rnd = (rnd * 16807) % 2147483647; return ((rnd / 2147483647) - 0.5) * 2 * (opts.yawNoise || 0); };
  const samples = S.trim().split(" ").map((x) => { const [t, rest] = x.split(":"); const v = rest.split(",").map(Number); return { t: Number(t) * 100, size: v[0], y: v[2], turn: v[3], bowed: v[4], arms: v[8] === 1, face: v.length >= 10 ? v[9] : null }; });
  const abs = samples.some((s) => s.face != null && s.face >= 0);
  let V = V0, lastSeenBowed = null; const frames = [];
  samples.forEach((s, i) => {
    if (abs) { const w = s.face >= 0 ? s.face / 1000 : null; frames.push({ t: s.t, w, cy: s.y >= 0 ? s.y / 100 : 0.5, yaw: s.turn / 100, arms: s.arms }); return; }
    if (s.bowed === 0 && i > 0 && samples[i - 1].bowed === 1 && lastSeenBowed) V = lastSeenBowed;
    const w = s.size < 0 ? null : V * s.size / 100;
    if (s.bowed === 1 && w) lastSeenBowed = w;
    frames.push({ t: s.t, w, cy: s.y / 100, yaw: s.turn / 100 });
  });
  if (abs) V0 = frames.find((f) => f.w)?.w ?? V0;
  const spoken = []; let curT = 0;
  speechSynthesis.speak = (u) => { if (u.text.trim()) spoken.push(`${u.text} @${(curT / 1000).toFixed(1)}s`); };
  document.querySelector(`[data-posture="${posture}"]`).click();
  document.querySelector(`[data-key="${prayer}"]`).click(); await new Promise((r) => setTimeout(r, 30));
  let simT = 1000000;
  const cy0 = frames.find((f) => f.w)?.cy ?? 0.45;
  for (let i = 0; i < 35; i++) { simT += 100; __pc.feed(V0, 0, simT, false, { cx: 0.5, cy: cy0, h: V0 * hk }); }
  for (let i = 0; i < 6; i++) { simT += 100; __pc.feed(V0, 0, simT, true, { cx: 0.5, cy: cy0, h: V0 * hk }); }
  const t0 = simT - 500;
  const shown = []; let lastLabel = "";
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i], next = frames[i + 1] ? frames[i + 1].t : f.t + 300;
    for (let t = f.t; t < next; t += 100) {
      curT = t;
      const hands = raises.some((r) => t >= r && t < r + 600) || !!f.arms; // (v13 records: the arms seen up)
      __pc.feed(f.w, f.yaw + wobble(), t0 + t, hands, f.w == null ? null : { cx: 0.5, cy: f.cy, h: f.w * hk });
      const st = __pc.state();
      const label = st.mode === "pray" ? `${st.step} ${st.group}` : st.mode;
      if (label !== lastLabel) { shown.push(`${(t / 1000).toFixed(1)} ${label}`); lastLabel = label; }
    }
  }
  const stillPraying = __pc.state().mode === "pray";
  if (stillPraying) document.getElementById("btnStop").click(); // not ended by a salam: end it here
  const h = __pc.history()[0];
  document.getElementById("rHome").click();
  return { ended: stillPraying ? "NOT ENDED (stopped by the replay)" : h?.how, steps: h?.segs.length, match: h?.trace.match, events: h?.trace.events, spoken: spoken.join(", "), shown: shown.join(" | ") };
};
// (v13 records: runAll replays them with hk 0.7 / 0.85 / 1.0.)
// v7 on the 2026-10-16 Asr record: all three guesses end at the salam with 26 steps,
// "sat down" at ~17.3 s, middle-tashahhud cue ~41.5 s, last-tashahhud cue 93.6 s.
