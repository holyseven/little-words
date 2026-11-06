# Original pinwheel with a single-blade detail — v9

Updated2026-11-06. The user rejected the v7 large procedural3D wheel and asked
for the original front hero, a secondary45° detail, one matching paper blade
and a clearer force direction. This revision follows that composition.

## Intent and composition

The large generated paper pinwheel is restored at desktop(651,247), on the
original meadow. Compact restores the front hero in the top190px; explanation,
single-blade detail and captions follow. Desktop remains960×500; the compact
chapter-two Stage is358×590. Other chapters, experiments and local narration
retain their behavior. Stageshow's actual Stage and shared parent clock remain;
`payout-flow` is the closest choreography reference: causes overlap, result holds.

The detail is subordinate to the complete original wheel. Its heading says
“45°斜视 · 同一片纸叶 /45° view · Same blade.” The former full procedural wheel,
miniature front inset and local gold spin arc are removed from this chapter.

## The same original paper

`paintWindmillBladeDetail.ts` uses the SAME1254×1254
`paper-pinwheel-v2.png` as the hero. A runtime red-hue/alpha mask isolates the red
paper inside source crop[250,28]–[622,705]; no new bitmap is written or generated.
A528-triangle UV projection preserves its original outline, fold, paper grain
and shading. Patches overlap slightly to prevent visible antialias seams.

The original x/y coordinates retain `PAPER_ROTOR.bounds`. A shallow depth lift
near the visible fold provides an angled reading through the existing45° yaw,
8° elevation perspective camera. This is an illustrated depth treatment, not a
3D scan or recovery of the physical fold from the raster. Force is not calculated
from the guessed depth normal. The paper and hero use the same parent angle.

The virtual detail is390×170, scale.52, origin(195,77). Actual red pixels and the
force head fit y8..164 throughout the90°..138° teaching poses. The initial1.5s
full alignment would need a larger frame, so the close-up stays hidden during
alignment and fades in over1500..1850ms. Main hero alignment remains visible.
There are no competing material-point rings; identical red paper identifies the
blade, and one blue contact dot locates the illustrated wind contact.

## Wind and force

The representative incoming streamline now targets the original visible crease
at texture(u380,v500). Actual PNG pixels show the bright fold at columns378..382
on row500. The blue arrival arrowhead reaches that point, and the short outgoing
curve starts there. Contact follows that material fold as the paper turns, while
source and contact always share world x/y and the arriving direction stays-z,
parallel to the shaft. This highlights one streamline through a broad parallel
windfield; the annotation following the fold does not mean wind direction orbits.
The previous world-fixed(90,-50) line landed away from the visible bend in some
poses and was replaced at the user's request. The wind label follows its inlet.

Blue incoming particles join a short blue deflection continuously. The outgoing
segment follows above the illustrated paper with positive clearance rather than
being drawn behind the paper as an artificial overlay. It stops at a short local
turn; it does not claim to show the complete downstream wake or a measured flow.

ONE straight orange arrow starts at the blue contact and points along
T=(y/r,-x/r,0). It is explicitly “推着转的力 /Turning push”; the image description
calls it “让叶片转动的那部分推力.” Thus it depicts the tangential component,
not the full aerodynamic resultant. It lies in the rotor plane, perpendicular to
the radius, with CCW torque matching the main wheel. Blue sideways deflection is
oppositeT. A cream outline keeps the force arrow separate from the red fold.
There is no curved force arrow and no suggestion that force travels along paper.

