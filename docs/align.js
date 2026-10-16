// Decides which step of the prayer each bow was, by looking at the whole prayer so far.
//
// The camera gives a list of bows (the head came closer / lower, then went back) and hand raises.
// A prayer has a fixed shape: each rak'ah is  reading - ruku - rising - sujood - sitting - sujood,
// the pauses between the bows have typical lengths (reading and tashahhud long; rising and the
// sitting between the sujoods short), and both hands go up at known places (before and after the
// ruku, and standing up for rak'ah 3). Instead of fixing mistakes one at a time, the whole list is
// matched against that shape and the best-fitting match wins: a bow the camera missed or a bow that
// was only a twitch costs points, and so do pauses of the wrong length and raises in the wrong place.
// When nothing points to a mistake, the bows are simply counted in order.

export function buildSteps(n) {
  const s = [];
  for (let r = 1; r <= n; r++) {
    if (r === 3) s.push({ g: "mid", label: "التشهد الأوسط", pose: "far", tone: 1, mid: true });
    s.push({ g: r, label: "القراءة (الفاتحة والسورة)", pose: "far" });
    s.push({ g: r, label: "الركوع", pose: "near" });
    s.push({ g: r, label: "الرفع من الركوع", pose: "far" });
    s.push({ g: r, label: "السجدة الأولى", pose: "near" });
    s.push({ g: r, label: "الجلسة بين السجدتين", pose: "far" });
    s.push({ g: r, label: "السجدة الثانية", pose: "near" });
  }
  s.push({ g: "end", label: "التشهد الأخير والسلام", pose: "far", tone: 2, last: true });
  return s;
}

export const COST = {
  miss: 4,            // a sujood of the prayer that the camera did not see
  missRuku: 3.8,      // a ruku the camera did not see: a bit more likely (when sitting it is the smallest move)...
  missRukuStanding: 4.2, // ...but a standing ruku is a big move: less likely to be missed than a sujood
  extra: 4,           // a bow the camera saw that is not part of the prayer (a twitch, adjusting)
  shortMax: 6000,     // rising and the sitting between the sujoods rarely last longer than this...
  longPer: 2500,      // ...each 2.5 s more costs 1 point...
  longCap: 6,         // ...but never more than 6
  readingMin: 2500,   // a reading or tashahhud shorter than this costs a little
  readingShort: 0.5,
  earlyMs: 4000,      // "right after a bow": a raise this soon after it is the "sami' Allahu" raise
  lateMs: 3000,       // a takbeer before ruku comes at least this long after the pause began
  raiseItidal: -1.5,  // raise right after a ruku: fits
  raiseReading: -1,   // takbeer before ruku, or standing up for rak'ah 3: fits
  raiseExtra: 2,      // one raise too many in a reading pause
  raiseJalsa: 3,      // hands never go up between the two sujoods
  raiseLast: 2,       // ...nor in the last tashahhud
  rukuLost: 1.5,      // a ruku rarely hides the face low in the picture for long (a sujood does)
  lostLowMs: 1500,
  sitWanted: -2,      // "first rak'ah standing": sitting down on the chair comes right before rak'ah 2's reading
  sitElsewhere: 1,    // ...anywhere else it fits less well
};

// The pause just before bow slot j (slot 3n = after the last bow, the last tashahhud).
export function pauseType(j, n) {
  if (j >= 3 * n) return "last";
  const k = j % 3, r = Math.floor(j / 3) + 1;
  if (k === 1) return "itidal";
  if (k === 2) return "jalsa";
  return r === 3 ? "mid" : "reading"; // rak'ah 3 starts after the middle tashahhud
}

// Fajr: the rising of the 2nd rak'ah may hold a long qunut, so its length says nothing.
const isQunut = (j, n) => n === 2 && j === 4;

function pauseCost(type, from, to, raises, open, qunut, sits = [], sitWanted = false) {
  let c = 0;
  const dur = to - from;
  if ((type === "itidal" && !qunut) || type === "jalsa") {
    c += Math.min(COST.longCap, Math.max(0, dur - COST.shortMax) / COST.longPer);
  }
  if ((type === "reading" || type === "mid") && !open && dur < COST.readingMin) c += COST.readingShort;
  for (const sd of sits) if (sd.t >= from && sd.t < to) c += sitWanted ? COST.sitWanted : COST.sitElsewhere;
  let fitted = 0;
  for (const r of raises) {
    if (r.t < from || r.t >= to) continue;
    const since = r.t - from;
    if (type === "itidal") c += since <= COST.earlyMs && fitted++ === 0 ? COST.raiseItidal : 0;
    else if (type === "jalsa") c += COST.raiseJalsa;
    else if (type === "last") c += COST.raiseLast;
    else if (since >= COST.lateMs) c += fitted++ < (type === "mid" ? 2 : 1) ? COST.raiseReading : COST.raiseExtra;
  }
  return c;
}

function matchCost(bow, j) {
  if (bow.virtual) return 0;
  return j % 3 === 0 && (bow.lostLowMs || 0) >= COST.lostLowMs ? COST.rukuLost : 0;
}

