// Tests for docs/align.js. Run: node tests/align.test.mjs
import { readFileSync, existsSync } from "node:fs";
import { alignPrayer, timeline, buildSteps } from "../docs/align.js";
import { parseRecord } from "./analyze-record.mjs";

let failed = 0;
const check = (name, ok, info = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? "  " + info : ""}`); if (!ok) failed++; };
const SLOT = ["ruku", "sujood 1", "sujood 2"];
const slotName = (j) => `r${Math.floor(j / 3) + 1} ${SLOT[j % 3]}`;
const run = (n, bows, raises, now) => {
  const res = alignPrayer({ n, bows, raises, t0: 0, now });
  const steps = buildSteps(n);
  const tl = timeline({ steps, pairs: res.pairs, bows: res.bows, raises, t0: 0, now });
  return { res, steps, tl, label: steps[tl.ptr].label + (typeof steps[tl.ptr].g === "number" ? ` r${steps[tl.ptr].g}` : "") };
};
const s = (sec) => sec * 1000;
const bow = (a, b, extra = {}) => ({ s: s(a), e: b == null ? null : s(b), ...extra });

// ---- 1. the real Asr test record (v6, 16 Oct 2026) - kept on this PC only (tests/records is not uploaded) ----
const recFile = new URL("./records/v6-asr-2026-10-16.txt", import.meta.url);
const rec = existsSync(recFile) ? parseRecord(readFileSync(recFile, "utf8")) : null;
if (!rec) console.log("SKIP  the real record is not on this computer");
if (rec) {
  const { res, steps, tl } = run(rec.n, rec.bows, rec.raises, rec.end);
  const inOrder = res.pairs.every((p, i) => p.a === i && p.j === i);
  check("record: all 12 bows counted in order, nothing missed or extra", inOrder && res.pairs.length === 12 && res.misses === 0 && res.extras === 0,
    res.pairs.map((p) => slotName(p.j)).join(", "));
  const at = (label, g) => steps.findIndex((x) => x.label.startsWith(label) && (g === undefined || x.g === g));
  check("record: middle tashahhud starts when bow 6 ends (41.6 s)", tl.starts[at("التشهد الأوسط")] === s(41.6));
  check("record: rak'ah 3 reading starts at the stand-up raise (49.9 s)", tl.starts[at("القراءة", 3)] === s(49.9));
  check("record: last tashahhud starts when bow 12 ends (93.1 s)", steps[tl.ptr].last && tl.starts[tl.ptr] === s(93.1));
}
// live replay: at every moment, what would the screen have said?
if (rec) {
  const truth = (t) => { // the step that was really going on at time t (bows in order)
    const steps = buildSteps(rec.n);
    let k = 0, nearSeen = 0;
    for (const b of rec.bows) {
      if (b.s > t) break;
      k = steps.findIndex((x, i) => x.pose === "near" && steps.slice(0, i + 1).filter((y) => y.pose === "near").length === nearSeen + 1);
      nearSeen++;
      if (b.e != null && b.e <= t) { k++; if (steps[k].mid) { const up = rec.raises.find((r) => r.t >= b.e + 3000 && r.t <= t); if (up) k++; } }
    }
    return k;
  };
  let wrong = [], earlyLast = false;
  for (let t = 0; t <= rec.end; t += 100) {
    const bows = rec.bows.filter((b) => b.s <= t).map((b) => ({ s: b.s, e: b.e != null && b.e <= t ? b.e : null }));
    const raises = rec.raises.filter((r) => r.t <= t);
    const { tl, steps } = run(rec.n, bows, raises, t);
    if (tl.ptr !== truth(t)) wrong.push(`${(t / 1000).toFixed(1)}s: shows "${steps[tl.ptr].label} ${steps[tl.ptr].g}" instead of "${steps[truth(t)].label} ${steps[truth(t)].g}"`);
    if (steps[tl.ptr].last && t < s(93.1)) earlyLast = true;
  }
  check("record live: never says 'last tashahhud' early", !earlyLast);
  check("record live: the screen is right at every moment", wrong.length === 0, wrong.slice(0, 5).join(" | "));
}

// ---- 2. made-up prayers (Fajr = 2 rak'ahs, Dhuhr = 4) ----
{ // ruku of rak'ah 1 not seen at all; the long reading after the 2nd seen bow gives it away
  const bows = [bow(30, 35), bow(37, 42), bow(72, 78), bow(80, 85), bow(87, 92)];
  const { res } = run(2, bows, [], s(110));
  check("missed ruku: the first bow seen is sujood 1", res.pairs[0].j === 1 && res.pairs.length === 5, res.pairs.map((p) => slotName(p.j)).join(", "));
  const live = run(2, bows.slice(0, 2), [], s(42 + 20)); // 20 s into the reading after them
  check("missed ruku, live: 20 s into the next reading it shows reading r2", live.label === "القراءة (الفاتحة والسورة) r2", live.label);
  const early = run(2, bows.slice(0, 2), [], s(42 + 3));  // only 3 s in: no reason to change yet
  check("missed ruku, live: 3 s in it still counts in order (sitting r1)", early.label === "الجلسة بين السجدتين r1", early.label);
}
{ // 2nd sujood of rak'ah 1 not seen; the "sami' Allahu" raise right after the 1st bow tells it was the ruku
  const bows = [bow(30, 36), bow(38, 43), bow(73, 79), bow(81, 86), bow(88, 93)];
  const { res } = run(2, bows, [{ t: s(36.6) }], s(110));
  check("missed 2nd sujood: the 3rd bow seen is rak'ah 2 ruku", res.pairs[2].j === 3 && res.misses === 1, res.pairs.map((p) => slotName(p.j)).join(", "));
}
{ // a 1.5 s twitch in the middle of the first reading
  const bows = [bow(10, 11.5), bow(35, 41), bow(43, 48), bow(50, 55), bow(85, 91), bow(93, 98), bow(100, 105)];
  const { res } = run(2, bows, [], s(120));
  check("twitch while reading: left out as extra", res.extras === 1 && res.pairs[0].a === 1 && res.pairs[0].j === 0, res.pairs.map((p) => `${p.a}->${slotName(p.j)}`).join(", "));
}
{ // Fajr qunut: a 45 s rising in rak'ah 2 must not confuse it
  const bows = [bow(30, 36), bow(38, 43), bow(45, 50), bow(70, 76), bow(121, 126), bow(128, 133)];
  const { res } = run(2, bows, [], s(150));
  check("Fajr qunut (45 s rising): counted in order", res.misses === 0 && res.extras === 0 && res.pairs.every((p, i) => p.j === i));
}
{ // ruku not seen, but the takbeer before it and the raise after it were: the ruku gets their time
  const bows = [bow(36, 41), bow(43, 48), bow(78, 84), bow(86, 91), bow(93, 98)];
  const raises = [{ t: s(28) }, { t: s(34) }];
  const { res, steps, tl } = run(2, bows, raises, s(115));
  const k = steps.findIndex((x) => x.label === "الركوع" && x.g === 1);
  check("missed ruku between two raises: timed from raise to raise", res.pairs[0].j === 1 && tl.starts[k] === s(28) && tl.starts[k + 1] === s(34),
    `ruku ${tl.starts[k] / 1000}s, rising ${tl.starts[k + 1] / 1000}s`);
}
{ // a "sami' Allahu" raise right after a bow tells the bow was the ruku
  const bows = [bow(30, 36), bow(38, 43), bow(45, 50), bow(80, 86)];
  const raises = [{ t: s(86.8) }];
  const live = run(2, bows, raises, s(88));
  check("raise right after a bow: shown as rising r2", live.label === "الرفع من الركوع r2", live.label);
}
{ // a full Dhuhr with nothing wrong: every bow in order, middle tashahhud split by the raise
  const bows = []; let t = 30;
  for (let r = 1; r <= 4; r++) { bows.push(bow(t, t + 6), bow(t + 8, t + 13), bow(t + 15, t + 20)); t += 20 + (r === 2 ? 50 : 30); }
  const raises = [{ t: s(30 + 20 + 30 + 20 + 25) }];
  const { res } = run(4, bows, raises, s(t + 20));
  check("normal Dhuhr: all 12 bows in order", res.pairs.length === 12 && res.misses === 0 && res.extras === 0);
}

// ---- 3. "first rak'ah standing" with the phone set for sitting (v8) ----
// The clock starts when he stands up (face leaves the top of the picture). He reads standing, then
// EITHER does the ruku standing (out of the picture) and sits down, OR sits down and does the ruku
// sitting. The two sujoods of rak'ah 1 are always on the chair.
const runMixed = (n, bows, raises, sits, now, handsOn = true) => {
  const res = alignPrayer({ n, bows, raises, sits, mixed: true, handsOn, t0: 0, now });
  const steps = buildSteps(n);
  const tl = timeline({ steps, pairs: res.pairs, bows: res.bows, raises, t0: 0, now });
  return { res, steps, tl, label: steps[tl.ptr].label + (typeof steps[tl.ptr].g === "number" ? ` r${steps[tl.ptr].g}` : "") };
};
// rak'ah 2 (sitting, seen normally): takbeer raise, ruku, "sami' Allahu" raise, sujood, sujood
const r2Bows = [bow(91, 96), bow(99, 104), bow(106, 111)];
const r2Raises = [{ t: s(90) }, { t: s(96.6) }];
const upTo = (list, t) => list.filter((b) => b.s <= t).map((b) => ({ ...b, e: b.e != null && b.e <= t ? b.e : null }));
{ // A: ruku standing (not seen), sat down at 49 s, then the two sujoods
  const bows = [bow(51, 56), bow(58, 63), ...r2Bows];
  const sits = [{ t: s(49) }];
  const { res } = runMixed(2, bows, r2Raises, sits, s(130));
  check("mixed A (ruku standing, unseen): first bow seen is sujood 1", res.pairs[0].j === 1 && res.pairs.length === 5 && res.misses === 1,
    res.pairs.map((p) => slotName(p.j)).join(", "));
  const at = (t) => runMixed(2, upTo(bows, s(t)), r2Raises.filter((r) => r.t <= s(t)), sits, s(t)).label;
  check("mixed A live: before sitting it is reading r1", at(45) === "القراءة (الفاتحة والسورة) r1", at(45));
  check("mixed A live: the first bow after sitting shows as sujood 1", at(53) === "السجدة الأولى r1", at(53));
  check("mixed A live: then sitting, then sujood 2", at(57) === "الجلسة بين السجدتين r1" && at(60) === "السجدة الثانية r1", `${at(57)} / ${at(60)}`);
  check("mixed A live: then reading r2", at(66) === "القراءة (الفاتحة والسورة) r2", at(66));
}
{ // A, but the standing ruku showed for a moment (face came into the picture from the top)
  const bows = [bow(41, 44), bow(51, 56), bow(58, 63), ...r2Bows];
  const { res } = runMixed(2, bows, r2Raises, [{ t: s(49) }], s(130));
  check("mixed A (standing ruku seen): all bows in order", res.misses === 0 && res.extras === 0 && res.pairs.every((p, i) => p.j === i),
    res.pairs.map((p) => slotName(p.j)).join(", "));
}
{ // B: sat down at 40 s, takbeer raise, ruku sitting, "sami' Allahu" raise, the two sujoods
  const bows = [bow(43, 48), bow(51, 56), bow(58, 63), ...r2Bows];
  const raises = [{ t: s(42.5) }, { t: s(48.6) }, ...r2Raises];
  const sits = [{ t: s(40) }];
  const { res } = runMixed(2, bows, raises, sits, s(130));
  check("mixed B (ruku sitting): all bows in order", res.misses === 0 && res.extras === 0 && res.pairs.every((p, i) => p.j === i),
    res.pairs.map((p) => slotName(p.j)).join(", "));
  const at = (t) => runMixed(2, upTo(bows, s(t)), raises.filter((r) => r.t <= s(t)), sits, s(t)).label;
  check("mixed B live: the sitting ruku shows as ruku", at(45) === "الركوع r1", at(45));
  check("mixed B live: then rising, sujood 1", at(49.5) === "الرفع من الركوع r1" && at(53) === "السجدة الأولى r1", `${at(49.5)} / ${at(53)}`);
}
{ // B, takbeer done standing (not seen) but the "sami' Allahu" raise was seen: fixed right after the ruku
  const bows = [bow(43, 48), bow(51, 56), bow(58, 63), ...r2Bows];
  const raises = [{ t: s(48.6) }, ...r2Raises];
  const sits = [{ t: s(40) }];
  const at = (t) => runMixed(2, upTo(bows, s(t)), raises.filter((r) => r.t <= s(t)), sits, s(t)).label;
  check("mixed B, no takbeer seen: right after the 'sami' Allahu' raise it shows rising", at(49.5) === "الرفع من الركوع r1", at(49.5));
  const { res } = runMixed(2, bows, raises, sits, s(130));
  check("mixed B, no takbeer seen: all bows in order at the end", res.misses === 0 && res.extras === 0 && res.pairs.every((p, i) => p.j === i));
}
{ // B with no raise seen at all (hand tool off): the long reading of rak'ah 2 still puts it right
  const bows = [bow(43, 48), bow(51, 56), bow(58, 63), ...r2Bows];
  const { res } = runMixed(2, bows, [], [{ t: s(40) }], s(130), false);
  check("mixed B, hand tool off: all bows in order", res.misses === 0 && res.extras === 0 && res.pairs.every((p, i) => p.j === i),
    res.pairs.map((p) => slotName(p.j)).join(", "));
}

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
