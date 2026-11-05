# Changes

Each version is saved in git with a name (v1, v2, ...). To go back to an earlier
version, ask for it by name, for example "go back to v4". The app shows its
version number at the bottom of the start screen.

## v24 — a check-up of all 14 recorded prayers
- All the recorded prayers were played back through the app with small changes
  (face shape, head wobble, dropped frames, hands seen earlier or later). Nine
  of the fourteen showed no wrong step at all on the screen; the rest are
  below.
- Looking away is not a bow: a face turned far to the side cannot start one,
  and a "bow" under 3 s old whose head stays turned away is dropped (21 Oct,
  Fajr: the head turned far to the side and down for 2 s was taken for a bow).
- The salam is watched from 5 s into the last tashahhud (a glance while
  sitting up from the last sujood was taken for its first turn).
- Better records for finding problems without trying them yourself: 10 samples
  a second (about 4 before), whether the hands were up in every sample, and the
  very last frame (the salam's second turn was always missing).

## v23 — the takbeer is no longer taken for a bow (5 Nov: Dhuhr, Isha)
- Found from two real records: each time the hands go up for a takbeer, the
  face looks like it bows (10-30% bigger, a little lower, the hands beside it)
  while the shoulders do not move at all. The app showed "the ruku" for a
  moment and then took it back; in the Isha such a moment was kept as the first
  ruku, every step after it was one off, and the second rak'ah ran together.
- While the hands are up, and half a second after, the face alone cannot start
  a bow: the shoulders must go down too (in every real bow they do).
- A takbeer whose face looks bowed still counts as a raise; a "bow" less than
  a second old when the hands go up is dropped (it was the takbeer).
- The screen shows a step once it has lasted 1 second, so anything the app
  would take back never shows; the real steps appear a moment later.
- Played back, both prayers come out right with the steps never going back;
  the older records come out the same or better.

## v22 — the qibla compass
- While the app waits for the takbeer, a round compass shows under the camera
  picture: the ring (N, E, S, W) turns with the phone, a small Kaaba sits on it
  at the qibla, and the gold mark at the top is the way you face (the back of
  the phone standing in front of you, or its top when it lies flat). Turn
  until the Kaaba is under the mark: the compass turns green, "✓ متجه للقبلة".
- The qibla comes from the place kept for the adhan times; the compass is
  corrected from magnetic to true north (about 4 degrees in Egypt). The iPhone
  asks once to allow "motion and orientation". If the compass is unsure, it
  asks you to move the phone in a figure 8.

## v21 — the salam seen more often (2 Nov: Maghrib, Isha)
- Found from two real records: both prayers were counted right, but the salam
  was not seen and the prayer had to be ended with the button. The first turn
  was seen; the second turn was small and quick, and the face tool loses a
  turned face for a frame now and then - each such gap started the turn over.
- A face lost for a moment (under 0.3 s) no longer cancels a turn going on,
  and the second turn of the salam needs to be held 0.1 s instead of 0.2 s.
  Glances during the tashahhud still do not end the prayer.

## v20 — AM / PM
- The adhan times on the start screen say "2:45 PM" instead of "2:45 م", as asked.

## v19 — the adhan times in English digits
- The adhan times and the time left on the start screen are now written with
  English digits ("2:45 م", "فاضل 1 س 45 د"), as asked. Everything else in
  the app keeps its numbers as before.

## v18 — the adhan times on the start screen
- Each prayer on the start screen now shows today's adhan time where you are,
  and under it: how long is left (the next prayer has a gold border), "✓
  صلّيتها" in green if you already prayed it with the app today, or how long
  ago its adhan was, in orange, if you did not. After Isha, Fajr shows
  tomorrow's time. The day runs from 3 at night, like the list after a prayer.
- The phone is asked for your place once (the iPhone asks "Allow" the first
  time) and the app remembers it; "حدّث مكاني" asks again after you travel.
  The nearest city is named under the list ("قريب من ...").
- "مواعيد الأذان" in the settings: "من البرنامج" (the app works the times out
  itself, the Egyptian Survey Authority's way, with no internet) or "من
  الإنترنت" (aladhan.com, the same method, a month at a time; only your area,
  rounded to about 10 km, is sent; with no internet the app's own are used).
- Checked on 648 days in Cairo, Alexandria and Aswan: the app's own times are
  the website's to the minute, except Asr, which can be a minute apart (the
  website's Asr is the less exact one: checked with a third library).

## v17 — rising from ruku quickly (30 Oct: Dhuhr, Maghrib, Fajr)
- Found from three real records sent with the new button: rising from the ruku
  quickly, the head still a little forward, the face came back to its upright
  height and the shoulders came back up, but the face stayed 10-17% bigger than
  upright. The app took the ruku and the first sujood for one bow, so its steps
  fell one behind: it said "the sitting between the sujoods" at the tashahhud,
  gave no tashahhud cue, and in the Fajr it missed the salam.
- A bow is now also over when the face is back at about its upright height and
  the shoulders are back up, even while the face still looks a little bigger.
- The raise made while rising from the ruku now counts at that moment too (it
  was thrown away because the face still looked bowed).
- "ابعت التسجيل" no longer saves a second little file with only the record's
  name in it.
- Played back through v17, the three prayers come out right; all the older
  records and tests come out as before.

## v16 — the prayers left today, and sending the record
- At the very bottom of the screen shown after a prayer (under its steps, so the
  rest of the screen stays as it was): today's prayers that are not recorded
  yet. One tap starts the next one. The day runs from 3 at night, so an Isha
  prayed after midnight still belongs to the day before. When all five are
  recorded it says so.
- "انسخ التسجيل" is now "ابعت التسجيل": it opens the phone's share menu with the
  record as a file (named like prayer_2026-10-29_13-05_dhuhr_v16.txt). Choose
  "Save to Files" and Dropbox once; the phone remembers the place. The records
  are then read from Dropbox, with no copying and pasting. Where files cannot
  be shared, the record is copied as before.

## v15 — small bows and the start button (28 Oct, Dhuhr)
- Found from a real record (Dhuhr, sitting): the bows were small this time (the
  face grew only 10-30% and moved down a little), so sitting up between the
  sujoods and rising from the ruku were not seen and the bows ran together; the
  prayer could not be followed. The same record gives the same result in v7:
  it was not something a newer version broke.
- A bow is now also over when the face is back to about its upright size and
  place (not only when it is much smaller than at its deepest).
- A face lost while bowed counts as going up out of the picture only if it was
  moving up when it was lost; going down or staying down it is a sujood.
- The sensitivity with the phone in front is now 1.25 (it was 1.35). Played back
  through v15, all the real records come out as well or better than before, and
  that Dhuhr comes out right from the takbeer to the salam.
- Started with the button (the hand tool was still loading): the face at that
  moment is reaching for the phone, so the upright face is learned once it has
  rested a moment; no bow counts before that.
- A short twitch is no longer thrown away just before the bow it belongs to
  goes on.
- The record keeps the face's height in the picture too.

## v14 — two fixes from the 21 Oct records
- Dhuhr, first rak'ah standing: the app chose the body tool (meant for a phone
  on the floor), because standing at the table it saw the head and the hips.
  Sitting on the chair, the body tool cannot tell sitting upright from sujood
  (the back already reads 25-40° bent), so from rak'ah 2 the bows ran together.
  Now the body tool is chosen only when it sees the whole body, feet included,
  and no face big enough for the face tool in the last 1.5 s. At a table the
  feet are never in the picture.
- Fajr, sitting: a deep sujood at the bottom edge of the picture was cut in two
  by a flicker, and both pieces (under 1 s each) were thrown away as twitches.
  Now a piece under 1 s that goes straight on (within 0.8 s) into more of the
  bow is joined to it; only a short bow on its own is thrown away. This is in
  the sitting and "first rak'ah standing" modes too.
- The record keeps the face's height in the picture also while the body tool
  watches.

## v13 — automatic: no way of praying to choose, nothing learned before the prayer
- Found from a real record (Isha, 19 Oct, first rak'ah standing): nothing was
  counted. The camera saw the whole prayer (the 12 bows show clearly, in 4
  groups of 3), but the 3-second learning at the start was done while standing
  at the phone, and it was taken as the sitting place. From then on, sitting
  read as "standing" and every bow as "coming back to sit".
- New default way of praying: "تلقائي" (automatic). The old three (sitting,
  standing, first rak'ah standing) stay as a backup and work exactly as in v12.
- Automatic:
  - Nothing is learned before the prayer. The clock starts at the opening
    takbeer (the hands or the arms seen going up, sitting or standing), or when
    the face goes up out of the picture (standing up above a phone set for
    sitting), or with the start button.
  - Standing is only taken from what is seen: the face going up out of the
    picture (a face height or more above where it usually is), or peeking in,
    cut off by its top edge. A whole face high in the picture is not taken for
    standing, unless standing up was seen just before; even then, resting there
    for 5 s means sitting.
  - The sitting place is learned when sitting down is seen: the face comes into
    the picture and rests there. Sitting down and going straight on into a
    sujood counts that sujood.
  - A standing ruku seen from below that was taken for sitting down is put right
    when the face goes back up out of the picture (within 15 s, with at most one
    bow since). Sitting up straighter between the two sujoods does not undo it.
  - A small face with the whole body in the picture (phone on the floor): the
    body tool watches, as in the standing prayer.
  - With the phone on the lap: always sitting.
  - The prayer screen says "قاعد" or "واقف".
- The prayer record adds the face's real size and whether the app thought you
  were standing.

## v12 — the takbeer before ruku is also seen by the body tool
- In all the records so far, the takbeer just before each ruku was never seen
  with both hands up (the "sami' Allahu" raises were), although both hands go
  up beside the face. It is quick, and the hand tool looks only every other
  frame.
- The body tool follows the arms all the time: when it sees both wrists come
  up above the shoulders, one on each side of the head, that is a raise too
  (only while upright, as before). One hand, hands on the chest, or arms
  spread wide do not count.
- The prayer record says which tool saw each raise ("raise (hands)",
  "raise (arms)", or both), and notes each time the arms came up.

## v11 — first rak'ah standing, salam and takbeer from a real Dhuhr
- Found from a real record (Dhuhr, first rak'ah standing, 19 Oct): while
  standing, the face did not leave the picture: it peeked in at the top edge,
  and the app took that for sitting down. Sitting down on the chair was then
  counted as a sujood, the real second sujood was thrown out, and for a while
  the app even said "the last tashahhud" after rak'ah 3.
- While standing, the face is now read against where you sit:
  - up at the top edge or above where you sit = still standing (ignored);
  - much bigger than when sitting (your face close to the phone, looking
    down at it) = your standing ruku, counted;
  - back at your sitting place and staying there = sat down. A bow counts
    only after that.
- The prayer also starts when your face goes up to the top edge and stays
  there, not only when it leaves the picture.
- Salam: your turns in that prayer were small (about half of the Asr), so
  smaller turns now count (measured from how you face the phone).
- Takbeer: hands a little closer to the face now count (your takbeer before
  rak'ah 3 had them 0.4 face widths from the middle of the face).

## v10 — standing prayer watched by the body
- Found when praying standing: from a phone on the floor the face is too small
  for the face tool (standing far enough to fit in the picture), and closer up
  the head is out of the picture.
- For "واقف" the body tool is now the main eye. It sees the whole person from
  a couple of metres:
  - how far your back is bent compared with standing (in degrees, whatever
    angle the phone looks from): bent = ruku or sujood; upright = standing or
    sitting on the floor. Sitting up from sujood while still leaning forward
    a little also counts;
  - both wrists above your shoulders = the takbeer (opening, before ruku,
    "sami' Allahu", standing up for rak'ah 3);
  - your nose between your ears = the head turn for the salam.
- Put the phone on the floor a little past where you do sujood, leaning
  back, and stand far enough that your whole body is in the picture. The
  placement check draws your body's lines and says when your head or your
  waist is out of the picture.
- If the body tool does not work on the phone, standing prayers are watched
  by the face as before.
- The prayer record adds the back's bend and the arms for each sample.
- Sitting and "first rak'ah standing" prayers are unchanged.

## v9 — the salam is seen more surely
- Found from a real record (Asr, 17 Oct): the salam was not seen and the
  prayer had to be ended with the button. Even when facing the phone, the
  face read as turned a little to one side, so the turn to the other side
  only just reached the limit.
- Head turns are now measured from your own "facing the phone" position,
  learned during the prayer. Once the first turn is seen, the turn to the
  other side needs a bit less, and a small wobble in the middle of a turn no
  longer cancels it. The two turns must come within 8 seconds of each other.
- The prayer record now notes each time both hands come up (how long, and
  where they were next to the face), to find out why the takbeer before
  ruku and before rak'ah 3 is not seen. It also records how many hands were
  seen in each sample, and your "facing" value at the end.

## v8 — first rak'ah standing with the phone set for sitting, and shoulders
- "أول ركعة واقف" now works with the phone on a table in front, set for
  sitting (at arm's length). It does not need to see you standing:
  - The face is learned while sitting. Then the screen says "قوم اقف وكبّر":
    the prayer clock starts the moment you stand up (the face leaves the top
    of the picture). While you stand, the screen shows "واقف" and the reading
    of rak'ah 1.
  - Sitting down on the chair is seen when the face comes back and settles
    there (it does not have to be exactly where it was at the start). A bow
    counts only after that, so sitting down itself is never counted as a bow;
    sitting down and going straight into sujood is still counted.
  - Both ways of rak'ah 1 work: ruku standing and then sitting down, or
    sitting down and then ruku on the chair. The two sujoods are on the chair.
  - A standing ruku is usually out of the picture: it is shown as "—" and
    counted anyway. If the face comes into the picture for a moment and goes
    back up, that is counted as the standing ruku.
  - A prayer started by raising your hands (phone that sees you standing)
    is watched as in v7; only the matching now expects sitting down before
    the sujoods of rak'ah 1, as they are always on the chair.
- Shoulders: a new body tool watches the shoulders alongside the face and the
  hands. A bow counts when the face OR the shoulders lean into it, so a small
  ruku that the face hardly shows is caught. When the face is hidden in a
  sujood, the shoulders coming back up end the sujood on time.
- The phone placement check shows a line across the shoulders and says
  "مش شايف كتافك. ابعد الموبايل شوية أو وطّيه." when they are not in the
  picture.
- The sensitivity for "first rak'ah standing" is kept on its own.
- The prayer record adds the shoulders' lean to each sample, and the events
  "stood up", "face back", "sat down", "ruku (standing)", "near (shoulders)".
- Sitting and standing prayers count exactly as in v7 (checked with the same
  simulated prayers and the real record).

## v7 — the whole prayer is matched at once
- Found from a real record (Asr test, 16 Oct): the camera saw all 12 bows
  correctly, but the one-at-a-time corrections of v4/v5 made things worse
  (the face leaving the top of the picture when standing up from ruku was
  taken as a sujood, and every label after it shifted).
- New way: the bows and hand raises seen so far are matched against the shape
  of the prayer as a whole: the order, the rhythm of the pauses (reading and
  tashahhud long, rising and sitting short) and where the hands go up. A missed
  or extra bow is accepted only when that clearly fits better; otherwise bows
  are simply counted in order. Earlier steps are corrected too, not only the
  current one.
- A face that leaves the picture at standing height (through the top) means
  standing up, not a sujood.
- "First rak'ah standing": sitting down on the chair is recognised (face drops
  far without coming closer, then rests) and is not counted as a bow.
- The camera screen warns when the face sits at the top edge of the picture.
- Fix buttons during the prayer are now "فاتتك حركة" (add a bow the camera
  missed) and "حسبت زيادة" (remove the last bow).
- The prayer record has a new MATCH line: what each bow was counted as.
- Tests: `node tests/align.test.mjs` (includes a moment-by-moment replay of the
  real record when it is on the PC).

## v6 — phone placement check
- New button on the start screen: "اختبر مكان الموبايل وإيديك". It opens the
  camera with a box on the face and dots on the hands, and says what it sees
  (face too small, one hand only, both hands up ✓). Raising the hands there
  does not start a prayer.
- The dots also show on the camera screen before the opening takbeer.

## v5 — hand raises as checkpoints
- A hand raise now counts only when **both hands** go up beside the face, at
  takbeer height, while upright. One hand (scratching), hands folded on the
  chest, or hands on the knees or the floor never count.
- Hands are checked during the whole prayer (about 7 times a second), not only
  at the opening takbeer and the end of the middle tashahhud.
- Each raise is a checkpoint:
  - 1st raise while reading = the takbeer before ruku: for 6 seconds a smaller
    bow is enough to count as ruku.
  - 2nd raise with no bow seen between = the ruku was missed: it is added,
    timed from the 1st raise to the 2nd.
  - Raise while still on "ruku" = already rising ("سمع الله لمن حمده").
  - Raise while on a sujood or sitting step (after 5 seconds there) = the app is
    behind: it jumps to the next rak'ah (or to rak'ah 3 after the middle
    tashahhud).
- Twitches are undone: a bow shorter than 1 second, or a rise shorter than
  0.8 seconds between two bows.
- The version number is shown on the start screen and in the prayer record.

## v4 — better ruku/sujood detection
- Uses the head moving down in the picture as well as the face getting bigger.
- Self-correction: a deep bow when a ruku is expected adds the missed ruku; a
  shallow bow when the 2nd sujood is expected adds the missed sujood.
- A record of each prayer (last 10 prayers) with a "copy record" button.

## v3 — standing and mixed prayer
- "How I pray": sitting / standing / first rak'ah standing.
- Each move is compared with the one before it, not with the starting size.
- Tones play with the normal audio player (they were silent on iPhone).
- Salam is easier to catch.

## v2 — spoken cues
- The app says "التشهد الأوسط" and "التشهد الأخير" with the phone's own voice.
- Choice of voice, tone or no sound, and a test-sound button.

## v1 — first version
- Sitting prayer counted from the face coming closer to the phone.
- Live stopwatch: one row per rak'ah, big rows for the two tashahhuds.
- Starts at the opening takbeer, ends at the salam, history with averages.
