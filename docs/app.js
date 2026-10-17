// Prayer counter for praying seated on a chair, standing, or standing for the first rak'ah only.
// The front camera finds the face. Coming toward the phone makes the face bigger ("near");
// moving back makes it smaller ("far"). Each move is compared with the one just before it
// (not with a fixed size), so it works standing, sitting, and when switching between them.
// The bows and the hand raises seen so far are matched against the shape of the prayer
// (reading -> ruku -> rising -> sujood -> sitting -> sujood -> next rak'ah ... -> last tashahhud)
// to decide which step each bow was; see align.js. The middle tashahhud ends when both hands
// come up beside the face for "Allahu Akbar".
// After the last tashahhud, turning the head right then left (the salam) ends the prayer.
// The shoulders (body tool) help when the face alone hardly shows a bow, or is hidden in it.
// "First rak'ah standing": the phone is set for sitting, so standing up takes the face out through
// the top of the picture. The clock starts then; sitting down on the chair is seen when the face
// comes back and settles at its sitting place.

// Version of this app (shown on the start screen; see CHANGELOG.md).
const APP_VERSION = 9;

import { buildSteps, alignPrayer, timeline } from "./align.js?v=22";

const MP_VERSION = "0.10.14";
const MP_BUNDLE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/vision_bundle.mjs`;
const MP_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
const MP_MODEL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";
const MP_HAND_MODEL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const MP_POSE_MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

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

// How the prayer is done. Standing needs the phone on the floor in front of the place of sujood,
// leaning back so it looks up at the face. Standing first: the phone is set for sitting, and the
// standing part happens above the picture.
const POSTURES = {
  sit: { name: "قاعد على الكرسي", calib: "اقعد مستقيم وبص للموبايل" },
  stand: { name: "واقف", calib: "اقف مستقيم وبص للموبايل",
    hint: "حط الموبايل على الأرض قدام مكان السجود، مسنود لورا علشان يشوفك وانت واقف." },
  mixed: { name: "أول ركعة واقف", calib: "اقعد مستقيم على الكرسي وبص للموبايل",
    hint: "حط الموبايل قدامك على ترابيزة، مظبوط عليك وانت قاعد. العدّ بيبدأ لما تقوم تقف." },
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
// Head turns are measured from the person's own "facing the phone" turn (the phone may stand a
// little to one side, or the face tool may lean one way): see noteYaw.
const SALAM_YAW = 0.3;       // how far the head must turn for the salam
const SALAM_YAW2 = 0.22;     // ...the turn to the other side, once one side was seen, needs a bit less
const SALAM_KEEP = 0.65;     // a turn going on stays a turn down to this share of what it needed
const SALAM_GAP_MS = 8000;   // the two turns of the salam come within this time of each other
const SALAM_LOST_YAW = 0.15; // face lost right after turning at least this far = a turn to that side
const SALAM_HOLD_MS = 200;
const SALAM_ARM_MS = 1000;   // salam is only watched 1 s into the last tashahhud
const HANDS_ARM_MS = 3000;   // raised hands are only watched 3 s into the middle tashahhud
const HANDS_HOLD_MS = 250;   // hands must stay up this long
const RUKU_SOON_MS = 6000;   // after the takbeer before ruku, a smaller bow counts for this long
const RUKU_SOON_SCORE = 0.6; // ...this much of a full lean is enough then
const MIN_BOW_MS = 1000;     // a bow shorter than this is a twitch, not a ruku or sujood
const MIN_RISE_MS = 800;     // a rise shorter than this between two bows is a twitch too (a real one measures 1 s+)
const FRAME_MS = 66;         // look at the camera about 15 times a second
// "first rak'ah standing" (phone set for sitting)
const AWAY_MS = 500;         // face gone through the top this long = stood up
const AWAY_ANY_MS = 3000;    // before the start: face gone this long anywhere = stood up too
const VISIT_MIN_MS = 500;    // a standing ruku: the face shows from the top and goes back up and out,
const VISIT_MAX_MS = 10000;  // ...after this long at least and at most
const SIT_MS = 1500;         // face resting at its sitting place this long = sat down on the chair
// shoulders (body tool): a full lean = down by half their width, or this much wider (closer) at the
// normal sensitivity
const SH_DOWN = 0.5;
const SH_GROW = 0.3;
const SH_FAR = 0.4;          // shoulders back to this little lean = upright again
const SH_NEAR_LOST = 0.6;    // face gone and shoulders this far into a lean = bowed

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
// standing (phone on the floor), and standing first (phone on a table, at arm's length).
const sensSlot = () => (settings.posture === "sit" ? settings.place : settings.posture);
function loadSens() {
  const def = settings.posture === "sit" ? PLACES[settings.place].sens : 1.35;
  settings.sens = Number(load(`${SENS_KEY}.${sensSlot()}`, def)) || def;
}
loadSens();

const app = {
  mode: "home",      // home | calib | check | takbeer | pray | done
  key: null,
  n: 0,              // rak'ahs of this prayer
  match: null,       // the latest match of the bows to the prayer (align.js)
  alignedAt: 0,
  cued: new Set(),   // steps whose sound was already played
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
const det = {
  ema: 0, pose: "far", cand: null, candSince: 0, valley: 0, peak: 0,
  pos: null, home: null, low: null, score: 0,
  lastSeen: 0, lastSize: 0, lastYaw: 0, yawHist: [], seen: false,
  calib: [], calibStart: 0,
  prevValley: 0, prevHome: null, // upright size and place before the current bow (to undo a twitch)
  still: null,                    // where the face has been resting during this bow, and since when
  upY: null, prevUpY: null,       // highest face place while upright (this pause / the one before the bow)
  seat: null,                     // where and how big the face is sitting upright (learned at the start)
  raw: null,                      // the face place last seen, not smoothed
  nearBy: "face",                 // what showed the bow coming: the face or the shoulders
  farAt: 0,                       // when the last bow ended
  farBy: "face",                  // what showed it ending
  refresh: false,                 // learn the upright face afresh when it shows again
};
// What the camera saw during the prayer: the bows and the hand raises. The steps on the screen are
// worked out from these by matching them against the shape of the prayer (align.js).
const obs = { bows: [], raises: [], sits: [] };
// "First rak'ah standing" with the phone set for sitting. on = standing, out of the picture;
// visit = the face came back at visit.t and is not yet known to be sitting; used = this prayer
// went through standing out of the picture.
const stand = { on: false, used: false, visit: null };
// Shoulders from the body tool: sy = their middle height, sw = the width between them (both as
// shares of the picture height), home = the same while upright, score = how far into a lean.
const sh = { seen: false, sy: 0, sw: 0, home: null, score: 0, lastSeen: 0 };
// base = the head turn while facing the phone: the middle value of the last 10 s while upright
const sal = { side: 0, since: 0, first: 0, firstAt: 0, base: 0, yaws: [], yawAt: 0 };
// up = a raise is going on (both hands up); a new raise needs the hands to come down first.
// rukuSoon = the takbeer before ruku was seen in this reading step.
const hands = { since: 0, up: false, downSince: 0, rukuSoon: null };

function resetTracking() {
  Object.assign(det, {
    ema: 0, pose: "far", cand: null, candSince: 0, valley: 0, peak: 0, pos: null, home: null, low: null, score: 0,
    lastSeen: 0, lastSize: 0, lastYaw: 0, yawHist: [], seen: false, calib: [], calibStart: 0,
    prevValley: 0, prevHome: null, still: null, upY: null, prevUpY: null, seat: null, raw: null,
    nearBy: "face", farAt: 0, farBy: "face", refresh: false,
  });
  obs.bows = []; obs.raises = []; obs.sits = [];
  Object.assign(stand, { on: false, used: false, visit: null });
  Object.assign(sh, { seen: false, sy: 0, sw: 0, home: null, score: 0, lastSeen: 0 });
  Object.assign(sal, { side: 0, since: 0, first: 0, firstAt: 0, base: 0, yaws: [], yawAt: 0 });
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

// How far into a bow the shoulders are: in ruku and sujood they come down and closer (wider).
// The sensitivity setting works on them the same way as on the face.
function shoulderScore() {
  const h = sh.home;
  const grow = SH_GROW * (settings.sens - 1) / 0.35;
  return Math.max(0, (sh.sy - h.sy) / (SH_DOWN * h.sw)) + Math.max(0, (sh.sw / h.sw - 1) / grow);
}
function trackShoulders(s, t) {
  sh.seen = s != null;
  if (!s) { sh.score = 0; return; }
  const fresh = t - sh.lastSeen > 500;
  sh.sy = fresh ? s.sy : sh.sy * 0.5 + s.sy * 0.5;
  sh.sw = fresh ? s.sw : sh.sw * 0.5 + s.sw * 0.5;
  sh.lastSeen = t;
  sh.score = sh.home ? shoulderScore() : 0;
}
// While upright, the shoulders' upright place follows them slowly (like the face's).
function followShoulders() {
  if (!sh.seen) return;
  if (!sh.home) { if (det.score < 0.3 && !stand.visit) sh.home = { sy: sh.sy, sw: sh.sw }; return; }
  if (sh.score < 0.3 && det.score < 0.3) sh.home = { sy: sh.home.sy * 0.95 + sh.sy * 0.05, sw: sh.home.sw * 0.95 + sh.sw * 0.05 };
}

// w = face width as a share of the picture width (null = no face), yaw = head turn (-1..1 roughly),
// handsUp = a hand is raised beside the face, pos = face centre and height as shares of the picture,
// shoulders = { sy, sw } from the body tool (null = not seen)
function onObservation(w, yaw, t, handsUp = false, pos = null, shoulders = null) {
  det.seen = w != null;
  if (w != null) {
    const p = pos || { cx: 0.5, cy: 0.45, h: w };
    // back in the picture after standing (or after a bow the shoulders ended): no smoothing with before
    const fresh = app.mode === "pray" && (stand.on || det.refresh);
    det.lastSeen = t;
    det.raw = { ...p };
    det.ema = det.ema && !fresh ? det.ema * 0.5 + w * 0.5 : w;
    det.lastYaw = yaw;
    det.yawHist.push([t, yaw]);
    while (det.yawHist.length && t - det.yawHist[0][0] > 700) det.yawHist.shift();
    noteYaw(yaw, t);
    det.pos = det.pos && !fresh ? { cx: det.pos.cx * 0.5 + p.cx * 0.5, cy: det.pos.cy * 0.5 + p.cy * 0.5, h: det.pos.h * 0.5 + p.h * 0.5 } : { ...p };
  }
  trackShoulders(shoulders, t);
  if (app.mode === "calib") return calibStep(w, t);
  if (app.mode === "takbeer") return takbeerStep(handsUp && uprightNow(), t, w);
  if (app.mode !== "pray") return;

  if (stand.on && w != null) startVisit(t); // the face is back after standing
  if (!stand.on) bowStep(w, t);

  const raiseAt = handsEdge(handsUp && uprightNow(), t);
  if (raiseAt) onRaise(raiseAt, t);
  if (t - app.alignedAt >= 1000) realign(t); // pauses keep growing: the best match can change with time
  salamCheck(w != null, yaw, t);
  rec.sample(t);
}

// Upright ("far") or bowed ("near"), from the face and the shoulders. Each move is measured from
// the end of the move before it.
function bowStep(w, t) {
  const down = 1 + (settings.sens - 1) * 0.7; // away: face this many times smaller than the peak
  const bow = obs.bows[obs.bows.length - 1];
  // just back in the picture after standing: a bow counts only once the face has settled on the chair,
  // or, if it went straight on from the sitting place into a deep bow (sat down and went to sujood)
  const visit = stand.visit;
  const canBow = !visit || visit.seatAt > 0;
  // right after the takbeer before ruku a ruku is expected, so a smaller bow is enough
  const soon = hands.rukuSoon && hands.rukuSoon.ptr === app.ptr && t - hands.rukuSoon.at <= RUKU_SOON_MS;
  const need = soon ? RUKU_SOON_SCORE : 1;
  const shOn = sh.seen && sh.home != null; // the shoulders can be compared with upright
  // the shoulders went into this bow too, so they can tell when it is over
  if (det.pose === "near" && bow && bow.e == null && shOn) bow.shPeak = Math.max(bow.shPeak || 0, sh.score);
  const shShowed = (bow?.shPeak || 0) >= 1;
  let want = det.pose;
  if (w != null) {
    const size = det.ema;
    det.lastSize = size;
    if (det.refresh) { // the face shows again after the shoulders ended a bow without it
      if (det.pose === "far") { det.valley = size; det.home = { ...det.pos }; det.upY = det.pos.cy; }
      det.refresh = false;
    }
    if (det.pose === "far") {
      det.score = leanScore(size);
      // keep the smallest upright size; follow very slowly if the person settles closer
      det.valley = size < det.valley ? size : det.valley + (size - det.valley) * 0.002;
      det.upY = det.upY == null ? det.pos.cy : Math.min(det.upY, det.pos.cy);
      if (det.score < 0.3 && det.home) det.home = { cx: det.home.cx * 0.95 + det.pos.cx * 0.05, cy: det.home.cy * 0.95 + det.pos.cy * 0.05, h: det.home.h * 0.95 + det.pos.h * 0.05 };
      followShoulders();
      if (visit) visitRest(visit, size, t);
      if (!visit || visit.seatAt > 0) {
        if (det.score >= need) { want = "near"; det.nearBy = "face"; }
        else if (shOn && sh.score >= need) { want = "near"; det.nearBy = "shoulders"; }
      } else if (visit.wasAtSeat && det.score >= 2) { want = "near"; det.nearBy = "face"; }
    } else {
      det.peak = Math.max(det.peak, size);
      if (!det.low || det.pos.cy > det.low.cy) det.low = { ...det.pos };
      const back = (det.low.cy - det.pos.cy) / det.low.h; // moved back up, in face heights
      if (size <= det.peak / down || (back >= RISE_FACES && size <= det.peak * 1.02)) { want = "far"; det.farBy = "face"; }
      // the shoulders are back up and the face shows no lean either (a bow the face hardly showed)
      else if (leanScore(size) < 0.6 && ((shOn && shShowed && sh.score <= SH_FAR) || (bow?.byShoulders && !sh.seen))) { want = "far"; det.farBy = "shoulders"; }
      if (bow?.lostSince) { bow.lostLowMs += t - bow.lostSince; bow.lostSince = 0; }
      if (want === "near" && satDown(size, t)) want = "far";
    }
  } else if (det.pose === "far") {
    // "first rak'ah standing": the face left through the top of the picture = stood up. Lost on the
    // way up, too fast for the face tool (back in the picture but not yet sitting, last seen well
    // above the sitting place): stood up as well, after a little longer.
    if (mayStandUp()) {
      const gone = t - det.lastSeen, s = det.seat, p = det.raw;
      if (gone >= AWAY_MS && leftAbove()) return goAway(t);
      if (gone >= AWAY_ANY_MS && visit && s && p && p.cy < s.cy - 0.5 * s.h) return goAway(t);
    }
    if (t - det.lastSeen > LOST_AS_NEAR_MS && (canBow || visit.wasAtSeat)) {
      // face left the picture while coming close or going down (head bent in sujood). When the
      // shoulders ended the last bow while the face was still hidden, its last place is from inside
      // that bow: only once the face has been seen again.
      const atBottom = det.pos && det.pos.cy + det.pos.h / 2 > 0.92;
      const faceSinceUp = det.farBy !== "shoulders" || det.lastSeen >= det.farAt;
      if (faceSinceUp && (canBow ? det.score >= 0.5 || atBottom : det.score >= 2 || atBottom)) { want = "near"; det.nearBy = "face"; }
      else if (canBow && shOn && sh.score >= SH_NEAR_LOST) { want = "near"; det.nearBy = "shoulders"; }
    }
  } else if (det.pose === "near") {
    // Face gone while bowed. If it was back at its upright height (or at the top edge) it left
    // through the top of the picture: the person stood up. Otherwise it went down (sujood).
    // Shoulders that showed the bow and are back up say it is over even when the face is still hidden.
    const p = det.pos, home = det.home;
    const backUp = p && ((home && p.cy <= home.cy + 0.5 * home.h) || p.cy - p.h / 2 < 0.05);
    if (shOn && shShowed && sh.score <= SH_FAR) { want = "far"; det.farBy = "shoulders"; }
    else if (backUp) {
      if (t - det.lastSeen > LOST_AS_NEAR_MS) { want = "far"; det.farBy = "face"; }
    } else {
      det.peak = Math.max(det.peak, det.lastSize * 1.25); // lost while bowed: it got even closer
      if (bow && bow.e == null && !bow.lostSince) bow.lostSince = det.lastSeen;
    }
  }

  if (want !== det.pose) {
    if (det.cand !== want) { det.cand = want; det.candSince = t; }
    else if (t - det.candSince >= (want === "near" ? NEAR_HOLD_MS : FAR_HOLD_MS)) {
      const moveStart = det.candSince;
      det.pose = want; det.cand = null;
      if (want === "near") {
        const raisedSince = bow && obs.raises.some((r) => r.t >= bow.e - 200); // a raise proves the rise was real
        if (bow && bow.e != null && !bow.virtual && !bow.ignored && !raisedSince && moveStart - bow.e < MIN_RISE_MS) {
          // the rise before was too short to be real (a flicker): the bow before goes on
          bow.e = null;
          det.peak = Math.max(det.peak, det.lastSize);
          if (det.prevHome) det.home = det.prevHome;
          rec.event(t, "undo: short rise");
        } else {
          det.prevValley = det.valley; det.prevHome = det.home ? { ...det.home } : null;
          det.peak = det.lastSize; det.low = det.pos ? { ...det.pos } : null;
          det.still = null; det.prevUpY = det.upY;
          const byShoulders = det.nearBy === "shoulders";
          obs.bows.push({ s: moveStart, e: null, lostLowMs: 0, lostSince: 0, byShoulders, shPeak: shOn ? sh.score : 0 });
          rec.event(t, byShoulders ? "near (shoulders)" : "near");
          if (stand.visit) sitConfirmed(t, false); // settled on the chair, then bowed
        }
      } else {
        const open = obs.bows[obs.bows.length - 1]; // (sitting down removes its bow)
        if (open?.lostSince) { open.lostLowMs += t - open.lostSince; open.lostSince = 0; }
        if (open && open.e == null && !open.virtual && moveStart - open.s < MIN_BOW_MS && open.lostLowMs < 1500) {
          // too short to be a ruku or sujood: a twitch, forget it
          obs.bows.pop();
          det.valley = det.prevValley || det.lastSize;
          if (det.prevHome) det.home = det.prevHome;
          det.score = 0;
          rec.event(t, "undo: short bow");
        } else {
          det.valley = det.lastSize; if (det.pos) det.home = { ...det.pos };
          det.score = 0; // upright again: start measuring the next bow from zero
          det.upY = det.pos ? det.pos.cy : null;
          det.farAt = t;
          // the shoulders ended it while the face is still hidden: its last size and place are from
          // inside the bow, so learn the upright face afresh when it shows again
          det.refresh = !det.seen && det.farBy === "shoulders";
          if (sh.seen) sh.home = { sy: sh.sy, sw: sh.sw };
          if (open && open.e == null) open.e = moveStart;
          rec.event(t, det.farBy === "shoulders" ? "far (shoulders)" : "far");
        }
      }
      realign(t);
    }
  } else det.cand = null;
}

// ---------- "first rak'ah standing" with the phone set for sitting ----------
// Standing, the face is above the picture. It shows again either for a moment during a standing
// ruku (then it goes back up and out through the top), or to stay: sitting down on the chair.

// The face left through the top of the picture (judged from where it was last seen): at the top
// edge and above where it sits, or well above where it sits. (A face that sits right at the top
// edge can flicker there; standing up is then seen when it stays gone - see takbeerStep.)
function leftAbove() {
  const p = det.raw, s = det.seat;
  if (!p) return false;
  if (!s) return p.cy - p.h / 2 < 0.06;
  return (p.cy - p.h / 2 < 0.06 && p.cy < s.cy - 0.25 * s.h) || p.cy < s.cy - 0.75 * s.h;
}

// Standing up fits now: "first rak'ah standing" that started by standing up out of the picture (the
// phone is set for sitting), and not sat down yet (or no bow since sitting down). A prayer started
// with the face in sight (hands raised) has the phone seeing the person standing: v7's way.
function mayStandUp() {
  if (settings.posture !== "mixed" || !stand.used) return false;
  const sit = obs.sits[obs.sits.length - 1];
  return !sit || !obs.bows.some((b) => !b.ignored && !b.virtual && b.s >= sit.t);
}

function goAway(t) {
  // Since the face came back: the visit going on, or the sitting down it ended in (with no bow since:
  // that was not the real sitting down, so it is undone).
  const v = stand.visit, sit = !v && obs.sits.length ? obs.sits.pop() : null;
  if (sit) rec.event(t, "undo: sat down");
  const from = v ? v.t : sit?.t, inside = v ? v.inside : sit?.inside;
  // The face came all the way into the picture and went back up and out within a standing ruku's
  // time, with no bow counted in between: a standing ruku seen from below, even if it held still
  // like sitting for a moment (a face only showing at the top edge while standing is not one).
  const len = from == null ? 0 : det.lastSeen - from;
  if (inside && len >= VISIT_MIN_MS && len <= VISIT_MAX_MS) {
    obs.bows.push({ s: from, e: det.lastSeen, lostLowMs: 0, lostSince: 0 });
    rec.event(t, "ruku (standing)");
  }
  Object.assign(stand, { on: true, used: true, visit: null });
  det.pose = "far"; det.cand = null; det.score = 0;
  rec.event(t, "stood up");
  realign(t);
}

// The face is back after standing. Until it is known that the person sat down, the sitting place
// learned at the start is the upright place (sitting down itself leans in a bit, so no bow yet).
function startVisit(t) {
  const s = det.seat || { cx: det.pos.cx, cy: det.pos.cy, h: det.pos.h, size: det.ema };
  stand.on = false;
  stand.visit = { t, seatAt: 0, wasAtSeat: false, inside: false, still: null };
  det.pose = "far"; det.cand = null; det.score = 0;
  det.valley = s.size; det.home = { cx: s.cx, cy: s.cy, h: s.h };
  det.upY = null; det.prevHome = null; det.prevValley = 0; det.still = null; det.refresh = false;
  sh.home = null;
  rec.event(t, "face back");
}

// While the face is back but not yet known to be sitting. Once it rests (0.3 s) somewhere that can
// be the chair - not at the top edge, not well above where it sat at the start, about the size it had
// then (people do not sit down in exactly the same place) - that place is upright and a bow can
// count from there. Resting there 1.5 s = sat down. In the picture longer than a standing ruku can
// last = sitting too.
function visitRest(v, size, t) {
  const p = det.pos, s = det.seat;
  const ratio = s ? size / s.size : 1;
  const topEdge = p.cy - p.h / 2 <= 0.06 && (!s || p.cy < s.cy - 0.5 * s.h); // standing, peeking in at the top
  // at the very place it sat at the start (for a sujood straight after sitting down)
  if (!s || (Math.abs(p.cy - s.cy) <= s.h && Math.abs(ratio - 1) <= 0.3)) v.wasAtSeat = true;
  if (det.raw.cy - det.raw.h / 2 >= 0.08) v.inside = true; // the whole face came into the picture
  const chairLike = !topEdge && ratio >= 0.6 && ratio <= 1.6 && (!s || p.cy >= s.cy - s.h);
  // resting there = size within 15% and place within half a face (at least 4% of the picture: faces
  // jitter); the rest only counts while the face looks like sitting on the chair
  const still = chairLike && v.still && Math.abs(size - v.still.size) <= 0.15 * v.still.size && Math.abs(p.cy - v.still.cy) <= Math.max(0.5 * p.h, 0.04);
  if (!still) v.still = { size, cy: p.cy, t };
  const rest = t - v.still.t;
  if (!v.seatAt && rest >= 300) {
    v.seatAt = v.still.t;
    det.valley = size; det.home = { ...p }; det.upY = p.cy; det.score = 0; // bows are measured from here
    if (sh.seen) sh.home = { sy: sh.sy, sw: sh.sw };
  }
  if ((v.seatAt && rest >= SIT_MS) || (t - v.t > VISIT_MAX_MS && !topEdge)) sitConfirmed(t, rest >= 300);
}

// Sat down at the moment the face came back. settled = resting upright now (measure from here).
function sitConfirmed(t, settled) {
  const v = stand.visit;
  stand.visit = null;
  obs.sits.push({ t: v.t, inside: v.inside });
  if (settled) {
    det.valley = det.lastSize; det.home = { ...det.pos }; det.score = 0; det.upY = det.pos.cy;
    if (sh.seen) sh.home = { sy: sh.sy, sw: sh.sw };
  }
  rec.event(t, "sat down");
  realign(t);
}

// Standing -> sitting on the chair, when the phone sees the person standing too (the face never
// leaves the picture; only once): the face drops far down in the picture without coming closer,
// and then rests there. That is not a ruku or a sujood (those bring the face closer, and it comes
// back up). After 2 s of rest the "bow" is turned into a "sat down" moment.
function satDown(size, t) {
  const bow = obs.bows[obs.bows.length - 1];
  if (settings.posture !== "mixed" || stand.used || obs.sits.length || !bow || bow.e != null || bow.virtual || !det.prevHome || !det.pos) return false;
  const ref = det.still;
  // resting = size within 15% and place within half a face (at least 4% of the picture: faces jitter)
  if (!ref || Math.abs(size - ref.size) > 0.15 * ref.size || Math.abs(det.pos.cy - ref.cy) > Math.max(0.5 * det.pos.h, 0.04)) {
    det.still = { size, cy: det.pos.cy, t };
    return false;
  }
  const top = det.prevUpY ?? det.prevHome.cy; // the highest the face was while upright before the bow
  const drop = (det.pos.cy - top) / det.pos.h; // in face heights
  if (t - ref.t < 2000 || drop < 1.5 || det.peak > (det.prevValley || det.valley) * 1.15) return false;
  obs.bows.pop();
  obs.sits.push({ t: bow.s });
  // upright again, right away, at the new (sitting) place
  det.pose = "far"; det.cand = null; det.still = null;
  det.valley = det.lastSize;
  det.home = { ...det.pos };
  det.score = 0;
  det.upY = det.pos.cy;
  rec.event(t, "sat down");
  realign(t);
  return true;
}

// The person is upright (seen from the face) - needed before a hand raise can count.
function uprightNow() {
  if (!det.seen || !det.valley) return false;
  if (det.pose === "far") return det.score < 1;
  return det.lastSize <= (det.prevValley || det.valley) * (1 + (settings.sens - 1) * 0.6);
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

// Both hands went up: the person is upright. The raise is kept as a clue for the matching
// (before / after ruku, standing up for rak'ah 3); a bow that still seems to go on is over.
function onRaise(at, t) {
  obs.raises.push({ t: at });
  rec.event(t, "raise");
  if (det.pose === "near") {
    const bow = obs.bows[obs.bows.length - 1];
    if (bow && bow.e == null) bow.e = Math.max(at, bow.s);
    det.pose = "far"; det.cand = null;
    det.valley = det.lastSize;
    if (det.pos) det.home = { ...det.pos };
    det.score = 0;
    rec.event(t, "far (hands)");
  }
  realign(t);
}

// ---------- which step is it? ----------
// Match everything seen so far against the shape of the prayer (align.js) and show the result.
// When a clue shows an earlier step was counted wrong, the whole list is corrected, not just the
// current step.
function realign(t, final = false) {
  if (app.mode !== "pray" && !final) return;
  app.alignedAt = t;
  // rak'ahs prayed standing in sight of the phone ("first rak'ah standing" that began out of the
  // picture: none, its standing ruku is often unseen)
  const standing = settings.posture === "stand" ? app.n : settings.posture === "mixed" && !stand.used ? 1 : 0;
  const res = alignPrayer({
    n: app.n, bows: obs.bows, raises: obs.raises, sits: obs.sits, mixed: settings.posture === "mixed", standing,
    handsOn: SIM || diag.hands === "ready", t0: app.t0, now: t,
  });
  const tl = timeline({ steps: app.steps, pairs: res.pairs, bows: res.bows, raises: obs.raises, t0: app.t0, now: t, armMs: HANDS_ARM_MS });
  const moved = tl.ptr !== app.ptr;
  app.ptr = tl.ptr;
  app.starts = tl.starts;
  app.match = res;
  const cur = app.steps[app.ptr];
  if (moved) {
    rec.event(t, `step ${app.ptr}`);
    if (cur.last) Object.assign(sal, { side: 0, since: t, first: 0, firstAt: 0 });
  }
  if (final) return; // the last look when the prayer ends: no sound, nothing to draw
  if (cur.tone && !app.cued.has(app.ptr)) { app.cued.add(app.ptr); cue(cur.tone); }
  // after the takbeer before ruku a ruku is expected: a smaller bow is enough for a few seconds
  const lastRaise = obs.raises[obs.raises.length - 1];
  hands.rukuSoon = cur.label.startsWith("القراءة") && lastRaise && lastRaise.t >= app.starts[app.ptr]
    ? { at: lastRaise.t, ptr: app.ptr } : null;
  renderLive(moved);
}

// What each bow was counted as, for the record.
function matchText() {
  const res = app.match;
  if (!res) return "";
  const names = ["ruku", "sujood1", "sujood2"];
  const label = new Map(res.pairs.map((p) => [res.bows[p.a], `r${Math.floor(p.j / 3) + 1}-${names[p.j % 3]}`]));
  return obs.bows.map((b) => `${rec.rel(b.s)}-${b.e == null ? "" : rec.rel(b.e)}:${b.ignored ? "removed" : label.get(b) || "extra"}${b.virtual ? "(added)" : ""}`).join(" ")
    + (obs.sits.length ? ` | sat down ${obs.sits.map((x) => rec.rel(x.t)).join(",")}` : "")
    + ` | missed ${res.misses}, extra ${res.extras}, cost ${res.cost.toFixed(1)}`;
}

// ---------- record of each prayer, to check a missed step afterwards ----------
// 4 samples a second: time (tenths of a second): size vs upright (%), lean score (%),
// face height in the picture (%), head turn (%), bowed (1/0), shoulders' lean score (%), hands seen.
// Size and height are -1 when no face, the shoulders' score when they are not seen, hands when
// the hand tool is not running.
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
    const shs = sh.seen && sh.home ? Math.round(sh.score * 100) : -1;
    const hc = handDetector && wantHands() ? lastHandCount : -1;
    this.samples.push(`${this.rel(t)}:${size},${Math.round(det.score * 100)},${cy},${Math.round(det.lastYaw * 100)},${det.pose === "near" ? 1 : 0},${shs},${hc}`);
  },
  event(t, what) { if (this.t0) this.events.push(`${this.rel(t)}:${what}`); },
};

// Is the hand detector needed on this frame? Everywhere except the last tashahhud (and while
// standing out of the picture).
function wantHands() {
  if (app.mode === "takbeer" || app.mode === "calib" || app.mode === "check") return true;
  return app.mode === "pray" && !stand.on && !app.steps[app.ptr]?.last;
}
// The body tool: during the prayer (not while standing out of the picture), and in the placement
// check to show the shoulders.
function wantPose() {
  if (app.mode === "check") return true;
  return app.mode === "pray" && !stand.on;
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
  // "first rak'ah standing" needs room above the sitting face, to see it leave when standing up
  const room = settings.posture === "mixed" ? 0.08 : 0.05;
  if (det.pos && det.pos.cy - det.pos.h / 2 < room) msg.textContent = "وشك على حافة الصورة من فوق. ارفع الموبايل أو ميّله لورا شوية.";
  if (p >= 1 && det.calib.length >= 10) {
    const sorted = [...det.calib].sort((a, b) => a - b);
    det.valley = sorted[Math.floor(sorted.length / 2)];
    det.ema = det.valley;
    det.lastSize = det.valley;
    det.home = det.pos ? { ...det.pos } : { cx: 0.5, cy: 0.45, h: det.valley };
    det.seat = { ...det.home, size: det.valley }; // "first rak'ah standing": where sitting down will bring the face back
    waitForTakbeer();
  }
}

// After the face is learned: wait for the hands to go up for the opening "Allahu Akbar".
// The prayer clock starts at the moment the hands went up. "First rak'ah standing": it starts when
// the person stands up (the face leaves through the top of the picture).
function waitForTakbeer() {
  app.mode = "takbeer";
  hands.since = 0;
  $("calibBar").style.width = "100%";
  $("startNow").hidden = false;
  takbeerMsg();
}
function takbeerMsg() {
  const msg = $("calibMsg");
  if (settings.posture === "mixed") msg.textContent = "قوم اقف وكبّر. العدّ هيبدأ أول ما تقوم.";
  else if (diag.hands === "loading") msg.textContent = "ثانية… أداة الإيد لسه بتتحمّل";
  else msg.textContent = "ارفع إيدك وكبّر تكبيرة الإحرام";
}
function takbeerStep(up, t, w) {
  const mixed = settings.posture === "mixed";
  if (mixed && w == null && det.lastSeen) {
    const gone = t - det.lastSeen;
    if ((leftAbove() && gone >= AWAY_MS) || gone >= AWAY_ANY_MS) return startPrayer(det.lastSeen, true);
  }
  if (diag.hands === "off" && !SIM && !mixed) return startPrayer(t); // no hand tool on this phone: start now
  takbeerMsg();
  const at = handsEdge(up, t); // the hands stay "up" into the prayer, so this raise is not counted again
  if (at) startPrayer(at);
}

// The two fix buttons work on the bows, and the matching does the rest:
// "فاتتك حركة" adds a bow the camera did not see; "حسبت زيادة" removes the last bow counted.
function addMissedBow(t) {
  const last = obs.bows[obs.bows.length - 1];
  if (last && last.e == null) obs.bows.splice(obs.bows.length - 1, 0, { s: last.s - 1, e: last.s - 1, virtual: true });
  else obs.bows.push({ s: t, e: t, virtual: true });
  rec.event(t, "button: missed move");
  realign(t);
}
function removeLastBow(t) {
  for (let i = obs.bows.length - 1; i >= 0; i--) {
    const b = obs.bows[i];
    if (b.ignored) continue;
    if (b.virtual) obs.bows.splice(i, 1); else b.ignored = true;
    rec.event(t, "button: extra move");
    break;
  }
  realign(t);
}

// The person's own "facing the phone" head turn: the middle value of the last 10 s while upright
// (4 a second; not while a salam turn is going on). Salam turns are measured from it.
function noteYaw(yaw, t) {
  if (t - sal.yawAt < 250 || sal.side !== 0) return;
  const upright = app.mode === "calib" || app.mode === "takbeer"
    || (app.mode === "pray" && !stand.on && det.pose === "far" && det.score < 1);
  if (!upright) return;
  sal.yawAt = t;
  sal.yaws.push(yaw);
  if (sal.yaws.length > 40) sal.yaws.shift();
  const sorted = [...sal.yaws].sort((a, b) => a - b);
  sal.base = sorted[Math.floor(sorted.length / 2)];
}

// Salam: the head turns to one side, then to the other. A turn going on stays a turn down to a bit
// less than it needed (the face tool wobbles), and the second side needs a bit less than the first.
function salamCheck(seen, yaw, t) {
  const cur = app.steps[app.ptr];
  if (!cur.last || t - app.starts[app.ptr] < SALAM_ARM_MS) return;
  const pending = sal.first && t - sal.firstAt < SALAM_GAP_MS; // the first turn was just seen
  const need = (s) => (pending && s === -sal.first ? SALAM_YAW2 : SALAM_YAW);
  let side = 0;
  if (seen) {
    const rel = yaw - sal.base;
    if (sal.side && Math.sign(rel) === sal.side && Math.abs(rel) > need(sal.side) * SALAM_KEEP) side = sal.side;
    else side = rel > need(1) ? 1 : rel < -need(-1) ? -1 : 0;
  } else if (t - det.lastSeen > 300) {
    // the face tool often loses a face turned far away: use the strongest turn just before
    const strongest = det.yawHist.reduce((a, [, y]) => (Math.abs(y - sal.base) > Math.abs(a) ? y - sal.base : a), 0);
    if (Math.abs(strongest) > SALAM_LOST_YAW) side = Math.sign(strongest);
  }

  if (side !== sal.side) { sal.side = side; sal.since = t; return; }
  if (side === 0 || t - sal.since < SALAM_HOLD_MS) return;
  if (pending && side === -sal.first) return finish(t, "salam");
  if (sal.first !== side) rec.event(t, `salam turn ${side > 0 ? "+" : "-"}`);
  sal.first = side; sal.firstAt = t;
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
const diag = { face: "-", hands: "-", pose: "-", frames: 0, faces: 0, handsUp: 0, err: "" };
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
  const shText = sh.seen ? (sh.home ? sh.score.toFixed(2) : "seen") : "-";
  const text = `face: ${diag.face} · hands: ${diag.hands} · body: ${diag.pose} · frames: ${diag.frames} · faces: ${diag.faces} · hands up: ${diag.handsUp} · shoulders: ${shText} · turn: ${det.lastYaw.toFixed(2)} · size: ${det.valley ? (det.lastSize / det.valley).toFixed(2) : "-"} · video: ${v.videoWidth}x${v.videoHeight}` + (diag.err ? ` · error: ${diag.err}` : "");
  for (const el of document.querySelectorAll(".diag")) el.textContent = text;
}

// ---------- camera + face detection ----------
let detector = null;
let handDetector = null; // optional: without it the middle tashahhud ends at the ruku lean
let poseDetector = null; // optional: the shoulders help the face see a bow
let tick = 0, lastHandsUp = false, lastHandCount = 0, lastHandRes = null, lastShoulders = null;
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

async function loadPose(files) {
  diag.pose = "loading";
  try {
    const { PoseLandmarker } = await import(MP_BUNDLE);
    poseDetector = await withTimeout(PoseLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: MP_POSE_MODEL, delegate: "CPU" },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.4,
      minPosePresenceConfidence: 0.4,
      minTrackingConfidence: 0.4,
    }), 60000);
    diag.pose = "ready";
  } catch (e) {
    poseDetector = null;
    diag.pose = "off";
    diag.err = "body: " + String(e?.message || e);
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
      loadHands(files); // in the background: the prayer must never wait for them
      loadPose(files);
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
    let w = null, yaw = 0, box = null, handsUp = false, pos = null;
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
      const runHands = handDetector && wantHands();
      const runPose = poseDetector && wantPose();
      // The hand tool and the body tool take turns when both are needed, and during the prayer:
      // about 7 looks a second each is enough there, and saves battery.
      const odd = (tick++ & 1) === 1;
      const turns = (runHands && runPose) || app.mode === "pray";
      if (runHands) {
        if (!turns || !odd) {
          lastHandRes = handDetector.detectForVideo(video, performance.now());
          lastHandsUp = handsRaised(lastHandRes, box, video);
          lastHandCount = lastHandRes?.landmarks?.length || 0;
          noteHands(lastHandRes, box, video, lastHandsUp, t);
        }
        handsUp = lastHandsUp;
        if (handsUp) diag.handsUp++;
      } else { lastHandsUp = false; lastHandCount = 0; lastHandRes = null; }
      if (!runPose) lastShoulders = null;
      else if (!turns || odd) {
        try { lastShoulders = shouldersOf(poseDetector.detectForVideo(video, performance.now()), video); }
        catch (e) { lastShoulders = null; diag.err = "body: " + String(e?.message || e); }
      }
    } catch (e) { diag.err = String(e?.message || e); }
    showDiag();
    if (app.mode === "calib" || app.mode === "takbeer" || app.mode === "check") drawOverlay(box, lastHandRes, video, handsUp, lastShoulders);
    if (app.mode === "check") checkStep(w, handsUp, lastHandCount, t, pos, lastShoulders);
    onObservation(w, yaw, t, handsUp, pos, lastShoulders);
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

// For the record: each time two hands come up above the chest, how long and where they were at
// their highest, and whether it counted as a raise - to see why a takbeer was or was not seen.
// Places are from the middle of the face, in face widths (x) and face heights (y, + = lower);
// a raise needs both hands 0.45-2.5 widths out to the side and y between -1.0 and +1.1.
const handLog = { since: 0, last: 0, counted: false, best: null };
function handPair(res, faceBox, video) {
  const list = res?.landmarks;
  if (!faceBox || !list || list.length < 2) return null;
  const W = video.videoWidth || 640, H = video.videoHeight || 480;
  const fcx = (faceBox.originX + faceBox.width / 2) / W, fcy = (faceBox.originY + faceBox.height / 2) / H;
  const fw = faceBox.width / W, fh = faceBox.height / H;
  const at = list.slice(0, 2).map((pts) => ({
    x: (pts.reduce((a, p) => a + p.x, 0) / pts.length - fcx) / fw,
    y: (pts.reduce((a, p) => a + p.y, 0) / pts.length - fcy) / fh,
  })).sort((a, b) => a.x - b.x);
  const low = Math.max(at[0].y, at[1].y);
  if (low > 3) return null; // in the lap, not raised
  return { low, text: at.map((p) => `(${p.x.toFixed(1)},${p.y.toFixed(1)})`).join("") };
}
function noteHands(res, faceBox, video, counted, t) {
  if (app.mode !== "pray" || !rec.t0) return;
  const pair = handPair(res, faceBox, video);
  if (pair) {
    if (!handLog.since) Object.assign(handLog, { since: t, counted: false, best: null });
    handLog.last = t;
    handLog.counted ||= counted;
    if (!handLog.best || pair.low < handLog.best.low) handLog.best = pair;
  } else if (handLog.since && t - handLog.last > 400) flushHands(t);
}
function flushHands(t) {
  if (!handLog.since) return;
  rec.event(t, `hands up ${((handLog.last - handLog.since) / 1000).toFixed(1)}s ${handLog.best.text}${handLog.counted ? " = raise" : ""}`);
  handLog.since = 0;
}

function pickFace(list) {
  if (!list || !list.length) return null;
  return list.reduce((a, b) => (b.boundingBox.width > a.boundingBox.width ? b : a));
}

// The shoulders from the body tool (points 11 and 12): both must be seen, inside the picture.
// sy = their middle height, sw = the distance between them, both as shares of the picture height.
function shouldersOf(res, video) {
  const lm = res?.landmarks?.[0];
  if (!lm) return null;
  const a = lm[11], b = lm[12];
  const ok = (p) => p && p.visibility > 0.5 && p.x > 0 && p.x < 1 && p.y > 0.01 && p.y < 0.99;
  if (!ok(a) || !ok(b)) return null;
  const W = video.videoWidth || 640, H = video.videoHeight || 480;
  return { sy: (a.y + b.y) / 2, sw: Math.hypot((a.x - b.x) * W, (a.y - b.y) * H) / H, pts: [a, b] };
}

// The camera picture gets a box around the face, a line across the shoulders, and a dot on each
// joint of each hand seen. The hand dots turn green when both hands are up as for a takbeer.
function drawOverlay(box, handRes, video, bothUp, shoulders) {
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
  if (shoulders?.pts) {
    const [a, b] = shoulders.pts;
    ctx.strokeStyle = ctx.fillStyle = color("--lamp", "#d6b26b");
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(a.x * c.width, a.y * c.height);
    ctx.lineTo(b.x * c.width, b.y * c.height);
    ctx.stroke();
    for (const p of [a, b]) {
      ctx.beginPath();
      ctx.arc(p.x * c.width, p.y * c.height, r * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = bothUp ? color("--ok", "#74c095") : color("--text", "#e6ede9");
  for (const pts of handRes?.landmarks || []) {
    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(p.x * c.width, p.y * c.height, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Placement check: says what the camera sees, so the phone can be moved until the face, the
// shoulders and both raised hands fit in the picture. Raising the hands here does not start a prayer.
const placeCheck = { goodUntil: 0, shAt: 0 };
function checkStep(w, bothUp, handCount, t, pos, shoulders) {
  const msg = $("calibMsg");
  if (bothUp) placeCheck.goodUntil = t + 1500; // keep the good news on screen a moment
  if (shoulders) placeCheck.shAt = t;
  const bodyOn = diag.pose === "ready";
  const shOk = !bodyOn || t - placeCheck.shAt < 1000; // shoulders seen just now (not judged without the body tool)
  const good = t < placeCheck.goodUntil;
  const noShoulders = "مش شايف كتافك. ابعد الموبايل شوية أو وطّيه.";
  let text;
  if (good) text = !shOk ? `شايف إيديك ✓ بس ${noShoulders}` : bodyOn ? "شايف إيديك الاتنين وكتافك ✓ المكان ده مظبوط" : "شايف إيديك الاتنين ✓ المكان ده مظبوط";
  else if (w == null) text = "مش شايف وشك. حط الموبايل قدامك وبص له.";
  else if (w < 0.07) text = "وشك صغير أوي. قرّب الموبايل شوية.";
  else if (pos && pos.cy - pos.h / 2 < 0.05) text = "وشك على حافة الصورة من فوق. ارفع الموبايل أو ميّله لورا شوية.";
  else if (!shOk) text = noShoulders;
  else if (diag.hands === "loading") text = "شايف وشك ✓ ثانية، أداة الإيد بتتحمّل…";
  else if (diag.hands === "off") text = "شايف وشك ✓ بس أداة الإيد مش شغالة على الموبايل ده.";
  else if (handCount === 1) text = "شايف إيد واحدة بس. ابعد الموبايل شوية علشان الإيدين يبانوا.";
  else if (handCount >= 2) text = "شايف إيديك. ارفعهم جنب وشك زي التكبير.";
  else text = bodyOn ? "شايف وشك وكتافك ✓ ارفع إيديك الاتنين زي التكبير." : "شايف وشك ✓ ارفع إيديك الاتنين زي التكبير.";
  msg.textContent = text;
  msg.classList.toggle("good", good && shOk);
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
  placeCheck.goodUntil = 0; placeCheck.shAt = 0;
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

// away = started by standing up ("first rak'ah standing"): the face is above the picture now.
function startPrayer(t, away = false) {
  if (app.mode !== "calib" && app.mode !== "takbeer") return;
  $("startNow").hidden = true;
  const p = PRAYERS[app.key];
  app.mode = "pray";
  app.n = p.n;
  app.steps = buildSteps(p.n);
  app.ptr = 0;
  app.starts = [t];
  app.t0 = t;
  app.end = 0;
  app.drawnPtr = -1;
  app.match = null;
  app.alignedAt = t;
  app.cued = new Set();
  obs.bows = []; obs.raises = []; obs.sits = [];
  Object.assign(stand, { on: away, used: away, visit: null });
  det.pose = "far"; det.cand = null;
  sh.home = null;
  rec.start(t);
  rec.event(t, `start ${app.key} ${settings.posture}/${settings.place} sens ${settings.sens} hands ${diag.hands} body ${diag.pose}`);
  if (away) rec.event(t, "stood up");
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
  realign(t, true); // one last look at the whole prayer
  const segs = app.steps.slice(0, app.ptr + 1).map((s, i) => ({
    g: s.g, label: s.label, start: app.starts[i], end: app.starts[i + 1] ?? t,
  }));
  flushHands(t);
  rec.event(t, `end ${how} (facing ${sal.base.toFixed(2)})`);
  const entry = {
    id: app.t0, v: APP_VERSION, key: app.key, name: p.name, n: p.n, place: settings.place, posture: settings.posture,
    t0: app.t0, end: t, how, segs,
    trace: { sens: settings.sens, events: rec.events.join("; "), match: matchText(), samples: rec.samples.join(" ") },
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
  const match = r.trace.match ? `\nMATCH ${r.trace.match}` : "";
  const fields = ["t:size,score,y,turn,bowed", "t:size,score,y,turn,bowed,shoulders", "t:size,score,y,turn,bowed,shoulders,hands"][Math.max(0, Math.min(2, (r.v ?? 0) - 7))];
  return `${head}\nSTEPS ${steps}\nEVENTS ${r.trace.events}${match}\nSAMPLES ${fields} ${r.trace.samples}`;
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
  if (stand.on) text = "واقف"; // standing, above the picture: nothing to see until sitting down
  else if (det.pose === "near") { cls = "near"; text = "قريب"; }
  else if (!det.seen && t - det.lastSeen > 1000) { cls = "lost"; text = "مش شايفك"; }
  chip.className = `chip ${cls}`;
  chip.textContent = text;
}

function renderMeter() {
  // how far toward "closer" this upright position is (face or shoulders); full while bowed
  const lean = Math.max(det.score, sh.seen && sh.home ? sh.score : 0);
  const p = det.pose === "near" ? 1 : stand.on ? 0 : Math.max(0, Math.min(1, lean));
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
$("btnNext").addEventListener("click", () => { if (app.mode === "pray") addMissedBow(now()); });
$("btnBack").addEventListener("click", () => { if (app.mode === "pray") removeLastBow(now()); });
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
    feed(w, yaw = 0, t, handsUp = false, pos = null, shoulders = null) { simNow = t ?? simNow + 100; onObservation(w, yaw, simNow, handsUp, pos, shoulders); },
    state: () => ({ mode: app.mode, ptr: app.ptr, step: app.steps[app.ptr]?.label, group: app.steps[app.ptr]?.g, pose: det.pose, valley: det.valley, peak: det.peak }),
    history: () => load(HIST_KEY, []),
    handsRaised: (res, box, video) => handsRaised(res, box, video),
    check: (w, bothUp, handCount, t, pos, shoulders) => { checkStep(w, bothUp, handCount, t, pos, shoulders); return $("calibMsg").textContent; },
    obs: () => obs,
    det: () => det,
    stand: () => stand,
    sh: () => sh,
    shouldersOf: (res, video) => shouldersOf(res, video),
    noteHands: (res, box, video, counted, t) => noteHands(res, box, video, counted, t),
    sal: () => sal,
    diag: () => diag,
    match: () => app.match,
    draw: (box, handRes, video, bothUp, shoulders) => drawOverlay(box, handRes, video, bothUp, shoulders),
  };
}
