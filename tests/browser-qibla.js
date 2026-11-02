// The qibla compass on the camera screen (v22). Use: open the app with ?sim, paste this file, then
// `await qiblaTests()` (or run browser-all.js). The phone's compass is fed by hand (__pc.qibla).
window.qiblaTests = async () => {
  localStorage.clear();
  const out = {};
  const { qiblaBearing, turnBy } = await import(new URL("qibla.js", location.href).href);
  // 1. the qibla from known places (published values, degrees from true north)
  const known = { cairo: [30.0444, 31.2357, 136.1], london: [51.5074, -0.1278, 119.0], newYork: [40.7128, -74.006, 58.5], jakarta: [-6.2088, 106.8456, 295.1], sydney: [-33.8688, 151.2093, 277.5] };
  out.bearings = Object.entries(known).map(([k, [la, lo, want]]) => `${k} ${qiblaBearing(la, lo).toFixed(1)} (${Math.abs(qiblaBearing(la, lo) - want) <= 0.3 ? "ok" : "WANT " + want})`).join(", ");
  out.turnBy = [turnBy(136, 100), turnBy(136, 170), turnBy(10, 350), turnBy(350, 10)].join(",");

  // 2. the dial, the place in Cairo, the phone standing (beta 80) or lying flat (beta 5)
  const open = async () => { document.querySelector('[data-key="fajr"]').click(); await new Promise((r) => setTimeout(r, 30)); };
  const settle = (e, n = 40) => { let s; for (let i = 0; i < n; i++) s = __pc.qibla(e); return s; };
  const show = (s) => `${s.on ? "GREEN" : "-"} | ${s.text}`;
  localStorage.setItem("prayerCounter.where", JSON.stringify({ lat: 30.0444, lon: 31.2357, at: 0 }));
  await open();
  out.visible = !document.getElementById("qibla").hidden;
  // (the compass is magnetic: in Cairo true north is about 4.4 degrees to its west)
  out.facingQibla = show(settle({ webkitCompassHeading: 131.7, beta: 80, webkitCompassAccuracy: 10 }));
  out.within10 = show(settle({ webkitCompassHeading: 123, beta: 80, webkitCompassAccuracy: 10 }));
  out.turnRight = show(settle({ webkitCompassHeading: 100, beta: 80, webkitCompassAccuracy: 10 }));
  out.turnLeft = show(settle({ webkitCompassHeading: 175, beta: 80, webkitCompassAccuracy: 10 }));
  out.flat = show(settle({ webkitCompassHeading: 131.7, beta: 5, webkitCompassAccuracy: 10 }));
  out.unsure = show(settle({ webkitCompassHeading: 100, beta: 80, webkitCompassAccuracy: 40 }));
  // the ring goes the short way round: from 350 to 10 it passes north, not south
  settle({ webkitCompassHeading: 350, beta: 80, webkitCompassAccuracy: 10 });
  const one = __pc.qibla({ webkitCompassHeading: 10, beta: 80, webkitCompassAccuracy: 10 });
  out.shortWay = `ring after one step from 350 to 10: ${one.ring}`;
  const k = settle({ webkitCompassHeading: 131.7, beta: 80, webkitCompassAccuracy: 10 });
  out.kaabaOnRing = k.kaaba; // at 136 degrees on the ring, kept upright
  document.getElementById("calibCancel").click();
  out.hiddenAfter = document.getElementById("qibla").hidden;
  // no place kept: it asks for it
  localStorage.removeItem("prayerCounter.where");
  await open();
  out.noPlace = show(__pc.qibla());
  document.getElementById("calibCancel").click();
  localStorage.clear();
  console.log(out);
  return out;
};
// Results (v22): bearings all ok; turnBy 36,-34,20,-20; facingQibla/within10/flat GREEN ✓ متجه للقبلة;
// turnRight "لف ناحية اليمين ..."; turnLeft "لف ناحية الشمال ..."; unsure "... على شكل 8"; shortWay
// rotate(-354) (not -180); hiddenAfter true; noPlace asks for the place.
