# Changes

Each version is saved in git with a name (v1, v2, ...). To go back to an earlier
version, ask for it by name, for example "go back to v4". The app shows its
version number at the bottom of the start screen.

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
