// The five adhan times of a day at a place, worked out from the sun - the Egyptian way (the Egyptian
// General Authority of Survey, as in Egypt's official calendars): Fajr when the sun is 19.5 degrees
// below the horizon, Isha at 17.5, Asr when a thing's shadow is its own length plus its shadow at
// noon, Maghrib at sunset (the sun's top edge at the horizon, 0.833 degrees with the air bending
// its light). Everything is worked out in UTC and given back as moments (ms since 1970), so the
// phone shows them in its own time - summer time follows by itself.
// Uses the sun's place from the US Naval Observatory's short formulas (good to about a minute).

export const EGYPT = { fajr: 19.5, isha: 17.5, asr: 1 };
export const KEYS = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];

const rad = Math.PI / 180;
const sinD = (d) => Math.sin(d * rad), cosD = (d) => Math.cos(d * rad), tanD = (d) => Math.tan(d * rad);
const asinD = (x) => Math.asin(x) / rad, acosD = (x) => Math.acos(x) / rad;
const atan2D = (y, x) => Math.atan2(y, x) / rad;
const fix = (a, b) => ((a % b) + b) % b;

// The sun at a moment (jd = Julian day): how far north of the equator it is (declination, degrees)
// and how far the sundial runs ahead of the clock (equation of time, hours).
function sun(jd) {
  const d = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * d, 360);   // mean anomaly
  const q = fix(280.459 + 0.98564736 * d, 360);   // mean longitude
  const L = fix(q + 1.915 * sinD(g) + 0.020 * sinD(2 * g), 360); // place on the ecliptic
  const e = 23.439 - 0.00000036 * d;              // tilt of the earth
  const ra = fix(atan2D(cosD(e) * sinD(L), cosD(L)) / 15, 24);
  return { decl: asinD(sinD(e) * sinD(L)), eqt: fix(q / 15 - ra + 12, 24) - 12 };
}

// y, m, d: the date (m 1-12); lat, lon: degrees (north and east +). Returns { fajr, sunrise, dhuhr,
// asr, maghrib, isha }: moments in ms rounded to the minute (NaN where the sun never gets there,
// far north in summer - then Fajr and Isha are a share of the night instead, by their angle).
// Each time takes the sun as it is at a fixed guess of that time of day (Fajr 5, sunrise 6, noon 12,
// Asr 13, sunset and Isha 18, in the place's sun time), as the PrayTimes method does - the one the
// prayer-times website (aladhan.com) uses: so both give the same minutes (taking the sun at the
// exact time instead moves Asr by up to half a minute; the rest by a few seconds).
export function prayerTimes(y, m, d, lat, lon, method = EGYPT) {
  const day0 = Date.UTC(y, m - 1, d);            // 0h UTC of that date
  const jd = day0 / 86400000 + 2440587.5 - lon / 360; // midnight in the place's sun time
  const noonAt = (guess) => fix(12 - sun(jd + guess / 24).eqt, 24);
  // when the sun is at this height (degrees, - = below the horizon), before (-1) or after (+1) noon
  const atAngle = (alt, guess, side) => {
    const s = sun(jd + guess / 24);
    const c = (sinD(alt) - sinD(lat) * sinD(s.decl)) / (cosD(lat) * cosD(s.decl));
    return c < -1 || c > 1 ? NaN : noonAt(guess) + (side * acosD(c)) / 15;
  };
  const asrHeight = () => { // a shadow as long as the thing (times method.asr) plus its noon shadow
    const s = sun(jd + 13 / 24);
    return Math.atan(1 / (method.asr + tanD(Math.abs(lat - s.decl)))) / rad;
  };
  const sunTime = {
    fajr: atAngle(-method.fajr, 5, -1),
    sunrise: atAngle(-0.833, 6, -1),
    dhuhr: noonAt(12),
    asr: atAngle(asrHeight(), 13, 1),
    maghrib: atAngle(-0.833, 18, 1),
    isha: atAngle(-method.isha, 18, 1),
  };
  const h = {};
  for (const k of KEYS) h[k] = sunTime[k] - lon / 15; // sun time -> UTC hours of that date
  // far north/south: no true dawn or dusk (or it is far into the night) - a share of the night instead
  const night = 24 - (h.maghrib - h.sunrise);
  if (!Number.isNaN(night)) {
    const fp = (method.fajr / 60) * night, ip = (method.isha / 60) * night;
    if (Number.isNaN(h.fajr) || h.sunrise - h.fajr > fp) h.fajr = h.sunrise - fp;
    if (Number.isNaN(h.isha) || h.isha - h.maghrib > ip) h.isha = h.maghrib + ip;
  }
  const out = {};
  for (const k of KEYS) out[k] = Number.isNaN(h[k]) ? NaN : Math.round((day0 + h[k] * 3600000) / 60000) * 60000;
  return out;
}
