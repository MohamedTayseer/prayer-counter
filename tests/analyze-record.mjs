// Reads a pasted prayer record and lists every bow the camera saw, the pause before it,
// and the hand raises in that pause. Usage: node tests/analyze-record.mjs <record.txt>
import { readFileSync } from "node:fs";

export function parseRecord(text) {
  const line = (tag) => text.split("\n").find((l) => l.startsWith(tag)) || "";
  const head = text.split("\n")[0];
  const n = { "الفجر": 2, "المغرب": 3 }[head.split(" ")[2]] ?? 4;
  const events = line("EVENTS ").slice(7).split("; ").map((e) => {
    const i = e.indexOf(":");
    return { t: Number(e.slice(0, i)) * 100, what: e.slice(i + 1) };
  });
  // "near"/"far" may say what saw them ("near (shoulders)", "far (body)", "far (hands)"); twitches
  // are undone ("undo: short bow" drops the bow, "undo: short rise" makes it go on)
  const bows = [];
  for (const e of events) {
    const last = bows[bows.length - 1];
    if (/^near\b/.test(e.what)) bows.push({ s: e.t, e: null });
    else if (/^far\b/.test(e.what) && last && last.e == null) last.e = e.t;
    else if (e.what === "undo: short bow" && last) bows.pop();
    else if (e.what === "undo: short rise" && last) last.e = null;
  }
  // raises: every event that came from a hand raise ("raise", "raise (arms)", v6's "raise ignored"
  // and "fix: behind, raise = ..."; not the "hands up ... = raise" notes of v9 and later)
  const raises = events.filter((e) => /^raise|^fix: .*raise/.test(e.what)).map((e) => ({ t: e.t, what: e.what }));
  const end = events.find((e) => e.what.startsWith("end"))?.t ?? null;
  return { n, bows, raises, end };
}

if (process.argv[2]) {
  const { n, bows, raises, end } = parseRecord(readFileSync(process.argv[2], "utf8"));
  const names = ["ruku", "sujood 1", "sujood 2"];
  console.log(`rak'ahs: ${n}, bows seen: ${bows.length} (a full prayer has ${3 * n}), salam at ${end / 1000}s`);
  let prevEnd = 0;
  bows.forEach((b, i) => {
    const gap = (b.s - prevEnd) / 1000;
    const inGap = raises.filter((r) => r.t >= prevEnd && r.t < b.s).map((r) => `${r.t / 1000}s`).join(" ");
    const slot = i < 3 * n ? `r${Math.floor(i / 3) + 1} ${names[i % 3]}` : "extra";
    console.log(`bow ${String(i + 1).padStart(2)}: ${(b.s / 1000).toFixed(1).padStart(6)}s - ${(b.e / 1000).toFixed(1).padStart(6)}s  pause before ${gap.toFixed(1).padStart(5)}s ${gap > 6 ? "LONG " : "short"}  raises in pause: ${inGap || "-"}   in order = ${slot}`);
    prevEnd = b.e;
  });
  const tail = raises.filter((r) => r.t >= prevEnd).map((r) => `${r.t / 1000}s`).join(" ");
  console.log(`after last bow: ${((end - prevEnd) / 1000).toFixed(1)}s  raises: ${tail || "-"}`);
}
