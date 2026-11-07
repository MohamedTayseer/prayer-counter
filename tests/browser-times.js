// The adhan times on the start screen (v18). Use: open the app with ?sim, paste this file, then
// `await timesTests()` (or run browser-all.js).
// 1. The times worked out by the app against the website (aladhan.com, the Egyptian method) on four
//    days: the same minute (Asr may be one minute apart: the website's Asr takes the next day's sun
//    for the shadow - checked on 648 days against a third library, the app's Asr is the closer one).
// 2. What each prayer button shows, with the clock and the history set by hand.
window.timesTests = async () => {
  localStorage.clear();
  const out = {};
  const WHERE = "prayerCounter.where", HIST = "prayerCounter.history", SRC = "prayerCounter.timesSrc", WEB = "prayerCounter.webTimes";
  const cairo = { lat: 30.0444, lon: 31.2357 };

  // ---- 1. against the website ----
  const refs = [
    ["cairo", 30.0444, 31.2357, 2026, 11, 1, { fajr: "2026-11-01T04:41:00+02:00", sunrise: "2026-11-01T06:09:00+02:00", dhuhr: "2026-11-01T11:39:00+02:00", asr: "2026-11-01T14:46:00+02:00", maghrib: "2026-11-01T17:08:00+02:00", isha: "2026-11-01T18:27:00+02:00" }],
    ["cairo (summer time)", 30.0444, 31.2357, 2026, 7, 1, { fajr: "2026-07-01T04:12:00+03:00", sunrise: "2026-07-01T05:57:00+03:00", dhuhr: "2026-07-01T12:59:00+03:00", asr: "2026-07-01T16:35:00+03:00", maghrib: "2026-07-01T20:00:00+03:00", isha: "2026-07-01T21:33:00+03:00" }],
    ["alexandria", 31.2001, 29.9187, 2026, 1, 15, { fajr: "2026-01-15T05:27:00+02:00", sunrise: "2026-01-15T06:59:00+02:00", dhuhr: "2026-01-15T12:10:00+02:00", asr: "2026-01-15T15:00:00+02:00", maghrib: "2026-01-15T17:20:00+02:00", isha: "2026-01-15T18:43:00+02:00" }],
    ["aswan", 24.0889, 32.8998, 2026, 5, 10, { fajr: "2026-05-10T04:38:00+03:00", sunrise: "2026-05-10T06:08:00+03:00", dhuhr: "2026-05-10T12:45:00+03:00", asr: "2026-05-10T16:09:00+03:00", maghrib: "2026-05-10T19:22:00+03:00", isha: "2026-05-10T20:42:00+03:00" }],
  ];
  for (const [name, lat, lon, y, m, d, ref] of refs) {
    const mine = __pc.prayerTimes(y, m, d, lat, lon);
    const diffs = Object.keys(ref).map((k) => { const min = Math.round((mine[k] - Date.parse(ref[k])) / 60000); return min ? `${k} ${min > 0 ? "+" : ""}${min}` : ""; }).filter(Boolean);
    out[`vsWeb ${name}`] = diffs.length ? diffs.join(", ") : "same";
  }

  // ---- 2. the buttons ----
  const T = __pc.prayerTimes(2026, 11, 1, cairo.lat, cairo.lon);
  const T2 = __pc.prayerTimes(2026, 11, 2, cairo.lat, cairo.lon);
  const H = (key, t0) => ({ id: t0, v: 18, key, name: key, n: 2, place: "front", posture: "auto", t0, end: t0 + 60000, how: "salam", segs: [], trace: null });
  const read = () => [...document.querySelectorAll("#prayerButtons .prayer")].map((b) => `${b.dataset.key}:${b.dataset.state || "-"}${b.classList.contains("next") ? "*" : ""} ${b.querySelector(".pt").hidden ? "(no time)" : `${b.querySelector(".ptime").textContent} ${b.querySelector(".pleft").textContent}`}`).join(" | ");
  const at = (t, hist = [], where = cairo) => {
    localStorage.setItem(HIST, JSON.stringify(hist));
    if (where) localStorage.setItem(WHERE, JSON.stringify({ ...where, at: t })); else localStorage.removeItem(WHERE);
    __pc.feed(null, 0, t); // (the test clock: now() is the last fed time)
    __pc.renderTimes();
    return read();
  };
  const note = () => document.getElementById("timesNote").textContent;
  const local = (y, m, d, h, mi) => new Date(y, m - 1, d, h, mi).getTime();

  // morning, Fajr recorded: Dhuhr is next, 1 h 39 min to go
  out.morning = `${at(T.dhuhr - 99 * 60000, [H("fajr", T.fajr + 20 * 60000)])} || ${note()}`;
  // 81 min after Dhuhr, not prayed: orange, Asr next
  out.dhuhrNotPrayed = at(T.dhuhr + 81 * 60000, [H("fajr", T.fajr + 20 * 60000)]);
  // the adhan just now, and the last minute before one
  out.adhanNow = at(T.dhuhr + 20000).split(" | ")[1];
  out.lastMinute = at(T.dhuhr - 30000).split(" | ")[1];
  // after Isha (all but Isha prayed): Fajr is tomorrow's and next
  out.afterIsha = at(T.isha + 90 * 60000, ["fajr", "dhuhr", "asr", "maghrib"].map((k) => H(k, T[k] + 15 * 60000)));
  out.tomorrowFajr = Math.round((T2.fajr - (T.isha + 90 * 60000)) / 60000) + " min to tomorrow's Fajr";
  // 1:00 at night (still the day before until 3): Isha prayed at 00:30 counts; Fajr next
  out.before3am = at(local(2026, 11, 2, 1, 0), [H("isha", local(2026, 11, 2, 0, 30))]);
  // no place yet: no times, it asks for the place
  out.noPlace = `${at(T.dhuhr, [], null)} || ${note()} || button: ${document.getElementById("whereBtn").textContent}`;
  // (v28, 7 Nov) Isha prayed right after Maghrib, before its own adhan: Isha shows ✓ before its adhan, and
  // is not "next"; after Isha's adhan, Fajr is still tomorrow's (not ✓)
  const both = ["fajr", "dhuhr", "asr"].map((k) => H(k, T[k] + 15 * 60000)).concat([H("maghrib", T.maghrib + 4 * 60000), H("isha", T.maghrib + 6 * 60000)]);
  out.ishaPrayedEarly = at(T.maghrib + 10 * 60000, both);
  out.ishaPrayedEarlyLater = at(T.isha + 30 * 60000, both).split(" | ").filter((x) => /^(fajr|isha)/.test(x)).join(" | ");

  // from the website, its month kept: its times are shown (here 3 min later than the app's, to see it)
  const realFetch = window.fetch;
  try {
    const shifted = {}; for (let d = 1; d <= 30; d++) { const t = __pc.prayerTimes(2026, 11, d, 30.0, 31.2); shifted[d] = Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v + 3 * 60000])); }
    localStorage.setItem(WEB, JSON.stringify({ area: "30,31.2", months: { "2026-11": shifted } }));
    document.querySelector('#timesSrcButtons [data-src="web"]').click();
    out.webKept = `${at(T.dhuhr - 99 * 60000, [], { lat: 30.0444, lon: 31.2357 }).split(" | ")[1]} || ${note()} || saved: ${localStorage.getItem(SRC)}`;
    // ...not kept for this area and no internet: the app's own times, and it says so
    window.fetch = () => Promise.reject(new Error("offline"));
    at(T.dhuhr - 99 * 60000, [], { lat: 26.557, lon: 31.695 });
    await new Promise((r) => setTimeout(r, 30));
    out.webOffline = `${read().split(" | ")[1]} || ${note()}`;
    // ...and a month the website gives (a fake answer): kept and shown
    window.fetch = async (url) => ({ ok: true, json: async () => ({ data: Array.from({ length: 31 }, (_, i) => ({ date: { gregorian: { date: `${String(i + 1).padStart(2, "0")}-12-2026` } }, timings: { Fajr: `2026-12-${String(i + 1).padStart(2, "0")}T05:00:00+02:00`, Sunrise: `2026-12-${String(i + 1).padStart(2, "0")}T06:30:00+02:00`, Dhuhr: `2026-12-${String(i + 1).padStart(2, "0")}T11:50:00+02:00`, Asr: `2026-12-${String(i + 1).padStart(2, "0")}T14:40:00+02:00`, Maghrib: `2026-12-${String(i + 1).padStart(2, "0")}T17:00:00+02:00`, Isha: `2026-12-${String(i + 1).padStart(2, "0")}T18:20:00+02:00 (EET)` } })), url }) });
    at(local(2026, 12, 5, 9, 0), [], { lat: 31.2001, lon: 29.9187 });
    await new Promise((r) => setTimeout(r, 30));
    out.webFetched = `${read().split(" | ").slice(1, 2)} || ${note()} || kept: ${Object.keys(JSON.parse(localStorage.getItem(WEB)).months).join(",")}`;
  } finally {
    window.fetch = realFetch;
    document.querySelector('#timesSrcButtons [data-src="app"]').click();
  }
  out.privacyApp = document.getElementById("privacyNote").textContent;

  localStorage.clear();
  __pc.renderTimes();
  console.log(out);
  return out;
};
// Results (v18): vsWeb: cairo "asr -1", alexandria and aswan "asr +1", cairo in summer time "same" (Asr: see above);
// morning: fajr:done ✓ صلّيتها | dhuhr:soon* فاضل 1 س 39 د | ... || قريب من القاهرة;
// dhuhrNotPrayed: dhuhr:due أذّن من 1 س 21 د, asr:soon*; adhanNow: بيأذّن دلوقتي; lastMinute: فاضل 1 د;
// afterIsha: fajr:soon* (tomorrow's), isha:due; before3am: isha:done, fajr:soon*; noPlace: (no time) x5,
// "علشان تشوف مواعيد الأذان..." / حدّد مكاني; webKept: dhuhr 3 min later, "· من aladhan.com";
// webOffline: the app's time, "النت مش شغال: المواعيد من البرنامج"; webFetched: 11:50 ص, kept 2026-12.
// v19: the times and the time left in English digits ("2:45 م", "فاضل 1 س 45 د"); otherwise = v18.
// v20: the clock as "2:45 PM" (en-US); otherwise = v19.
