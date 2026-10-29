// The report screen (v16): today's prayers not recorded yet at its bottom, and the "ابعت التسجيل"
// button (the record as a file for the share menu, or copied where that is not possible).
// Use: open the app with ?sim, paste this file, then `await uiTests()` (or run browser-all.js).
window.uiTests = async () => {
  localStorage.clear();
  const out = {};
  const HIST = "prayerCounter.history";
  const at = (d, h, m) => new Date(2026, 9, d, h, m).getTime(); // a local time on 29 or 28 Oct 2026
  const setNow = (t) => __pc.feed(null, 0, t); // (the test clock: now() is the last fed time)
  const entry = (key, t0, o = {}) => ({ id: t0, v: 16, key, name: key, n: 2, place: "front", posture: "auto", t0, end: t0 + 60000, how: "salam", segs: [], trace: o.trace ?? null });
  const left = () => [...document.querySelectorAll("#rLog .todo .prayer")].map((b) => b.dataset.key).join(",") || document.querySelector("#rLog .todo")?.textContent || "(no list)";
  const openFirst = async () => { document.getElementById("openHistory").click(); await new Promise((r) => setTimeout(r, 10)); document.querySelector("#histList .open").click(); await new Promise((r) => setTimeout(r, 10)); };

  // a Fajr just prayed (a whole simulated prayer): the other four are listed, in order
  { document.querySelector('[data-posture="auto"]').click(); document.querySelector('[data-key="fajr"]').click(); await new Promise((r) => setTimeout(r, 30));
    setNow(at(29, 5, 0));
    for (let i = 0; i < 20; i++) __pc.feed(0.3, 0, undefined, false, { cx: 0.5, cy: 0.45, h: 0.39 });
    for (let i = 0; i < 6; i++) __pc.feed(0.3, 0, undefined, true, { cx: 0.5, cy: 0.45, h: 0.39 });
    for (let i = 0; i < 30; i++) __pc.feed(0.3, 0, undefined, false, { cx: 0.5, cy: 0.45, h: 0.39 });
    document.getElementById("btnStop").click();
    out.afterFajr = `${document.getElementById("report").hidden ? "no report" : "report"} | left: ${left()} | button: ${document.getElementById("rCopy").textContent}`; }

  // the record as a file for the share menu: its name and its text
  { let shared = null;
    const old = { canShare: navigator.canShare, share: navigator.share };
    navigator.canShare = () => true; navigator.share = async (d) => { shared = d; };
    document.getElementById("rCopy").click(); await new Promise((r) => setTimeout(r, 30));
    const f = shared?.files?.[0];
    out.shareFile = f ? `${f.name} | ${(await f.text()).split("\n")[0].slice(0, 40)} | button: ${document.getElementById("rCopy").textContent}` : "NOT SHARED";
    // ...and where files cannot be shared, the text is copied
    navigator.canShare = () => false; let copied = "";
    const oldClip = navigator.clipboard?.writeText; try { navigator.clipboard.writeText = async (t) => { copied = t; }; } catch { /* read-only */ }
    document.getElementById("rCopy").click(); await new Promise((r) => setTimeout(r, 30));
    out.copyFallback = copied ? `copied ${copied.split("\n")[0].slice(0, 30)} | button: ${document.getElementById("rCopy").textContent}` : `not copied | box shown: ${!document.getElementById("rTrace").hidden}`;
    navigator.canShare = old.canShare; navigator.share = old.share; try { if (oldClip) navigator.clipboard.writeText = oldClip; } catch { /* ignore */ } }

  // tapping a listed prayer starts it
  { document.querySelector("#rLog .todo .prayer[data-key=dhuhr]")?.click(); await new Promise((r) => setTimeout(r, 30));
    out.tapStarts = `${__pc.state().mode} | ${document.getElementById("calibTitle").textContent} | screen calib: ${!document.getElementById("calib").hidden}`;
    document.getElementById("calibCancel").click(); }

  // all five recorded today: one line saying so
  { localStorage.setItem(HIST, JSON.stringify(["fajr", "dhuhr", "asr", "maghrib", "isha"].map((k, i) => entry(k, at(29, 5 + i * 3, 0))).reverse()));
    setNow(at(29, 21, 0)); await openFirst(); out.allDone = left(); document.getElementById("rHome").click(); }

  // an Isha at 00:30 belongs to the day before; a new day starts at 3 at night
  { localStorage.setItem(HIST, JSON.stringify([entry("fajr", at(29, 5, 0)), entry("isha", at(29, 0, 30))]));
    setNow(at(29, 10, 0)); await openFirst(); out.lateIsha = left(); document.getElementById("rHome").click();
    localStorage.setItem(HIST, JSON.stringify([entry("fajr", at(28, 5, 0)), entry("dhuhr", at(28, 13, 0))]));
    setNow(at(29, 2, 30)); await openFirst(); out.before3am = left(); document.getElementById("rHome").click(); }

  localStorage.clear();
  console.log(out);
  return out;
};
// Results (v16): afterFajr: report | left: dhuhr,asr,maghrib,isha | button: ابعت التسجيل;
// shareFile: prayer_2026-10-29_05-..._fajr_v16.txt | prayer-counter v16 الفجر ... | button: اتبعت ✓;
// copyFallback: copied prayer-counter v16 ... ; tapStarts: takbeer | صلاة الظهر | screen calib: true;
// allDone: كل صلوات النهارده اتسجلت ✓; lateIsha: dhuhr,asr,maghrib,isha; before3am: asr,maghrib,isha.
