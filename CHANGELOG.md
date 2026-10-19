# Changes

Each version is saved in git with a name (v1, v2, ...). To go back to an earlier
version, ask for it by name, for example "go back to v4". The app shows its
version number at the bottom of the start screen.

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
