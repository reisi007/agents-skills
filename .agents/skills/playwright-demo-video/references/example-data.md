# Demo data and storyboard example

The values below are deliberately generic. They exist so a new promo can be
rehearsed without inventing content mid-recording; replace them with the
project's own sample data. Use **real image fixtures** — a blurred placeholder
makes the result look like a bug.

## Sample dataset

| Field | Example value |
|---|---|
| Gallery | `Linz Derby 2026` |
| Correct title | `Fußball-Derby in Linz` |
| Description | `Derby-Abend im Linzer Stadion, Oberösterreich.` |
| Tag | `Fußball` |
| Location typed | `Lin` (slowly, one character at a time) |
| Suggestion to hold | `Linz / 4020 Oberösterreich` |
| Autofilled region / country / ISO | `Oberösterreich` / `Österreich` / `AT` |
| Author / copyright (derived, read-only) | `E2E photographer` |
| Wrong title for the edit | `FALSCH: Bayern München` |
| History row before restore | timestamp, `E2E photographer`, correct title + description |
| Image fixtures | `21_LASK-Reisinger_09.jpg`, `21_LASK-Reisinger_10.jpg` (two real photos) |

## Storyboard (~70–75 s total)

| # | Beat | Hold | What the viewer must see |
|---|---|---|---|
| 1 | App already loaded (boot trimmed) | 1.2 s | dashboard, no white spinner screen |
| 2 | Create the gallery | 1.8 s | gallery name visible |
| 3 | Open metadata defaults, enable "apply on upload" | 1.2 s | checkbox toggled |
| 4 | Type title / description / tag | 1.8 s | text readable in the form |
| 5 | Type `Lin`, show suggestion | 2.6 s | `Linz`, `4020 Oberösterreich` |
| 6 | Pick suggestion | 2.2 s | region, country, ISO filled |
| 7 | Save defaults | 1.8 s | success toast |
| 8 | Upload photo 1, then photo 2 | 1.6 s each | two real thumbnails load |
| 9 | Open photo 2 details | 2.6 s | real photo visible in detail view |
| 10 | Replace title with wrong value | 2.6 s | `FALSCH: Bayern München` |
| 11 | Save, open history | 6 s | old title, author, timestamp readable |
| 12 | Confirm restore | 2.6 s | "restored" toast, correct title back |
| 13 | Open photo 1 details | 3.2 s | upload defaults incl. correct author |
| 14 | Open photo 2 details | 3.2 s | restored metadata |

## Verification checklist for a finished clip

```sh
# metadata
ffmpeg -i public/demo-videos/<spec>.webm        # duration, 1280x720, VP9/WebM

# first frames — must NOT be white / a spinner / skeletons
ffmpeg -ss 0.1 -i public/demo-videos/<spec>.webm -frames:v 1 -y /tmp/first.png
ffmpeg -ss 0.5 -i public/demo-videos/<spec>.webm -frames:v 1 -y /tmp/first2.png

# storyboard beats (example times)
for t in 20 37 53 66 70; do
  ffmpeg -ss $t -i public/demo-videos/<spec>.webm -frames:v 1 -y /tmp/frame-$t.png
done
```

Read each extracted image. Confirm in particular:
- no login or boot frames at the beginning;
- the city suggestion with its postal code is legible;
- every uploaded photo renders (`naturalWidth > 0` was already asserted in the
  test, the frame check catches UI regressions the assertion cannot see);
- the wrong value, the history table and the restored value are readable;
- the final detail views show both photos.

If a frame fails, fix the harness/story and re-record. Do not trim a bad take by
hand — the committed WebM must come from the committed spec.
