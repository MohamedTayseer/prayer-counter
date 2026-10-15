// Prayer counter for praying seated on a chair, standing, or standing for the first rak'ah only.
// The front camera finds the face. Coming toward the phone makes the face bigger ("near");
// moving back makes it smaller ("far"). Each move is compared with the one just before it
// (not with a fixed size), so it works standing, sitting, and when switching between them.
// Every change moves the prayer one step on:
// reading -> ruku -> rising -> sujood -> sitting -> sujood -> next rak'ah ... -> last tashahhud.
// The middle tashahhud ends when the hands come up beside the face for "Allahu Akbar".
// After the last tashahhud, turning the head right then left (the salam) ends the prayer.

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
// valley = smallest face size since the last move away (upright);
// peak = biggest face size since the last move closer (bowed).
const det = {
  ema: 0, pose: "far", cand: null, candSince: 0, valley: 0, peak: 0,
  lastSeen: 0, lastSize: 0, lastYaw: 0, yawHist: [], seen: false,
  calib: [], calibStart: 0,
};
const sal = { side: 0, since: 0, first: 0, firstAt: 0 };
const hands = { since: 0 };

function resetTracking() {
  Object.assign(det, { ema: 0, pose: "far", cand: null, candSince: 0, valley: 0, peak: 0, lastSeen: 0, lastSize: 0, lastYaw: 0, yawHist: [], seen: false, calib: [], calibStart: 0 });
  Object.assign(sal, { side: 0, since: 0, first: 0, firstAt: 0 });
  hands.since = 0;
}

// w = face width as a share of the picture width (null = no face), yaw = head turn (-1..1 roughly),
// handsUp = a hand is raised beside the face (only looked for during the middle tashahhud)
function onObservation(w, yaw, t, handsUp = false) {
  det.seen = w != null;
  if (w != null) {
    det.lastSeen = t;
    det.ema = det.ema ? det.ema * 0.5 + w * 0.5 : w;
    det.lastYaw = yaw;
    det.yawHist.push([t, yaw]);
    while (det.yawHist.length && t - det.yawHist[0][0] > 700) det.yawHist.shift();
  }
  if (app.mode === "calib") return calibStep(w, t);
  if (app.mode === "takbeer") return takbeerStep(handsUp, t);
  if (app.mode !== "pray") return;

  const up = settings.sens;                  // closer: face this many times bigger than the valley
  const down = 1 + (settings.sens - 1) * 0.7; // away: face this many times smaller than the peak
  let want = det.pose;
  if (w != null) {
    const size = det.ema;
    det.lastSize = size;
    if (det.pose === "far") {
      // keep the smallest upright size; follow very slowly if the person settles closer
      det.valley = size < det.valley ? size : det.valley + (size - det.valley) * 0.002;
      if (size >= det.valley * up) want = "near";
    } else {
      det.peak = Math.max(det.peak, size);
      if (size <= det.peak / down) want = "far";
    }
  } else if (det.pose === "far" && t - det.lastSeen > LOST_AS_NEAR_MS && det.lastSize >= det.valley * (1 + (up - 1) * 0.5)) {
    want = "near"; // face left the picture while coming close (head bent down in sujood)
  } else if (det.pose === "near") {
    det.peak = Math.max(det.peak, det.lastSize * 1.25); // lost while bowed: it got even closer
  }

  if (want !== det.pose) {
    if (det.cand !== want) { det.cand = want; det.candSince = t; }
    else if (t - det.candSince >= (want === "near" ? NEAR_HOLD_MS : FAR_HOLD_MS)) {
      det.pose = want; det.cand = null;
      // start the next comparison from where the move ended
      if (want === "near") det.peak = det.lastSize; else det.valley = det.lastSize;
      onPose(want, t);
    }
  } else det.cand = null;

  handsCheck(handsUp, t);
  salamCheck(w != null, yaw, t);
}

// Is the hand detector needed on this frame? Only during the middle tashahhud.
function wantHands(t) {
  if (app.mode === "takbeer") return true;
  const cur = app.steps[app.ptr];
  return app.mode === "pray" && cur?.mid && t - app.starts[app.ptr] >= HANDS_ARM_MS;
}

