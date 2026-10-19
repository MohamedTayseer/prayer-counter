# عدّاد الصلاة — Prayer Counter

A phone web app for praying seated on a chair. The front camera watches how close the face
(and the shoulders) come to the phone and counts each rak'ah, ruku and sujood, with a live
stopwatch for every part of the prayer. Everything runs on the phone; no video is recorded or
sent anywhere. By default ("تلقائي") it finds out by itself whether the person is sitting or
standing, and when they sit down.

- `docs/` — the app (served by GitHub Pages).
- `CHANGELOG.md` — what changed in each version (v1, v2, ...).
- `serve_https.py` — serve the app over https on the home Wi-Fi for testing
  (needs a self-signed certificate in `https/`, not uploaded).
- Test mode without a camera: open the app with `?sim`.
- `docs/align.js` — matches the bows and hand raises to the steps of the prayer.
- Tests: `node tests/align.test.mjs`. Real prayer records go in `tests/records/` (kept on this PC only).
  In the browser (`?sim`): paste `tests/browser-regression.js` (simulated prayers),
  `tests/browser-replay.js` (replays a record through the whole app),
  `tests/browser-old-sims.js` (exact step-by-step comparison of two versions),
  `tests/browser-salam.js` (salam with the face turned a little at rest),
  `tests/browser-standing.js` (standing prayers watched by the body) and
  `tests/browser-auto.js` (the automatic mode). `tests/browser-all.js` runs all of them and the
  record replays in one go (see the comment at its top).
