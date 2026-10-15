// Prayer counter for praying seated on a chair, standing, or standing for the first rak'ah only.
// The front camera finds the face. Coming toward the phone makes the face bigger ("near");
// moving back makes it smaller ("far"). Each move is compared with the one just before it
// (not with a fixed size), so it works standing, sitting, and when switching between them.
// Every change moves the prayer one step on:
// reading -> ruku -> rising -> sujood -> sitting -> sujood -> next rak'ah ... -> last tashahhud.
// The middle tashahhud ends when the hands come up beside the face for "Allahu Akbar".
// After the last tashahhud, turning the head right then left (the salam) ends the prayer.

// Version of this app (shown on the start screen; see CHANGELOG.md).
const APP_VERSION = 6;

const MP_VERSION = "0.10.14";
const MP_BUNDLE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/vision_bundle.mjs`;
const MP_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
const MP_MODEL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";
const MP_HAND_MODEL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const PRAYERS = {
  fajr: { name: "الفجر", n: 2 },
  dhuhr: { name: "الظهر", n: 4 },
  asr: { name: "العصر", n: 4 },
  maghrib: { name: "المغرب", n: 3 },
  isha: { name: "العشاء", n: 4 },
};
const ORD = ["", "الأولى", "الثانية", "الثالثة", "الرابعة"];
const HIST_KEY = "prayerCounter.history";
const SENS_KEY = "prayerCounter.sens";       // + ".front" / ".lap"
const PLACE_KEY = "prayerCounter.place";
const DIAG_KEY = "prayerCounter.diag";
const POSTURE_KEY = "prayerCounter.posture";

// How the prayer is done. Standing (and standing first) needs the phone on the floor in front
// of the place of sujood, leaning back so it looks up at the face.
const POSTURES = {
  sit: { name: "قاعد على الكرسي", calib: "اقعد مستقيم وبص للموبايل" },
  stand: { name: "واقف", calib: "اقف مستقيم وبص للموبايل",
    hint: "حط الموبايل على الأرض قدام مكان السجود، مسنود لورا علشان يشوفك وانت واقف." },
  mixed: { name: "أول ركعة واقف", calib: "اقف مستقيم وبص للموبايل",
    hint: "حط الموبايل على الأرض قدام الكرسي، مسنود لورا علشان يشوفك واقف وقاعد." },
};

// Where the phone is. Each place keeps its own sensitivity: on the lap the face is closer,
// so leaning in makes it grow faster.
const PLACES = {
  front: { name: "قدامي", sens: 1.35, hint: "حط الموبايل قدامك على ترابيزة أو على الأرض، في مستوى وشك." },
  lap: { name: "على رجلي", sens: 1.6, hint: "حط الموبايل على رجلك والشاشة لفوق ناحية وشك." },
};

// Tuning
const CALIB_MS = 3000;       // sit straight this long to learn the normal face size
const NEAR_HOLD_MS = 200;    // must stay near this long to count
const FAR_HOLD_MS = 300;     // must stay far this long to count
const LOST_AS_NEAR_MS = 500; // face gone this long after growing = still leaning in
const SALAM_YAW = 0.3;       // how far the head must turn for the salam
const SALAM_LOST_YAW = 0.15; // face lost right after turning at least this far = a turn to that side
const SALAM_HOLD_MS = 200;
const SALAM_ARM_MS = 1000;   // salam is only watched 1 s into the last tashahhud
const HANDS_ARM_MS = 3000;   // raised hands are only watched 3 s into the middle tashahhud
const HANDS_HOLD_MS = 250;   // hands must stay up this long
const RUKU_SOON_MS = 6000;   // after the takbeer before ruku, a smaller bow counts for this long
const RUKU_SOON_SCORE = 0.6; // ...this much of a full lean is enough then
const TWO_RAISES_MS = 20000; // two raises this close with no bow between = a missed ruku
const BEHIND_MS = 5000;      // a raise in sujood/sitting means "the app is behind" only after this long there
const MIN_BOW_MS = 1000;     // a bow shorter than this is a twitch, not a ruku or sujood
const MIN_RISE_MS = 800;     // a rise shorter than this between two bows is a twitch too (a real one measures 1 s+)
const FRAME_MS = 66;         // look at the camera about 15 times a second

const SIM = new URLSearchParams(location.search).has("sim"); // test mode: no camera, feed values by hand
let simNow = 0;
const now = () => (SIM ? simNow : Date.now());

const $ = (id) => document.getElementById(id);
const ar = (n) => Number(n).toLocaleString("ar-EG");

// ---------- storage (may be blocked: never let it break the page) ----------
function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

const settings = {
  place: PLACES[load(PLACE_KEY, "front")] ? load(PLACE_KEY, "front") : "front",
  posture: POSTURES[load(POSTURE_KEY, "sit")] ? load(POSTURE_KEY, "sit") : "sit",
  sens: 1.35,
};
// Sensitivity is kept per setup: sitting with the phone in front, sitting with it on the lap,
// and standing (phone on the floor).
const sensSlot = () => (settings.posture === "sit" ? settings.place : "stand");
function loadSens() {
  const def = settings.posture === "sit" ? PLACES[settings.place].sens : 1.35;
  settings.sens = Number(load(`${SENS_KEY}.${sensSlot()}`, def)) || def;
}
loadSens();

// ---------- prayer steps ----------
function buildSteps(n) {
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

const app = {
  mode: "home",      // home | calib | takbeer | pray | done
  key: null,
  steps: [],
  ptr: 0,
  starts: [],
  t0: 0,
  end: 0,
  drawnPtr: -1,
};

// ---------- face tracking state ----------
// Two signals say "bowed": the face gets bigger (closer to the phone) and it moves down in the
// picture. valley/home = size and place of the face while upright; peak/low = biggest size and
// lowest place while bowed. Each move is measured from the end of the move before it.
const DOWN_FACES = 1.0;     // moving down by one face height counts as a full lean
const RISE_FACES = 0.6;     // moving back up by this many face heights counts as rising
const DEEP_LOST_MS = 1500;  // face gone this long in one bow = a deep bow (sujood)
const det = {
  ema: 0, pose: "far", cand: null, candSince: 0, valley: 0, peak: 0,
  pos: null, home: null, low: null, score: 0,
  lastSeen: 0, lastSize: 0, lastYaw: 0, yawHist: [], seen: false,
  calib: [], calibStart: 0,
  ev: null, // the current bow: { start, valley, peak, lostMs, lostSince, fixed }
  // to undo a twitch: what the last move changed
  nearAdvance: 0, prevValley: 0, prevHome: null,
  farSince: 0, farPtr: -1, farAdvance: 0, prevEv: null, prevLearn: null,
};
const learn = { ruku: [], sujood: [] }; // depth of the bows seen so far in this prayer
const sal = { side: 0, since: 0, first: 0, firstAt: 0 };
// up = a raise is going on (both hands up); a new raise needs the hands to come down first.
// rukuSoon = the takbeer before ruku was seen in this reading step.
const hands = { since: 0, up: false, downSince: 0, rukuSoon: null };

function resetTracking() {
  Object.assign(det, {
    ema: 0, pose: "far", cand: null, candSince: 0, valley: 0, peak: 0, pos: null, home: null, low: null, score: 0,
    lastSeen: 0, lastSize: 0, lastYaw: 0, yawHist: [], seen: false, calib: [], calibStart: 0, ev: null,
    nearAdvance: 0, prevValley: 0, prevHome: null, farSince: 0, farPtr: -1, farAdvance: 0, prevEv: null, prevLearn: null,
  });
  learn.ruku = []; learn.sujood = [];
  Object.assign(sal, { side: 0, since: 0, first: 0, firstAt: 0 });
  Object.assign(hands, { since: 0, up: false, downSince: 0, rukuSoon: null });
  rec.reset();
}

// How far into a bow the face is right now: 1 = enough to count. Size and moving down add up,
// so a small lean that also drops the head is still caught.
function leanScore(size) {
  let s = Math.max(0, (size / det.valley - 1) / (settings.sens - 1));
  if (det.pos && det.home) {
    const dy = (det.pos.cy - det.home.cy) / det.home.h; // + = lower in the picture, in face heights
    const dx = Math.abs(det.pos.cx - det.home.cx) / det.home.h;
    s += Math.max(0, dy) / DOWN_FACES + (0.5 * dx) / DOWN_FACES;
  }
  return s;
}

// w = face width as a share of the picture width (null = no face), yaw = head turn (-1..1 roughly),
// handsUp = a hand is raised beside the face, pos = face centre and height as shares of the picture
function onObservation(w, yaw, t, handsUp = false, pos = null) {
  det.seen = w != null;
  if (w != null) {
    det.lastSeen = t;
    det.ema = det.ema ? det.ema * 0.5 + w * 0.5 : w;
    det.lastYaw = yaw;
    det.yawHist.push([t, yaw]);
    while (det.yawHist.length && t - det.yawHist[0][0] > 700) det.yawHist.shift();
    const p = pos || { cx: 0.5, cy: 0.45, h: w };
    det.pos = det.pos ? { cx: det.pos.cx * 0.5 + p.cx * 0.5, cy: det.pos.cy * 0.5 + p.cy * 0.5, h: det.pos.h * 0.5 + p.h * 0.5 } : { ...p };
  }
  if (app.mode === "calib") return calibStep(w, t);
  if (app.mode === "takbeer") return takbeerStep(handsUp && uprightNow(), t);
  if (app.mode !== "pray") return;

  const down = 1 + (settings.sens - 1) * 0.7; // away: face this many times smaller than the peak
  let want = det.pose;
  if (w != null) {
    const size = det.ema;
    det.lastSize = size;
    if (det.pose === "far") {
      det.score = leanScore(size);
      // keep the smallest upright size; follow very slowly if the person settles closer
      det.valley = size < det.valley ? size : det.valley + (size - det.valley) * 0.002;
      if (det.score < 0.3 && det.home) det.home = { cx: det.home.cx * 0.95 + det.pos.cx * 0.05, cy: det.home.cy * 0.95 + det.pos.cy * 0.05, h: det.home.h * 0.95 + det.pos.h * 0.05 };
      // right after the takbeer before ruku a ruku is expected, so a smaller bow is enough
      const soon = hands.rukuSoon && hands.rukuSoon.ptr === app.ptr && t - hands.rukuSoon.at <= RUKU_SOON_MS;
      if (det.score >= (soon ? RUKU_SOON_SCORE : 1)) want = "near";
    } else {
      det.peak = Math.max(det.peak, size);
      if (!det.low || det.pos.cy > det.low.cy) det.low = { ...det.pos };
      const back = (det.low.cy - det.pos.cy) / det.low.h; // moved back up, in face heights
      if (size <= det.peak / down || (back >= RISE_FACES && size <= det.peak * 1.02)) want = "far";
      if (det.ev?.lostSince) { det.ev.lostMs += t - det.ev.lostSince; det.ev.lostSince = 0; }
      if (det.ev) det.ev.peak = Math.max(det.ev.peak, size);
    }
  } else if (det.pose === "far" && t - det.lastSeen > LOST_AS_NEAR_MS) {
    // face left the picture while coming close or going down (head bent in sujood)
    const atBottom = det.pos && det.pos.cy + det.pos.h / 2 > 0.92;
    if (det.score >= 0.5 || atBottom) want = "near";
  } else if (det.pose === "near") {
    det.peak = Math.max(det.peak, det.lastSize * 1.25); // lost while bowed: it got even closer
    if (det.ev && !det.ev.lostSince) det.ev.lostSince = det.lastSeen;
  }

  if (want !== det.pose) {
    if (det.cand !== want) { det.cand = want; det.candSince = t; }
    else if (t - det.candSince >= (want === "near" ? NEAR_HOLD_MS : FAR_HOLD_MS)) {
      const moveStart = det.candSince;
      det.pose = want; det.cand = null;
      // start the next comparison from where the move ended
      if (want === "near") {
        if (!undoShortRise(moveStart, t)) {
          det.prevValley = det.valley; det.prevHome = det.home ? { ...det.home } : null;
          det.peak = det.lastSize; det.low = det.pos ? { ...det.pos } : null;
          det.ev = { start: moveStart, valley: det.valley, peak: det.lastSize, lostMs: 0, lostSince: det.seen ? 0 : det.lastSeen, fixed: false };
          rec.event(t, want);
          const before = app.ptr;
          onPose(want, t);
          det.nearAdvance = app.ptr - before;
        }
      } else {
        if (det.ev?.lostSince) { det.ev.lostMs += t - det.ev.lostSince; det.ev.lostSince = 0; }
        if (!undoShortBow(moveStart, t)) {
          det.valley = det.lastSize; if (det.pos) det.home = { ...det.pos };
          const before = app.ptr;
          const learned = endOfBow(t);
          rec.event(t, want);
          onPose(want, t);
          Object.assign(det, { farSince: moveStart, farPtr: app.ptr, farAdvance: app.ptr - before, prevEv: det.ev, prevLearn: learned });
        }
      }
    }
  } else det.cand = null;

  if (det.pose === "near") fixMissedRuku(t);
  const raiseAt = handsEdge(handsUp && uprightNow(), t);
  if (raiseAt) onRaise(raiseAt, t);
  salamCheck(w != null, yaw, t);
  rec.sample(t);
}

// ---------- twitches: a move too short to be a real ruku, sujood or rise is undone ----------
function undoShortBow(moveStart, t) {
  const ev = det.ev;
  if (!ev || ev.fixed || moveStart - ev.start >= MIN_BOW_MS || isDeep(ev, t)) return false;
  if (det.nearAdvance !== 1 || app.steps[app.ptr].pose !== "near") return false;
  stepBack(); // the bow never happened: back to the step before, which keeps its time
  det.valley = det.prevValley || det.lastSize;
  if (det.prevHome) det.home = det.prevHome;
  det.ev = null;
  rec.event(t, "undo: short bow");
  return true;
}

function undoShortRise(moveStart, t) {
  if (!det.prevEv || det.farAdvance !== 1 || app.ptr !== det.farPtr || moveStart - det.farSince >= MIN_RISE_MS) return false;
  if (app.steps[app.ptr].pose !== "far") return false;
  stepBack(); // back into the bow before: the rise never happened
  det.ev = det.prevEv;
  det.prevEv = null;
  if (det.prevLearn) learn[det.prevLearn].pop();
  det.prevLearn = null;
  det.peak = Math.max(det.ev.peak, det.lastSize);
  det.low = det.pos ? { ...det.pos } : det.low;
  det.valley = det.ev.valley;
  if (det.prevHome) det.home = det.prevHome;
  rec.event(t, "undo: short rise");
  return true;
}

// The person is upright (seen from the face) - needed before a hand raise can count.
function uprightNow() {
  if (!det.seen || !det.valley) return false;
  if (det.pose === "far") return det.score < 1;
  const base = det.ev ? det.ev.valley : det.valley;
  return det.lastSize <= base * (1 + (settings.sens - 1) * 0.6);
}

// Returns the time a new raise began (both hands up, held), or 0. After a raise the hands must
// come down before the next one can count, so one long raise is never counted twice.
function handsEdge(up, t) {
  if (up) {
    hands.downSince = 0;
    if (hands.up) return 0;
    if (!hands.since) hands.since = t;
    if (t - hands.since >= HANDS_HOLD_MS) { hands.up = true; const at = hands.since; hands.since = 0; return at; }
    return 0;
  }
  hands.since = 0;
  if (hands.up) {
    if (!hands.downSince) hands.downSince = t;
    if (t - hands.downSince >= 300) { hands.up = false; hands.downSince = 0; }
  }
  return 0;
}

// ---------- self-correction from the order of the prayer ----------
// A sujood is a deeper bow than a ruku. If a deep bow comes while a ruku is expected, the ruku was
// missed: count it (with no time) and treat this bow as the sujood. If a shallow bow comes while
// the 2nd sujood is expected, that sujood was missed and this bow is the next rak'ah's ruku.
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const evLost = (ev, t) => ev.lostMs + (ev.lostSince ? t - ev.lostSince : 0);

function isDeep(ev, t) {
  const rukuLosesFace = learn.ruku.some((r) => r.lost >= DEEP_LOST_MS);
  if (evLost(ev, t) >= DEEP_LOST_MS && !rukuLosesFace) return true;
  if (learn.ruku.length && learn.sujood.length) {
    const r = median(learn.ruku.map((x) => x.ratio)), sj = median(learn.sujood.map((x) => x.ratio));
    if (sj >= r * 1.3 && ev.peak / ev.valley >= (r + sj) / 2) return true;
  }
  return false;
}

function isShallow(ev, t) {
  if (evLost(ev, t) >= 500 || !learn.ruku.length || !learn.sujood.length) return false;
  const r = median(learn.ruku.map((x) => x.ratio)), sj = median(learn.sujood.map((x) => x.ratio));
  const sujoodLoseFace = learn.sujood.filter((x) => x.lost >= DEEP_LOST_MS).length * 2 >= learn.sujood.length;
  if (!(sujoodLoseFace || sj >= r * 1.3)) return false; // sujood and ruku look alike: can't tell
  const ratio = ev.peak / ev.valley;
  return ratio <= r * 1.15 && ratio < (r + sj) / 2;
}

function fixMissedRuku(t) {
  const ev = det.ev, cur = app.steps[app.ptr];
  if (!ev || ev.fixed || cur.label !== "الركوع" || !isDeep(ev, t)) return;
  ev.fixed = true;
  const at = app.starts[app.ptr];
  advance(at); // rising: no time
  advance(at); // this bow is the 1st sujood
  rec.event(t, "fix: missed ruku");
}

// Called when a bow ends (the person moved back up), before the step moves on.
function endOfBow(t) {
  const ev = det.ev, cur = app.steps[app.ptr];
  if (!ev || cur.pose !== "near") return null;
  let label = cur.label;
  if (label === "السجدة الثانية" && !ev.fixed && isShallow(ev, t) && app.steps.slice(app.ptr + 1).some((s) => s.label === "الركوع")) {
    // the 2nd sujood was missed: give it (and the steps up to the ruku) no time
    const at = app.starts[app.ptr];
    while (app.steps[app.ptr].label !== "الركوع") advance(at);
    label = "الركوع";
    rec.event(t, "fix: missed 2nd sujood");
  }
  const depth = { ratio: ev.peak / ev.valley, lost: evLost(ev, t) };
  const kind = label === "الركوع" ? "ruku" : "sujood";
  learn[kind].push(depth);
  return kind;
}

// ---------- record of each prayer, to check a missed step afterwards ----------
// 4 samples a second: time (tenths of a second): size vs upright (%), lean score (%),
// face height in the picture (%), head turn (%), bowed (1/0). Size and height are -1 when no face.
const rec = {
  t0: 0, lastAt: 0, samples: [], events: [],
  reset() { this.t0 = 0; this.lastAt = 0; this.samples = []; this.events = []; },
  start(t) { this.reset(); this.t0 = t; },
  rel(t) { return Math.round((t - this.t0) / 100); },
  sample(t) {
    if (!this.t0 || t - this.lastAt < 250) return;
    this.lastAt = t;
    const seen = det.seen && det.valley;
    const size = seen ? Math.round((det.lastSize / det.valley) * 100) : -1;
    const cy = seen && det.pos ? Math.round(det.pos.cy * 100) : -1;
    this.samples.push(`${this.rel(t)}:${size},${Math.round(det.score * 100)},${cy},${Math.round(det.lastYaw * 100)},${det.pose === "near" ? 1 : 0}`);
  },
  event(t, what) { if (this.t0) this.events.push(`${this.rel(t)}:${what}`); },
};

// Is the hand detector needed on this frame? Everywhere except the last tashahhud.
function wantHands() {
  if (app.mode === "takbeer" || app.mode === "calib" || app.mode === "check") return true;
  return app.mode === "pray" && !app.steps[app.ptr]?.last;
}

// ---------- hand raises as checkpoints ----------
// Both hands go up at known places: the opening takbeer, the takbeer before ruku, "sami' Allahu
// liman hamidah" after ruku, and standing up for rak'ah 3. Where the app is decides what a raise
// means: in the right place it confirms the step; anywhere else the app missed something and
// catches up (the skipped steps get no time and show "—").
function onRaise(at, t) {
  const cur = app.steps[app.ptr];
  const inStep = t - app.starts[app.ptr];
  if (cur.last) return;

  if (cur.mid) { // standing up for rak'ah 3
    if (inStep < HANDS_ARM_MS) return;
    advance(at);
    rec.event(t, "raise: stand for rak'ah 3");
    return;
  }

  if (cur.label.startsWith("القراءة")) {
    const soon = hands.rukuSoon;
    if (soon && soon.ptr === app.ptr && at - soon.at <= TWO_RAISES_MS) {
      // a 2nd raise with no bow between: the ruku happened unseen, from the 1st raise to this one
      hands.rukuSoon = null;
      advance(soon.at); // ruku
      advance(at);      // rising
      rec.event(t, "fix: missed ruku (two raises)");
    } else {
      hands.rukuSoon = { at, ptr: app.ptr };
      rec.event(t, "raise: before ruku");
    }
    return;
  }

  if (cur.label === "الركوع") { // "sami' Allahu liman hamidah": already rising
    forceUpright(t);
    advance(at);
    rec.event(t, "raise: after ruku");
    return;
  }

  if (cur.label === "الرفع من الركوع") { rec.event(t, "raise: after ruku (confirms)"); return; }

  // sujood or sitting: the hands are down there, so a raise means the app is behind.
  // A raise right after entering the step is more likely a slip: wait a little first.
  if (inStep < BEHIND_MS) { rec.event(t, "raise ignored (just entered sujood/sitting)"); return; }
  const next = app.steps.findIndex((s, i) => i > app.ptr && (s.mid || s.label.startsWith("القراءة")));
  if (next < 0) return; // last rak'ah: nothing ahead to catch up to
  forceUpright(t);
  while (app.ptr < next) advance(at);
  if (app.steps[app.ptr].mid) {
    advance(at); // the raise was standing up for rak'ah 3
    rec.event(t, "fix: behind, raise = stand for rak'ah 3");
  } else {
    hands.rukuSoon = { at, ptr: app.ptr }; // the raise was the takbeer before ruku
    rec.event(t, "fix: behind, raise = before ruku");
  }
}

// A raise shows the person is upright: end the bow the app still thinks is going on.
function forceUpright(t) {
  Object.assign(det, { prevEv: null, prevLearn: null, farAdvance: 0, farSince: t, farPtr: -1 });
  if (det.pose !== "near") return;
  if (det.ev?.lostSince) { det.ev.lostMs += t - det.ev.lostSince; det.ev.lostSince = 0; }
  if (det.ev && app.steps[app.ptr].label === "الركوع") learn.ruku.push({ ratio: det.ev.peak / det.ev.valley, lost: evLost(det.ev, t) });
  det.pose = "far"; det.cand = null;
  det.valley = det.lastSize;
  if (det.pos) det.home = { ...det.pos };
  rec.event(t, "far (hands)");
}

function calibStep(w, t) {
  const msg = $("calibMsg");
  if (w == null) {
    if (t - det.lastSeen > 700) { det.calib = []; det.calibStart = 0; }
    msg.textContent = "مش شايف وشك. بص للموبايل.";
    $("calibBar").style.width = "0%";
    return;
  }
  if (!det.calibStart) det.calibStart = t;
  det.calib.push(w);
  const p = Math.min(1, (t - det.calibStart) / CALIB_MS);
  $("calibBar").style.width = `${Math.round(p * 100)}%`;
  const left = Math.ceil((CALIB_MS - (t - det.calibStart)) / 1000);
  msg.textContent = left > 0 ? `${POSTURES[settings.posture].calib}… ${ar(left)}` : "تمام";
  if (p >= 1 && det.calib.length >= 10) {
    const sorted = [...det.calib].sort((a, b) => a - b);
    det.valley = sorted[Math.floor(sorted.length / 2)];
    det.ema = det.valley;
    det.lastSize = det.valley;
    det.home = det.pos ? { ...det.pos } : { cx: 0.5, cy: 0.45, h: det.valley };
    waitForTakbeer();
  }
}

// After the face is learned: wait for the hands to go up for the opening "Allahu Akbar".
// The prayer clock starts at the moment the hands went up.
function waitForTakbeer() {
  app.mode = "takbeer";
  hands.since = 0;
  $("calibBar").style.width = "100%";
  $("startNow").hidden = false;
  takbeerMsg();
}
function takbeerMsg() {
  const msg = $("calibMsg");
  if (diag.hands === "loading") msg.textContent = "ثانية… أداة الإيد لسه بتتحمّل";
  else msg.textContent = "ارفع إيدك وكبّر تكبيرة الإحرام";
}
function takbeerStep(up, t) {
  if (diag.hands === "off" && !SIM) return startPrayer(t); // no hand tool on this phone: start now
  takbeerMsg();
  const at = handsEdge(up, t); // the hands stay "up" into the prayer, so this raise is not counted again
  if (at) startPrayer(at);
}

function onPose(pose, t) {
  // Normally one step. If the raised hands were missed, the lean into ruku skips the
  // reading of rak'ah 3 too (it is then shown as "—").
  for (let i = 0; i < 3 && app.steps[app.ptr].pose !== pose && app.ptr < app.steps.length - 1; i++) advance(t);
}

function advance(t) {
  if (app.ptr >= app.steps.length - 1) return;
  app.ptr++;
  app.starts[app.ptr] = t;
  const s = app.steps[app.ptr];
  if (s.tone) cue(s.tone);
  if (s.last) Object.assign(sal, { side: 0, since: t, first: 0, firstAt: 0 });
  rec.event(t, `step ${app.ptr}`);
  renderLive(true);
}

function stepBack() {
  if (app.ptr === 0) return;
  app.starts.length = app.ptr;
  app.ptr--;
  rec.event(now(), `back to step ${app.ptr}`);
  renderLive(true);
}

function salamCheck(seen, yaw, t) {
  const cur = app.steps[app.ptr];
  if (!cur.last || t - app.starts[app.ptr] < SALAM_ARM_MS) return;
  let side = 0;
  if (seen) side = yaw > SALAM_YAW ? 1 : yaw < -SALAM_YAW ? -1 : 0;
  else if (t - det.lastSeen > 300) {
    // the face tool often loses a face turned far away: use the strongest turn just before
    const strongest = det.yawHist.reduce((a, [, y]) => (Math.abs(y) > Math.abs(a) ? y : a), 0);
    if (Math.abs(strongest) > SALAM_LOST_YAW) side = Math.sign(strongest);
  }

  if (side !== sal.side) { sal.side = side; sal.since = t; return; }
  if (side === 0 || t - sal.since < SALAM_HOLD_MS) return;
  if (!sal.first || side === sal.first) { sal.first = side; sal.firstAt = t; }
  else if (t - sal.firstAt < 20000) finish(t, "salam");
}

// ---------- sound: spoken words (built into the phone, no internet) or a tone ----------
const ALERT_KEY = "prayerCounter.alert";
const ALERTS = { voice: "كلام", tone: "نغمة", off: "من غير صوت" };
const CUE_WORDS = { 1: "التشهد الأوسط", 2: "التشهد الأخير" };
settings.alert = ALERTS[load(ALERT_KEY, "voice")] ? load(ALERT_KEY, "voice") : "voice";

let actx = null;
let arVoice = null;
function pickVoice() {
  try {
    const voices = speechSynthesis.getVoices();
    arVoice = voices.find((v) => v.lang?.toLowerCase().startsWith("ar")) || null;
  } catch { arVoice = null; }
}
try { pickVoice(); speechSynthesis.addEventListener?.("voiceschanged", pickVoice); } catch { /* no speech */ }

// Must run inside a tap: phones only allow sound that a tap started.
function initAudio() {
  // iPhone: treat our sound as playback, so the silent switch does not mute it
  try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch { /* ignore */ }
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    actx.resume();
    const b = actx.createBuffer(1, 1, 22050); // a silent blip unlocks the sound on iPhone
    const src = actx.createBufferSource();
    src.buffer = b; src.connect(actx.destination); src.start(0);
  } catch { actx = null; }
  // unlock the tone players: play them silently once inside the tap
  for (const a of tonePlayers()) {
    try {
      a.muted = true;
      a.play().then(() => { a.pause(); a.currentTime = 0; a.muted = false; }).catch(() => { a.muted = false; });
    } catch { /* ignore */ }
  }
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    speechSynthesis.speak(u); // unlocks speaking later without a tap
    pickVoice();
  } catch { /* no speech */ }
}

// kind 1 = middle tashahhud, 2 = last tashahhud
function cue(kind) {
  try { navigator.vibrate?.(kind === 1 ? 180 : [180, 140, 180]); } catch { /* ignore */ }
  if (settings.alert === "off") return;
  if (settings.alert === "voice" && speak(CUE_WORDS[kind])) return;
  beep(kind);
}

function speak(text) {
  try {
    if (!window.speechSynthesis) return false;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = arVoice?.lang || "ar-SA";
    if (arVoice) u.voice = arVoice;
    u.rate = 0.9;
    u.volume = 1;
    speechSynthesis.speak(u);
    return true;
  } catch { return false; }
}

// The tones are small WAV files made here (no download) and played with the normal audio
// player, which iPhone plays reliably; the Web Audio tone below is only a fallback.
function toneWav(count) {
  const rate = 22050, beepLen = 0.32, gap = 0.12;
  const total = Math.round(rate * (count * beepLen + (count - 1) * gap + 0.05));
  const data = new Int16Array(total);
  for (let b = 0; b < count; b++) {
    const start = Math.round(rate * b * (beepLen + gap));
    const len = Math.round(rate * beepLen);
    for (let i = 0; i < len; i++) {
      const tt = i / rate;
      const env = Math.min(1, tt / 0.02) * Math.exp(-tt * 9); // quick rise, soft fade
      data[start + i] = Math.round(Math.sin(2 * Math.PI * 720 * tt) * env * 0.6 * 32767);
    }
  }
  const buf = new ArrayBuffer(44 + data.byteLength);
  const v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + data.byteLength, true); str(8, "WAVE");
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, data.byteLength, true);
  new Int16Array(buf, 44).set(data);
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}
let tones = null;
function tonePlayers() {
  if (!tones) {
    try { tones = { 1: new Audio(toneWav(1)), 2: new Audio(toneWav(2)) }; } catch { tones = {}; }
  }
  return Object.values(tones);
}

function beep(count) {
  tonePlayers();
  const a = tones[count];
  if (a) {
    try {
      a.muted = false;
      a.currentTime = 0;
      a.play().catch(() => webBeep(count));
      return;
    } catch { /* fall back */ }
  }
  webBeep(count);
}

function webBeep(count) {
  if (!actx) return;
  try { if (actx.state !== "running") actx.resume(); } catch { /* ignore */ } // the camera can pause the sound
  for (let i = 0; i < count; i++) {
    const at = actx.currentTime + 0.05 + i * 0.42;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = "sine";
    o.frequency.value = 720;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.35, at + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.32);
    o.connect(g).connect(actx.destination);
    o.start(at);
    o.stop(at + 0.35);
  }
}

// ---------- keep the screen on ----------
let wakeLock = null;
async function keepAwake() {
  try { wakeLock = await navigator.wakeLock?.request("screen"); } catch { wakeLock = null; }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && (app.mode === "pray" || app.mode === "calib")) keepAwake();
});

// ---------- status line (so a problem on the phone can be seen and reported) ----------
const diag = { face: "-", hands: "-", frames: 0, faces: 0, handsUp: 0, err: "" };
let diagShownAt = 0;
function setDiagVisible(on) {
  document.body.classList.toggle("show-diag", on);
  save(DIAG_KEY, on);
}
function showDiag(force) {
  const t = Date.now();
  if (!force && t - diagShownAt < 500) return;
  diagShownAt = t;
  const v = $("video");
  const text = `face: ${diag.face} · hands: ${diag.hands} · frames: ${diag.frames} · faces: ${diag.faces} · hands up: ${diag.handsUp} · turn: ${det.lastYaw.toFixed(2)} · size: ${det.valley ? (det.lastSize / det.valley).toFixed(2) : "-"} · video: ${v.videoWidth}x${v.videoHeight}` + (diag.err ? ` · error: ${diag.err}` : "");
  for (const el of document.querySelectorAll(".diag")) el.textContent = text;
}

// ---------- camera + face detection ----------
let detector = null;
let handDetector = null; // optional: without it the middle tashahhud ends at the ruku lean
let handTick = 0, lastHandsUp = false, lastHandCount = 0;
let stream = null;
let loopOn = false;
let lastVideoTime = -1;

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error("timeout")), ms))]);

async function loadHands(files) {
  diag.hands = "loading";
  try {
    const { HandLandmarker } = await import(MP_BUNDLE);
    handDetector = await withTimeout(HandLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: MP_HAND_MODEL, delegate: "CPU" },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.4,
    }), 60000);
    diag.hands = "ready";
  } catch (e) {
    handDetector = null;
    diag.hands = "off";
    diag.err = "hands: " + String(e?.message || e);
  }
}

async function startCamera() {
  const msg = $("calibMsg");
  if (!navigator.mediaDevices?.getUserMedia) {
    msg.textContent = "الموبايل مش سامح بالكاميرا هنا. لازم تفتح الصفحة من رابط https.";
    return false;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
  } catch {
    msg.textContent = "الكاميرا اتقفلت. اسمح للصفحة تستخدم الكاميرا من إعدادات المتصفح وجرب تاني.";
    return false;
  }
  const video = $("video");
  video.srcObject = stream;
  await video.play().catch(() => {});

  if (!detector) {
    msg.textContent = "بنحمّل أداة التعرّف على الوش… (أول مرة بس)";
    diag.face = "loading";
    showDiag(true);
    try {
      const { FaceDetector, FilesetResolver } = await import(MP_BUNDLE);
      const files = await FilesetResolver.forVisionTasks(MP_WASM);
      const make = (delegate) => FaceDetector.createFromOptions(files, {
        baseOptions: { modelAssetPath: MP_MODEL, delegate },
        runningMode: "VIDEO",
        minDetectionConfidence: 0.4,
      });
      // CPU: the GPU path can hang on iPhone, and this small model is fast enough on CPU
      detector = await withTimeout(make("CPU"), 30000);
      diag.face = "ready";
      showDiag(true);
      loadHands(files); // in the background: the prayer must never wait for it
    } catch (e) {
      diag.err = String(e?.message || e);
      diag.face = "failed";
      showDiag(true);
      msg.textContent = "معرفتش أحمّل أداة التعرّف على الوش. اتأكد إن النت شغال وجرب تاني.";
      stopCamera();
      return false;
    }
  }
  loopOn = true;
  frame();
  return true;
}

function stopCamera() {
  loopOn = false;
  if (stream) stream.getTracks().forEach((tr) => tr.stop());
  stream = null;
  const video = $("video");
  video.srcObject = null;
  document.querySelector(".cam-wrap").prepend(video); // back to the big preview for next time
}

function frame() {
  if (!loopOn) return;
  const video = $("video");
  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    let w = null, yaw = 0, box = null, handsUp = false, pos = null, handRes = null;
    const t = Date.now();
    try {
      const res = detector.detectForVideo(video, performance.now());
      diag.frames++;
      const d = pickFace(res.detections);
      if (d) diag.faces++;
      if (d) {
        box = d.boundingBox;
        w = box.width / video.videoWidth;
        pos = {
          cx: (box.originX + box.width / 2) / video.videoWidth,
          cy: (box.originY + box.height / 2) / video.videoHeight,
          h: box.height / video.videoHeight,
        };
        const k = d.keypoints;
        if (k && k.length >= 3) {
          const eyeMid = (k[0].x + k[1].x) / 2;
          const eyeGap = Math.abs(k[0].x - k[1].x) || 0.001;
          yaw = (k[2].x - eyeMid) / eyeGap;
        }
      }
      if (handDetector && wantHands()) {
        // during the prayer every other frame (about 7 a second) is enough for a raise, and saves battery
        if (app.mode !== "pray" || (handTick++ & 1) === 0) {
          handRes = handDetector.detectForVideo(video, performance.now());
          lastHandsUp = handsRaised(handRes, box, video);
          lastHandCount = handRes?.landmarks?.length || 0;
        }
        handsUp = lastHandsUp;
        if (handsUp) diag.handsUp++;
      } else { lastHandsUp = false; lastHandCount = 0; }
    } catch (e) { diag.err = String(e?.message || e); }
    showDiag();
    if (app.mode === "calib" || app.mode === "takbeer" || app.mode === "check") drawOverlay(box, handRes, video, handsUp);
    if (app.mode === "check") checkStep(w, handsUp, lastHandCount, t);
    onObservation(w, yaw, t, handsUp, pos);
    if (app.mode === "pray") renderMeter();
  }
  setTimeout(frame, FRAME_MS); // a plain timer: animation frames can be held back by the browser
}

// A raise = BOTH hands up beside the face, as for a takbeer: one hand on each side of the face,
// out to the side (not folded in front of the chest), between a bit above the face and a bit
// below the chin. One hand (scratching), hands on the chest, the lap or the floor never count.
function handsRaised(res, faceBox, video) {
  const list = res?.landmarks;
  if (!faceBox || !list || list.length < 2) return false;
  const W = video.videoWidth, H = video.videoHeight;
  const fcx = (faceBox.originX + faceBox.width / 2) / W;
  const fw = faceBox.width / W, fh = faceBox.height / H;
  const top = faceBox.originY / H - 0.5 * fh;
  const low = (faceBox.originY + faceBox.height) / H + 0.6 * fh;
  let left = false, right = false;
  for (const pts of list) {
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    if (cy < top || cy > low) continue;              // not at the height of a takbeer
    const side = (cx - fcx) / fw;                     // in face widths from the middle of the face
    if (side <= -0.45 && side >= -2.5) left = true;
    else if (side >= 0.45 && side <= 2.5) right = true;
  }
  return left && right;
}

function pickFace(list) {
  if (!list || !list.length) return null;
  return list.reduce((a, b) => (b.boundingBox.width > a.boundingBox.width ? b : a));
}

// The camera picture gets a box around the face and a dot on each joint of each hand seen.
// The dots turn green when both hands are up as for a takbeer.
function drawOverlay(box, handRes, video, bothUp) {
  const c = $("overlay");
  const ctx = c.getContext("2d");
  c.width = video.videoWidth || 640;
  c.height = video.videoHeight || 480;
  ctx.clearRect(0, 0, c.width, c.height);
  const css = getComputedStyle(document.documentElement);
  const color = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  if (box) {
    ctx.strokeStyle = color("--lamp", "#d6b26b");
    ctx.lineWidth = 4;
    ctx.strokeRect(box.originX, box.originY, box.width, box.height);
  }
  const r = Math.max(4, c.width / 110);
  ctx.fillStyle = bothUp ? color("--ok", "#74c095") : color("--text", "#e6ede9");
  for (const pts of handRes?.landmarks || []) {
    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(p.x * c.width, p.y * c.height, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Placement check: says what the camera sees, so the phone can be moved until the face and both
// raised hands fit in the picture. Raising the hands here does not start a prayer.
const placeCheck = { goodUntil: 0 };
function checkStep(w, bothUp, handCount, t) {
  const msg = $("calibMsg");
  if (bothUp) placeCheck.goodUntil = t + 1500; // keep the good news on screen a moment
  let text;
  if (t < placeCheck.goodUntil) text = "شايف إيديك الاتنين ✓ المكان ده مظبوط";
  else if (w == null) text = "مش شايف وشك. حط الموبايل قدامك وبص له.";
  else if (w < 0.07) text = "وشك صغير أوي. قرّب الموبايل شوية.";
  else if (diag.hands === "loading") text = "شايف وشك ✓ ثانية، أداة الإيد بتتحمّل…";
  else if (diag.hands === "off") text = "شايف وشك ✓ بس أداة الإيد مش شغالة على الموبايل ده.";
  else if (handCount === 1) text = "شايف إيد واحدة بس. ابعد الموبايل شوية علشان الإيدين يبانوا.";
  else if (handCount >= 2) text = "شايف إيديك. ارفعهم جنب وشك زي التكبير.";
  else text = "شايف وشك ✓ ارفع إيديك الاتنين زي التكبير.";
  msg.textContent = text;
  msg.classList.toggle("good", t < placeCheck.goodUntil);
}

// ---------- screens ----------
function show(id) {
  for (const s of document.querySelectorAll(".screen")) s.hidden = s.id !== id;
}

async function choosePrayer(key) {
  initAudio();
  keepAwake();
  resetTracking();
  app.key = key;
  app.mode = "calib";
  $("calibTitle").textContent = `صلاة ${PRAYERS[key].name}`;
  $("calibMsg").textContent = "بنشغّل الكاميرا…";
  $("calibHint").textContent = POSTURES[settings.posture].hint || PLACES[settings.place].hint;
  $("calibBar").style.width = "0%";
  $("calibBar").parentElement.hidden = false;
  $("calibMsg").classList.remove("good");
  $("startNow").hidden = true;
  $("calibCancel").textContent = "إلغاء";
  show("calib");
  if (SIM) { $("calibMsg").textContent = "وضع التجربة: مفيش كاميرا"; return; }
  const ok = await startCamera();
  if (!ok) app.mode = "home";
}

async function startPlacementCheck() {
  keepAwake();
  resetTracking();
  app.mode = "check";
  placeCheck.goodUntil = 0;
  $("calibTitle").textContent = "اختبار مكان الموبايل";
  $("calibMsg").textContent = "بنشغّل الكاميرا…";
  $("calibMsg").classList.remove("good");
  $("calibHint").textContent = POSTURES[settings.posture].hint || PLACES[settings.place].hint;
  $("calibBar").parentElement.hidden = true;
  $("startNow").hidden = true;
  $("calibCancel").textContent = "رجوع";
  show("calib");
  if (SIM) { $("calibMsg").textContent = "وضع التجربة: مفيش كاميرا"; return; }
  const ok = await startCamera();
  if (!ok) app.mode = "home";
}

function startPrayer(t) {
  if (app.mode !== "calib" && app.mode !== "takbeer") return;
  $("startNow").hidden = true;
  const p = PRAYERS[app.key];
  app.mode = "pray";
  app.steps = buildSteps(p.n);
  app.ptr = 0;
  app.starts = [t];
  app.t0 = t;
  app.end = 0;
  app.drawnPtr = -1;
  rec.start(t);
  rec.event(t, `start ${app.key} ${settings.posture}/${settings.place} sens ${settings.sens}`);
  $("pName").textContent = `صلاة ${p.name}`;
  // keep the video on screen (small), so the phone does not pause a hidden camera
  const video = $("video");
  $("thumb").appendChild(video);
  video.play().catch(() => {});
  show("pray");
  const f = $("flash");
  f.hidden = false;
  setTimeout(() => { f.hidden = true; }, 1600);
  renderLive(true);
}

function finish(t, how) {
  if (app.mode !== "pray") return;
  app.mode = "done";
  app.end = t;
  stopCamera();
  try { wakeLock?.release(); } catch { /* ignore */ }
  const p = PRAYERS[app.key];
  const segs = app.steps.slice(0, app.ptr + 1).map((s, i) => ({
    g: s.g, label: s.label, start: app.starts[i], end: app.starts[i + 1] ?? t,
  }));
  rec.event(t, `end ${how}`);
  const entry = {
    id: app.t0, v: APP_VERSION, key: app.key, name: p.name, n: p.n, place: settings.place, posture: settings.posture,
    t0: app.t0, end: t, how, segs,
    trace: { sens: settings.sens, events: rec.events.join("; "), samples: rec.samples.join(" ") },
  };
  rec.reset();
  const hist = load(HIST_KEY, []);
  hist.unshift(entry);
  hist.forEach((r, i) => { if (i >= 10) delete r.trace; }); // keep the detailed record of the last 10 only
  save(HIST_KEY, hist.slice(0, 200));
  showReport(entry);
}

// The record as plain text, to paste in a chat when a step was missed.
function traceText(r) {
  const head = `prayer-counter v${r.v ?? "?"} ${r.name} ${new Date(r.t0).toISOString()} posture=${r.posture} place=${r.place} sens=${r.trace.sens}`;
  const steps = r.segs.map((s, i) => `${i}:${s.label}=${((s.end - s.start) / 1000).toFixed(1)}s`).join(" | ");
  return `${head}\nSTEPS ${steps}\nEVENTS ${r.trace.events}\nSAMPLES t:size,score,y,turn,bowed ${r.trace.samples}`;
}

// ---------- rendering ----------
function fmt(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return (h ? `${h}:` : "") + `${mm}:${String(x).padStart(2, "0")}`;
}

const isRakah = (g) => typeof g === "number" && g > 0;
function groupName(g) {
  if (isRakah(g)) return `الركعة ${ORD[g]}`;
  return g === "mid" ? "التشهد الأوسط" : "التشهد الأخير والسلام"; // old saved prayers used 0 for the end
}
// A step skipped by the camera (a few ms long) shows as a dash
const dur = (s, curIdx) => (s.i !== curIdx && s.end - s.start < 300 ? "—" : fmt(s.end - s.start));

// Short names for the six cells of a rak'ah row
const CELL = ["القراءة", "الركوع", "الرفع", "سجدة ١", "الجلسة", "سجدة ٢"];

// One row per rak'ah: six cells (only the ones reached so far) and the rak'ah total at the end.
// The two tashahhuds get their own big band, with space around it.
// segs: [{g,label,start,end}], curIdx: index of the live step or -1
function logHTML(segs, curIdx) {
  const groups = [];
  segs.forEach((s, i) => {
    const last = groups[groups.length - 1];
    if (!last || last.g !== s.g) groups.push({ g: s.g, items: [] });
    groups[groups.length - 1].items.push({ ...s, i });
  });
  return groups.map((gr, gi) => {
    const first = gr.items[0], lastItem = gr.items[gr.items.length - 1];
    const isCur = curIdx >= 0 && gi === groups.length - 1;
    if (!isRakah(gr.g)) {
      return `<li class="band${isCur ? " cur" : ""}"><span class="band-name">${groupName(gr.g)}</span><b class="num">${dur(first, curIdx)}</b></li>`;
    }
    const total = `<div class="cell sum"><span>الكل</span><b class="num">${fmt(lastItem.end - first.start)}</b></div>`;
    const cells = CELL.map((name, k) => {
      const s = gr.items[k];
      if (!s) return `<div class="cell empty"></div>`;
      const label = k === 0 && s.label.startsWith("التشهد") ? "تشهد وقراءة" : name; // old saved prayers
      return `<div class="cell${s.i === curIdx ? " now" : ""}"><span>${label}</span><b class="num">${dur(s, curIdx)}</b></div>`;
    }).join("");
    return `<li class="rk${isCur ? " cur" : ""}"><div class="rk-name">${groupName(gr.g)}</div><div class="rk-row">${cells}${total}</div></li>`;
  }).join("");
}

function liveSegs(t) {
  return app.steps.slice(0, app.ptr + 1).map((s, i) => ({ g: s.g, label: s.label, start: app.starts[i], end: app.starts[i + 1] ?? t }));
}

function renderLive(stepChanged) {
  if (app.mode !== "pray") return;
  const t = now();
  const p = PRAYERS[app.key];
  const cur = app.steps[app.ptr];
  $("total").textContent = fmt(t - app.t0);
  $("rakahNow").textContent = isRakah(cur.g) ? `الركعة ${ORD[cur.g]} من ${ar(p.n)} — ${cur.label}`
    : cur.mid ? "التشهد الأوسط — ارفع إيدك وكبّر لما تخلص" : "التشهد الأخير — سلّم لما تخلص";
  const log = $("log");
  log.innerHTML = logHTML(liveSegs(t), app.ptr);
  if (stepChanged || app.drawnPtr !== app.ptr) {
    app.drawnPtr = app.ptr;
    log.querySelector(".cur")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  renderChip(t);
  renderMeter();
}

function renderChip(t) {
  const chip = $("chip");
  let cls = "seen", text = "شايفك";
  if (det.pose === "near") { cls = "near"; text = "قريب"; }
  else if (!det.seen && t - det.lastSeen > 1000) { cls = "lost"; text = "مش شايفك"; }
  chip.className = `chip ${cls}`;
  chip.textContent = text;
}

function renderMeter() {
  // how far toward "closer" this upright position is; full while bowed
  const p = det.pose === "near" ? 1 : Math.max(0, Math.min(1, det.score));
  $("nearBar").style.width = `${Math.round(p * 100)}%`;
}

function showReport(rec) {
  $("rName").textContent = `صلاة ${rec.name}`;
  $("rWhen").textContent = new Date(rec.t0).toLocaleString("ar-EG", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });
  $("rTotal").textContent = fmt(rec.end - rec.t0);
  const rakahs = new Set(rec.segs.filter((s) => isRakah(s.g)).map((s) => s.g)).size;
  const how = rec.how === "salam" ? "انتهت بالسلام تلقائيًا" : "انتهت بزرار الإنهاء";
  $("rHow").textContent = `${ar(rakahs)} من ${ar(rec.n)} ركعات — ${how}`;
  $("rLog").innerHTML = logHTML(rec.segs, -1);
  app.shown = rec;
  $("rCopy").hidden = !rec.trace;
  $("rCopy").textContent = "انسخ التسجيل";
  $("rTrace").hidden = true;
  show("report");
  $("rLog").scrollTop = 0;
}

// Averages over the last 30 days, one row per prayer: whole prayer and the average length
// of one reading, one ruku, one sujood, and each tashahhud.
const PARTS = [
  ["القراءة", "القراءة"], ["الركوع", "الركوع"], ["السجدة", "السجدة"],
  ["التشهد الأوسط", "تشهد أوسط"], ["التشهد الأخير", "تشهد أخير"],
];
function averagesHTML(hist) {
  const since = Date.now() - 30 * 24 * 3600 * 1000;
  const rows = Object.entries(PRAYERS).map(([key, p]) => {
    const recs = hist.filter((r) => r.key === key && r.t0 >= since);
    if (!recs.length) return "";
    const avg = (list) => (list.length ? fmt(list.reduce((a, b) => a + b, 0) / list.length) : "—");
    const cells = PARTS.map(([prefix, name]) => {
      const list = recs.flatMap((r) => r.segs.filter((x) => x.label.startsWith(prefix) && x.end - x.start >= 300).map((x) => x.end - x.start));
      return `<div class="cell"><span>${name}</span><b class="num">${avg(list)}</b></div>`;
    }).join("");
    const total = `<div class="cell sum"><span>الكل</span><b class="num">${avg(recs.map((r) => r.end - r.t0))}</b></div>`;
    return `<li class="rk"><div class="rk-name">${p.name} <small>(${ar(recs.length)} ${recs.length > 2 && recs.length < 11 ? "مرات" : "مرة"})</small></div><div class="rk-row avg">${cells}${total}</div></li>`;
  }).join("");
  return rows ? `<h3 class="avg-title">المتوسط في آخر ٣٠ يوم</h3><ol class="log avg-list">${rows}</ol>` : "";
}

function showHistory() {
  const hist = load(HIST_KEY, []);
  $("histAvg").innerHTML = averagesHTML(hist);
  const list = $("histList");
  list.innerHTML = hist.map((r) => `
    <li data-id="${r.id}">
      <button class="open"><span>صلاة ${r.name}<small>${new Date(r.t0).toLocaleString("ar-EG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</small></span><span class="num">${fmt(r.end - r.t0)}</span></button>
      <button class="del">مسح</button>
    </li>`).join("");
  $("histEmpty").hidden = hist.length > 0;
  show("history");
}

$("histList").addEventListener("click", (e) => {
  const li = e.target.closest("li");
  if (!li) return;
  const id = Number(li.dataset.id);
  const hist = load(HIST_KEY, []);
  if (e.target.closest(".open")) {
    const rec = hist.find((r) => r.id === id);
    if (rec) showReport(rec);
  } else if (e.target.closest(".del")) {
    const btn = e.target.closest(".del");
    if (!btn.classList.contains("sure")) { btn.classList.add("sure"); btn.textContent = "متأكد؟"; return; }
    save(HIST_KEY, hist.filter((r) => r.id !== id));
    showHistory();
  }
});

// ---------- wiring ----------
function showPlace() {
  for (const b of document.querySelectorAll("#placeButtons .place")) b.setAttribute("aria-pressed", String(b.dataset.place === settings.place));
  for (const b of document.querySelectorAll("#postureButtons .place")) b.setAttribute("aria-pressed", String(b.dataset.posture === settings.posture));
  $("placeRow").hidden = settings.posture !== "sit"; // standing always uses the floor
  $("postureHint").textContent = POSTURES[settings.posture].hint || "";
  $("sens").value = String(settings.sens);
  sensText();
}
$("postureButtons").addEventListener("click", (e) => {
  const b = e.target.closest(".place");
  if (!b) return;
  settings.posture = b.dataset.posture;
  save(POSTURE_KEY, settings.posture);
  loadSens();
  showPlace();
});
$("placeButtons").addEventListener("click", (e) => {
  const b = e.target.closest(".place");
  if (!b) return;
  settings.place = b.dataset.place;
  save(PLACE_KEY, settings.place);
  loadSens();
  showPlace();
});
$("startNow").addEventListener("click", () => startPrayer(now()));
function showAlert() {
  for (const b of document.querySelectorAll(".alert-opt")) b.setAttribute("aria-pressed", String(b.dataset.alert === settings.alert));
}
$("alertButtons").addEventListener("click", (e) => {
  const b = e.target.closest(".alert-opt");
  if (!b) return;
  settings.alert = b.dataset.alert;
  save(ALERT_KEY, settings.alert);
  showAlert();
});
$("testSound").addEventListener("click", () => {
  initAudio();
  if (settings.alert === "off") return;
  setTimeout(() => cue(1), 150);
});
showAlert();
for (const id of ["chip", "thumb", "camWrap"]) $(id).addEventListener("click", () => setDiagVisible(!document.body.classList.contains("show-diag")));
setDiagVisible(Boolean(load(DIAG_KEY, false)));

function sensText() {
  const pct = Math.round((settings.sens - 1) * 100);
  $("sensText").textContent = `بيحسبها قرب لما وشك يكبر ${ar(pct)}٪ عن الحركة اللي قبلها.`;
}
$("appVer").textContent = `الإصدار ${ar(APP_VERSION)}`;
showPlace();
$("sens").addEventListener("input", (e) => {
  settings.sens = Number(e.target.value);
  save(`${SENS_KEY}.${sensSlot()}`, settings.sens);
  sensText();
});

$("prayerButtons").addEventListener("click", (e) => {
  const b = e.target.closest(".prayer");
  if (b) choosePrayer(b.dataset.key);
});
$("calibCancel").addEventListener("click", () => { stopCamera(); app.mode = "home"; show("home"); });
$("btnNext").addEventListener("click", () => {
  if (app.mode !== "pray") return;
  if (app.ptr >= app.steps.length - 1) finish(now(), "button");
  else advance(now());
});
$("btnBack").addEventListener("click", () => { if (app.mode === "pray") stepBack(); });
$("rCopy").addEventListener("click", () => {
  if (!app.shown?.trace) return;
  const text = traceText(app.shown);
  const showBox = () => { const box = $("rTrace"); box.value = text; box.hidden = false; box.focus(); box.select(); };
  try {
    navigator.clipboard.writeText(text)
      .then(() => { $("rCopy").textContent = "اتنسخ — الصقه في الشات"; })
      .catch(showBox);
  } catch { showBox(); }
});
$("btnStop").addEventListener("click", () => finish(now(), "button"));
$("openHistory").addEventListener("click", showHistory);
$("checkPlace").addEventListener("click", startPlacementCheck);
$("rHistory").addEventListener("click", showHistory);
$("rHome").addEventListener("click", () => { app.mode = "home"; show("home"); });
$("hHome").addEventListener("click", () => { app.mode = "home"; show("home"); });

setInterval(() => renderLive(false), 250);

// Test hook (only with ?sim): feed face values by hand to check the counting logic.
if (SIM) {
  window.__pc = {
    feed(w, yaw = 0, t, handsUp = false, pos = null) { simNow = t ?? simNow + 100; onObservation(w, yaw, simNow, handsUp, pos); },
    state: () => ({ mode: app.mode, ptr: app.ptr, step: app.steps[app.ptr]?.label, group: app.steps[app.ptr]?.g, pose: det.pose, valley: det.valley, peak: det.peak }),
    history: () => load(HIST_KEY, []),
    handsRaised: (res, box, video) => handsRaised(res, box, video),
    check: (w, bothUp, handCount, t) => { checkStep(w, bothUp, handCount, t); return $("calibMsg").textContent; },
    draw: (box, handRes, video, bothUp) => drawOverlay(box, handRes, video, bothUp),
  };
}