[NASA's aerodynamic force explanation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/aerodynamic-force/)
describes pressure forces, while its
[torque explanation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/torque-moment/)
relates force direction and distance from an axis to turning. This child-facing
detail is a qualitative illustration, not CFD or an exact momentum calculation.

## Timing and accessibility

Parent timing is preserved: align0..1.5s, teaching turn48° CCW over4..14s,
read the result through18s. Blue air fades in with the detail; local deflection
appears2500..3050ms and orange push2700..3350ms, before rotation begins. All
particles and geometry use the parent's frame callback. Pause freezes Canvas
pixels and main rotation; chapter replay resets the sequence.

The two existing bilingual captions hand off without overlapping at4s. Canvas
has an image description and bilingual fallback. Reduced motion shows the
completed14s pose. Main-view badges identify front still/slow motion. Narration
remains free local Kokoro at1×, chapter two12.089s Chinese/13.495s English, with
65s base duration for five chapters. First-chapter Chinese now reads
“风，就是正在移动的空气。我们看不见空气，却能感觉到风轻轻吹过脸颊。”
English matches: “Wind is moving air. We cannot see the air, but we can feel a
gentle breeze on our cheeks.” Only these two local AAC clips were regenerated:
Chinese6.848s, English6.992s, both comfortably inside the10s chapter. Other eight
AAC contents were hash-checked unchanged. No paid voice service is used.

## V8 verification (historical; final v9 checks below)

All551 tests in47 files pass, along with TypeScript, content validation and the
final production/PWA build. Four detail checks cover original crease targeting and axial incidence,
original-point preservation, incident/outgoing continuity with front clearance,
and the turning component's radius/axis/torque relationship. An independent
physics review checked vector signs and the component wording.

Chrome at1120/390/350px confirms restored hero placement, loaded original red
texture, complete caption bounds and no horizontal overflow or page errors.
362 active frames had zero hero/detail angle mismatches and no incident-direction
changes. Canvas pixel data stays identical while paused; replay resets. The
script and final chronological frames are
`single-blade-wind-v8-{1120,390,350,air,force,turn}.png` in
`/private/tmp/windmill-rehearsal/`.

Fresh visual review of all six captures found no must-fix crop, overlap or
science-clarity issue: the original hero dominates, its one matching red leaf is
secondary, incoming/deflected blue air is distinct from the orange turning push,
and the component agrees with the visible CCW arc. Static poses alone cannot
verify continuous timing; that is separately sampled above.

Both final Stageshow layout gates print `rehearsal passed`. The wide sheet has
nine frames; the phone state sheet has eight. Every frame was inspected, from
hero alignment and close-up fade-in to force reveal, caption handoff and final
hold. Files are `single-blade-wind-v8-film-{wide,phone}.png` and JSON reports.
Motion remains `inconclusive` / exit2: wide846 samples over17.16s has11 gaps,
largest533.3ms; phone1014 samples over16.87s has2 gaps, largest28.8ms. Gaps were
not judged. The wide watcher flags the rotating source image's changing axis-
aligned bounds during initial alignment; an additional entry audit is recorded
below. Both films request manual review of the scene change at chapter entry.
Headless voice-off recordings print AudioContext autoplay warnings and do not
re-test narration. Physical iPad/Safari, CFD and uninterrupted motion coverage
are not claimed.


The separate native-rAF entry audit recorded134 frames with a maximum16.8ms
interval, maximum5.88° step and maximum.350°/ms angular rate, with zero reversal.
That rate remains below the analytic.36°/ms bound for the1.5s eased alignment.
The source image's changing bounding box is therefore reviewed as continuous
CCW rotation rather than a layout teleport. This audit covers entry only, not
unrecorded intervals in the full Stage films. Script:
`single-blade-wind-v8-entry.cjs` in the same rehearsal directory.


## V9 verification

The64 focused geometry, motion, detail and content checks pass, as do TypeScript,
content validation and the final production/PWA build. The updated detail test
uses crease columns measured from the source PNG, asserts that the same material
fold stays targeted throughout90°..138°, and checks world-axial incident direction,
continuous deflection, front clearance and opposite turning component.

Chrome captures at1120/390/350px verify the contact lies on the original bright
fold and the arrival arrow points to it before blue air bends. Opening Chinese
captions were checked at1120/390px; the old phrase is absent.362 live frames show
zero front/detail angle mismatch or incident-direction changes, and every frame
retains source texture contact(380,500). Pause holds Canvas pixels; replay resets;
no page errors or overflow were observed. Final script/captures use prefix
`fold-contact-wind-v9-` in `/private/tmp/windmill-rehearsal/`.

Independent visual review of1120/390/350px and chronological force/turn frames
confirmed that the incident line ends on the actual bright crease and bends
there, with distinct opposite orange push and no label/crop issue. The final
wide9-frame and phone8-frame Stageshow sheets were inspected in full; both layout
gates print `rehearsal passed`.

Motion remains `inconclusive` / exit2: wide858 frames over16.85s has10 sampling
gaps (largest400.5ms); phone1011 frames over16.84s has1 gap (largest32.4ms).
Those gaps were not judged. Wide still reports the unchanged rotating image's
changing bounds during entry, as audited in v8 above; both films request manual
review of chapter-entry drawing changes. Voice-off headless captures print
AudioContext autoplay warnings and do not establish audio listening quality.
Film files are `fold-contact-wind-v9-film-{wide,phone}.png` and matching JSON
reports. No uninterrupted-motion, physical iPad/Safari or CFD pass is claimed.