// Hands up for "Allahu Akbar" ends the middle tashahhud and starts the reading of rak'ah 3.
function handsCheck(up, t) {
  if (!wantHands(t) || det.pose !== "far" || !up) { hands.since = 0; return; }
  if (!hands.since) hands.since = t;
  else if (t - hands.since >= HANDS_HOLD_MS) { hands.since = 0; advance(t); }
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
  if (!up) { hands.since = 0; return; }
  if (!hands.since) hands.since = t;
  else if (t - hands.since >= HANDS_HOLD_MS) { const at = hands.since; hands.since = 0; startPrayer(at); }
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
  renderLive(true);
}

function stepBack() {
  if (app.ptr === 0) return;
  app.starts.length = app.ptr;
  app.ptr--;
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
    let w = null, yaw = 0, box = null, handsUp = false;
    const t = Date.now();
    try {
      const res = detector.detectForVideo(video, performance.now());
      diag.frames++;
      const d = pickFace(res.detections);
      if (d) diag.faces++;
      if (d) {
        box = d.boundingBox;
        w = box.width / video.videoWidth;
        const k = d.keypoints;
        if (k && k.length >= 3) {
          const eyeMid = (k[0].x + k[1].x) / 2;
          const eyeGap = Math.abs(k[0].x - k[1].x) || 0.001;
          yaw = (k[2].x - eyeMid) / eyeGap;
        }
      }
      if (handDetector && wantHands(t)) {
        handsUp = handsRaised(handDetector.detectForVideo(video, performance.now()), box, video);
        if (handsUp) diag.handsUp++;
      }
    } catch (e) { diag.err = String(e?.message || e); }
    showDiag();
    if (app.mode === "calib" || app.mode === "takbeer") drawBox(box, video);
    onObservation(w, yaw, t, handsUp);
    if (app.mode === "pray") renderMeter();
  }
  setTimeout(frame, FRAME_MS); // a plain timer: animation frames can be held back by the browser
}

// A hand counts as raised when its middle is at chin height or above (hands beside the ears for takbeer).
function handsRaised(res, faceBox, video) {
  const list = res?.landmarks;
  if (!list || !list.length) return false;
  const chin = faceBox ? (faceBox.originY + faceBox.height) / video.videoHeight + 0.1 : 0.55;
  return list.some((pts) => pts.reduce((a, p) => a + p.y, 0) / pts.length < chin);
}

function pickFace(list) {
  if (!list || !list.length) return null;
  return list.reduce((a, b) => (b.boundingBox.width > a.boundingBox.width ? b : a));
}

function drawBox(box, video) {
  const c = $("overlay");
  const ctx = c.getContext("2d");
  c.width = video.videoWidth || 640;
  c.height = video.videoHeight || 480;
  ctx.clearRect(0, 0, c.width, c.height);
  if (!box) return;
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--lamp").trim() || "#d6b26b";
  ctx.lineWidth = 4;
  ctx.strokeRect(box.originX, box.originY, box.width, box.height);
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
  $("startNow").hidden = true;
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
  const rec = { id: app.t0, key: app.key, name: p.name, n: p.n, place: settings.place, posture: settings.posture, t0: app.t0, end: t, how, segs };
  const hist = load(HIST_KEY, []);
  hist.unshift(rec);
  save(HIST_KEY, hist.slice(0, 200));
  showReport(rec);
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
  const ratio = det.valley ? det.lastSize / det.valley : 1;
  const p = det.pose === "near" ? 1 : Math.max(0, Math.min(1, (ratio - 1) / (settings.sens - 1)));
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
$("btnStop").addEventListener("click", () => finish(now(), "button"));
$("openHistory").addEventListener("click", showHistory);
$("rHistory").addEventListener("click", showHistory);
$("rHome").addEventListener("click", () => { app.mode = "home"; show("home"); });
$("hHome").addEventListener("click", () => { app.mode = "home"; show("home"); });

setInterval(() => renderLive(false), 250);

// Test hook (only with ?sim): feed face values by hand to check the counting logic.
if (SIM) {
  window.__pc = {
    feed(w, yaw = 0, t, handsUp = false) { simNow = t ?? simNow + 100; onObservation(w, yaw, simNow, handsUp); },
    state: () => ({ mode: app.mode, ptr: app.ptr, step: app.steps[app.ptr]?.label, group: app.steps[app.ptr]?.g, pose: det.pose, valley: det.valley, peak: det.peak }),
    history: () => load(HIST_KEY, []),
  };
}
