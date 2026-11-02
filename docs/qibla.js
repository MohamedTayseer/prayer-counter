// The qibla: which way Makkah is from a place, and which way the person is facing from the phone's
// compass (v22). Angles are degrees clockwise from true north.

export const KAABA = { lat: 21.422487, lon: 39.826206 };
const rad = Math.PI / 180;

// The direction of the Kaaba from a place, along the shortest way over the earth (great circle).
export function qiblaBearing(lat, lon) {
  const p1 = lat * rad, p2 = KAABA.lat * rad, dl = (KAABA.lon - lon) * rad;
  const b = Math.atan2(Math.sin(dl), Math.cos(p1) * Math.tan(p2) - Math.sin(p1) * Math.cos(dl)) / rad;
  return (b + 360) % 360;
}

// The compass shows magnetic north; true north is this many degrees to its west in Egypt
// (2026: about 3.5 in Aswan to 5 in Sinai). Elsewhere 0 (a few degrees at most in the Arab world).
export function magneticOffset(lat, lon) {
  if (lat >= 21 && lat <= 32.5 && lon >= 24 && lon <= 37) return 3.3 + (lat - 22) * 0.1 + (lon - 25) * 0.05;
  return 0;
}

// The way the person faces, from one deviceorientation event (iPhone: webkitCompassHeading, the
// compass already corrected for the tilt; it follows the back of the phone when it stands up and
// its top when it lies flat - the way the person faces in both cases, with the screen toward
// them). null when the phone gives no compass. upright: the phone stands (more than 45 degrees).
export function facing(e, lat, lon) {
  let h = null;
  if (typeof e.webkitCompassHeading === "number" && e.webkitCompassHeading >= 0) h = e.webkitCompassHeading;
  else if (e.absolute && typeof e.alpha === "number") h = (360 - e.alpha) % 360; // (other phones, lying flat)
  if (h == null) return null;
  const upright = Math.abs(e.beta ?? 0) > 45;
  const acc = typeof e.webkitCompassAccuracy === "number" ? e.webkitCompassAccuracy : null;
  return { heading: (h + magneticOffset(lat, lon) + 360) % 360, upright, accuracy: acc };
}

// How far to turn (-180..180, + = to the right) to face the qibla.
export const turnBy = (qibla, heading) => ((qibla - heading + 540) % 360) - 180;