// bows: [{ s, e (null while still bowed), lostLowMs, virtual, ignored }], raises: [{ t }]
// Returns the matched pairs { a (index into the returned bows), j (slot) } in order and the cost.
// sits: times the person sat down on the chair ("first rak'ah standing" only: mixed = true).
// standing: how many rak'ahs (from the first) are prayed standing (0 sitting, 1 mixed, n standing).
export function alignPrayer({ n, bows, raises = [], sits = [], mixed = false, standing = 0, t0, now }) {
  const B = bows.filter((b) => !b.ignored);
  const m = B.length, S = 3 * n;
  const cost = Array.from({ length: m }, () => new Array(S).fill(Infinity));
  const prev = Array.from({ length: m }, () => new Array(S).fill(null));
  // bows a..k-1 left out as extras (a bow added by hand can never be left out)
  const extras = (a, k) => { let c = 0; for (let i = a; i < k; i++) { if (B[i].virtual) return Infinity; c += COST.extra; } return c; };
  // cost of missing the slots j1..j2-1
  const missUpTo = [0];
  const rukuMiss = (j) => (Math.floor(j / 3) < standing ? COST.missRukuStanding : COST.missRuku);
  for (let j = 0; j < S; j++) missUpTo.push(missUpTo[j] + (j % 3 === 0 ? rukuMiss(j) : COST.miss));
  const misses = (j1, j2) => missUpTo[j2] - missUpTo[j1];
  // the pause just before slot j: its cost (sitting down is expected before rak'ah 2's ruku, slot 3)
  const pause = (j, from, to, open) => pauseCost(pauseType(j, n), from, to, raises, open, isQunut(j, n), sits, mixed && j === 3);
  // a stretch where bows were missed (slots j1..j2-1 not seen): if it spans the place where the
  // person sits down (just before rak'ah 2's ruku), a sitting down inside it still fits
  const skipped = (j1, j2, from, to) => {
    if (!mixed || !(j1 <= 3 && 3 <= j2)) return 0;
    return sits.some((sd) => sd.t >= from && sd.t < to) ? COST.sitWanted : 0;
  };

  for (let a = 0; a < m; a++) {
    for (let j = 0; j < S; j++) {
      // straight from the start of the prayer
      let best = extras(0, a) + misses(0, j) + (j === 0 ? pause(0, t0, B[a].s, false) : skipped(0, j, t0, B[a].s));
      let from = null;
      for (let a2 = 0; a2 < a; a2++) {
        const ex = extras(a2 + 1, a);
        if (ex === Infinity) continue;
        for (let j2 = 0; j2 < j; j2++) {
          if (cost[a2][j2] === Infinity) continue;
          let c = cost[a2][j2] + ex + misses(j2 + 1, j);
          if (j === j2 + 1) c += pause(j, B[a2].e ?? B[a2].s, B[a].s, false);
          else c += skipped(j2 + 1, j, B[a2].e ?? B[a2].s, B[a].s);
          if (c < best) { best = c; from = [a2, j2]; }
        }
      }
      cost[a][j] = best + matchCost(B[a], j);
      prev[a][j] = from;
    }
  }

  // the end: the last matched bow, any later bows as extras, then the pause going on until now
  let total = extras(0, m) + pause(0, t0, now, true);
  let end = null;
  for (let a = 0; a < m; a++) {
    const ex = extras(a + 1, m);
    if (ex === Infinity) continue;
    for (let j = 0; j < S; j++) {
      if (cost[a][j] === Infinity) continue;
      let c = cost[a][j] + ex;
      if (B[a].e != null) c += pause(j + 1, B[a].e, now, true);
      if (c < total) { total = c; end = [a, j]; }
    }
  }
  const pairs = [];
  for (let p = end; p; p = prev[p[0]][p[1]]) pairs.unshift({ a: p[0], j: p[1] });
  return { pairs, cost: total, bows: B, misses: pairs.length ? pairs[pairs.length - 1].j + 1 - pairs.length : 0, extras: m - pairs.length };
}

// Turns a match into the app's steps: which step is going on now, and when each step began.
// Steps the camera missed get no time (they start where the next one starts) and show as "—".
export function timeline({ steps, pairs, bows, raises = [], t0, now, armMs = 3000 }) {
  const nearIdx = steps.map((s, i) => (s.pose === "near" ? i : -1)).filter((i) => i >= 0); // slot -> step
  const st = new Array(steps.length).fill(undefined);
  st[0] = t0;
  let ptr = 0;
  pairs.forEach(({ a, j }, p) => {
    const b = bows[a], k = nearIdx[j];
    st[k] = b.s;
    ptr = k;
    if (b.e == null) return;
    st[k + 1] = b.e;
    ptr = k + 1;
    if (steps[k + 1].mid) {
      // the middle tashahhud ends at the first raise 3 s or more into it (standing up for rak'ah 3)
      const next = pairs[p + 1] ? bows[pairs[p + 1].a].s : Infinity;
      const up = raises.find((r) => r.t >= b.e + armMs && r.t < next);
      if (up) { st[k + 2] = up.t; ptr = k + 2; }
    }
  });
  // a ruku the camera missed, with both its raises seen (takbeer before, "sami' Allahu" after):
  // it took place between those two raises
  pairs.forEach(({ a, j }, p) => {
    if (j % 3 !== 1) return; // the 1st sujood is matched...
    const k = nearIdx[j - 1];
    if (st[k] !== undefined || (p > 0 && pairs[p - 1].j === j - 1)) return; // ...and its ruku was missed
    const before = p > 0 ? bows[pairs[p - 1].a].e : t0;
    const inPause = raises.filter((r) => r.t > before && r.t < bows[a].s);
    if (inPause.length >= 2) { st[k] = inPause[inPause.length - 2].t; st[k + 1] = inPause[inPause.length - 1].t; }
  });
  st.length = ptr + 1;
  for (let i = ptr - 1; i >= 0; i--) if (st[i] === undefined) st[i] = st[i + 1];
  return { ptr, starts: st };
}
