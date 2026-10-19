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
window.replayRecord = async (S, V0, hk, raises, prayer, posture, opts = {}) => {
  localStorage.clear();
  let rnd = opts.seed || 7; const wobble = () => { rnd = (rnd * 16807) % 2147483647; return ((rnd / 2147483647) - 0.5) * 2 * (opts.yawNoise || 0); };
  const samples = S.trim().split(" ").map((x) => { const [t, rest] = x.split(":"); const [size, , y, turn, bowed] = rest.split(",").map(Number); return { t: Number(t) * 100, size, y, turn, bowed }; });
  let V = V0, lastSeenBowed = null; const frames = [];
  samples.forEach((s, i) => {
    if (s.bowed === 0 && i > 0 && samples[i - 1].bowed === 1 && lastSeenBowed) V = lastSeenBowed;
    const w = s.size < 0 ? null : V * s.size / 100;
    if (s.bowed === 1 && w) lastSeenBowed = w;
    frames.push({ t: s.t, w, cy: s.y / 100, yaw: s.turn / 100 });
  });
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
      const hands = raises.some((r) => t >= r && t < r + 600);
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
// v7 on the 2026-10-16 Asr record: all three guesses end at the salam with 26 steps,
// "sat down" at ~17.3 s, middle-tashahhud cue ~41.5 s, last-tashahhud cue 93.6 s.
