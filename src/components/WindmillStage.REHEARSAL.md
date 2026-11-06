# Why does a pinwheel spin?

## Plan and story

Audience: an eight-year-old child. Chinese and English stay on screen together.
The subject is a paper pinwheel, not an electricity-generating turbine. Keep one
wheel mounted through all five discoveries, with air, a folded blade, and its pin
as the only explanatory objects. The payoff is wind transferring some of its
movement energy into rotation. Omit electricity, equations, and turbine machinery.

Five beats with a 65-second base duration: moving air, force on tilted blades, rotation
around the pin, coasting to a stop, and energy transfer. Reading time is longer
than Stageshow's marketing-demo loop because both languages are for a child.
Actual playback also waits for the current narration to finish.
The film plays once on request. Pausing holds rotation; replay/chapters have
explicit user triggers. No scene resets in an unattended loop.

## Stageshow use

Uses the actual Stage component and its dependency subset, vendored from
`benjitaylor/skills/stageshow` version 1.1.1. The closest choreography reference
is `examples/payout-flow`: no cursor, overlapping responses, readable holds and
a retained final result. The scientific SVG is authored for this lesson, while
Stage supplies scale-to-fit, a separate compact layout, reduced-motion context,
and the film/check tooling. No financial product UI was copied into the lesson.

The wide composition is 960 × 500, allowed to fill the host. The phone is a
separate 358 × 510 composition: wheel above, bilingual explanation below. The
blade chapter uses a 358 × 630 composition for a true side view of a schematic
curled red blade, one axial blue air stream and one turning-component arrow
below the explanation. The front hero and side view share the exact rotation
angle and material-point marker. Experiment mode uses a
358 × 320 crop with its real wind controls outside the illustration. A single
outer host owns the corners.

## Scientific decisions

- Wind is moving air. Blue dots and lines are a visual aid, not visible air.
- Wind approaches the front of the folded paper wheel. Its paper surfaces are
  tilted relative to the incoming air. Aerodynamic force distributed over those
  surfaces has a component around the pin, producing torque about the axis;
  curvature alone is not sufficient. The child-facing narration says the
  folded paper turns air aside and air pushes back on the paper. The connected
  blades can turn around the pin; no torque formulas appear in the film.
- The front hero retains the original rotor image. The side detail uses
  `bladePaperPoint` to construct a schematic curled-paper surface, not a
  separately generated vane or a compressed raster image. Both views receive
  the same angle in one parent paint callback. A white-and-gold material-point
  marker relates the selected red blade in the two cameras.
- The true side camera projects depth horizontally and the rotor plane
  vertically. Incoming air moves left to right, parallel to the horizontal
  axle and onto the rotor's front. “Front” is defined by the wheel and axle,
  independent of the audience's position. The stream then bends opposite the
  counterclockwise turning tangent. The orange arrow shows only the turning
  component, not the whole aerodynamic force or airflow along a fold.
- Being perpendicular to the axle alone does not guarantee rotation: a radial
  force through the pin has zero moment about that axle. The tangential
  component at a nonzero radius produces the illustrated turning effect.
- The side paper is a qualitative curved surface, not a full reconstruction
  of the original raster artwork. The stream is an educational construction,
  not a measured flow field or CFD result extracted from the picture.
- The actual main rotor and gold direction arc are counterclockwise for this
  pictured fold orientation with wind from the front. Other folding patterns
  or wind directions can have a different turning direction. The gold arc
  shows rotation, not airflow or force.
- The pin supports the wheel. It is not a motor or an energy source.
- Wind level changes a bounded target speed. The model analytically integrates
  acceleration and friction and does not reset the wheel's angle on input.
- With no wind, friction gradually removes rotation. Seeking directly to this
  chapter opens on an already-spinning wheel, which is its stated initial
  condition. Experiment mode never injects this starting energy.
- This is not a quantitative wind-speed simulator or a model of every windmill.

Primary educational sources are linked in `src/content/windmill.ts` and on the
page: NASA Glenn on surface inclination and torque, Science Buddies on pinwheel
wind direction, NOAA Jetstream, Esplora science centre and Montana State University.

## Narration and interaction

Ten local AAC clips synthesized offline with Kokoro v1.1-zh: `zf_001` for
Chinese and `af_maple` for English. Generation speed is 0.85 and 0.67 respectively;
both recordings play at 1× without extra browser slow-down. A chapter waits for both
its reading time and the end of its actual narration. Audio load/stall failure
retains the bilingual animation and offers the other modes. The default is idle.

Verified in local Chrome: initial idle; play; pause/continue without rewinding;
voice switch; full five-chapter progression; replay; experiments at all three
wind settings; experiment controls and wheel visible together at 390 × 844;
retained chapter during experiments; background/pagehide/route exit cancellation;
missing audio fallback; and reduced-motion stillness. Switching back to the tab
does not restart narration by itself. Three bilingual questions accept retry.

## Earlier rehearsal and limits

These checks were recorded before the simplified paper-vane revision of
2026-11-06. They remain useful history for the player and earlier artwork, but
do not verify the current close-up or corrected rotation direction.

- 470 tests pass, including real AAC files/durations, content/voice consistency,
  model bounds, frame-rate independence, friction and routing.
- TypeScript, production build, PWA precaching and diff whitespace checks pass.
  Science code/CSS are lazy-loaded; the original app's main JS stays below 500 kB.
- Stageshow still checks and full sixty-second contact sheets were captured at
  1120px and 390px. Their gate printed `rehearsal passed`; the long motion reports
  are nevertheless **inconclusive** because a few sampling gaps exceeded the
  tool's interval threshold. They are not proof of uninterrupted frame coverage.
  The labels, entrances, phone crop, blade detail and experiment were also
  checked in screenshots and actual browser interaction.
- Scientific content and final keyframes received an independent review.
- Physical iPad/Safari hardware and its frame rate were not checked. Browser
  checks used local Chrome with mobile viewport/input emulation.

Capture sheets, individual keyframes, reports and browser scripts are saved in
`/private/tmp/windmill-rehearsal/`; controller smoke scripts are in
`/private/tmp/windmill-controller-review.cjs` and
`/private/tmp/windmill-controller-edge-review.cjs`.

## Art revision, 2026-11-05

The rotor now uses an original ImageGen paper-craft asset with connected rolled
vanes, visible paper grain and self-shadowing. Its actual copper-pin position is
aligned to the rotation pivot, beneath a stationary SVG pin. The scene has an
original morning meadow plate and a transparent foreground foliage layer;
gentle background parallax, grass sway and staggered airflow follow the same
playback clock and reduced-motion setting. Phone labels and chapter camera positions were checked
separately. The science entry card also uses the new art.

Asset paths, generation method and exact final prompts are recorded in
`docs/windmill-art-v2.md`. The five final chapter frames at desktop and 390px are
`art-v2-wide-{0..4}.png` and `art-v2-phone-{0..4}.png` in the rehearsal directory.
The revised visual layers passed pause and reduced-motion checks using
`art-v2-motion.cjs`; existing controller regressions, all 470 tests and the final
production/PWA build also pass.

## Earlier blade close-up correction, 2026-11-05 (superseded)

The separate brown vector strip did not match the rotor and incorrectly mixed
a close-up with a side-view caption. The inset now uses a circular SVG crop of
the same original rotor PNG, preserving the red fold, paper texture and pin
connection. It is labelled as a red-blade close-up in both languages. The original
revision used a point callout, withdrawn in the physics correction below. The
ambiguous diagonal force arrow and deflected-air
path were removed in that version. Chapter two then showed the old clockwise
rotation arc on the main wheel. Both the close-up and direction are superseded
by the current revision below.

The correction passed desktop (1120px), phone (390px) and narrow phone (350px)
Chrome captures, with the inset inside the stage and no horizontal overflow or
browser errors. An independent review checked that the close-up matches the
rotor and that both languages remain readable. TypeScript and the final
production/PWA build pass. Captures are `blade-closeup-{wide,phone,small-phone}.png`
and the check script is `blade-closeup.cjs` in the rehearsal directory.

## Earlier physics wording correction, 2026-11-05

The phrase "a turning push" was ambiguous and overemphasized curved blades.
That revision explained tilted paper surfaces receiving front-on air, with part
of the resulting force acting around the pin. It aligned the title, narration,
on-screen summary and quiz explanation, regenerated two actual AAC files
(10.721s Chinese and 9.955s English), and allowed 14 seconds for the chapter.
The current revision below replaces that narration and timing with a simpler
cause-and-response explanation; the principle about tilted surfaces remains.

Horizontal airflow is now limited to chapter one, where the topic is moving
air. From the blade explanation onward and in experiments, blue points shrink
and fade toward fixed wheel-plane targets, illustrating front-on arrival in
depth. They do not orbit with the wheel. At that time the legend used an
audience-relative direction. Current v5 labels replace that wording with wind
facing the rotor. The earlier dots were a perspective aid, not measured 3D flow.

The updated content/audio consistency and motion model checks all pass (20
tests), as do TypeScript and the production/PWA build. Browser checks confirm
the new airflow moves on fixed rays, pauses, respects reduced motion, and hides
when wind stops. Phone axis and energy labels, the experiment and 350/390/1120px
reading layouts were checked. Scripts and captures use the `blade-science-v3`
and `airflow-v3-motion` names in the rehearsal directory.

Scientific verification:

- NASA Glenn, [Factors That Affect Lift](https://www.grc.nasa.gov/WWW/K-12/FoilSim/Manual/fsim0004.htm):
  an inclined flat plate can generate transverse aerodynamic force; curvature
  is not a requirement.
- NASA Glenn, [Torque (Moment)](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/torque-moment/):
  force direction, application location and axis constraints determine rotation.
- Science Buddies, [The Power of a Pinwheel](https://www.sciencebuddies.org/stem-activities/strong-wind-science-the-power-of-a-pinwheel):
  changing a pinwheel's wind direction can change its speed and direction. The
  illustrated rotation is for this lesson, not a universal handedness rule.

## Earlier paper-vane revision, 2026-11-06 (superseded)

The previous three-color force decomposition was too complex for this lesson.
`BladeForceDiagram` now presents one broad, tactile coral-red paper vane and
one blue stream. Air comes in, turns aside over the visible paper face, and the
paper lifts gently. Two bilingual captions describe that sequence. The orange
resultant, gold component, small front wheel, separate legends and comparison
panels have been removed.

The main rotor's actual angle integration and direction arc now both run
counterclockwise. This follows the curl arrangement of this pictured rotor
under front-on wind, and applies in the film and wind experiment. Speed remains
a nonnegative magnitude; acceleration, coasting and friction keep their earlier
model. Regression checks cover decreasing angles and crossing zero correctly.

The diagram follows the player's authoritative `elapsedRef` using local rAF
sampling. Captions and the small paper response use the same clock. The chapter
lasts 16 seconds, with the final explanation held after the diagram settles at
14 seconds; total base duration is 63 seconds. The new narration's actual AAC
durations are 12.909 seconds Chinese and 11.045 seconds English. The phone layout
keeps a 190px landscape above the explanation and paper drawing; other chapters
and the experiment retain their sizes.

All 472 project tests and the final production/PWA build pass. Chrome at
1120/390/350px confirms CCW lesson/experiment/coasting, pause/replay, a static
reduced-motion poster, complete diagram bounds and no page errors. The compact
chapter uses a 358 × 600 Stage. A small blue outlet arrow and the label “One
blade, close up” make the direction and detail relationship readable in a still.
A fresh reviewer found no remaining concrete defect in the final wide/phone
stills after those corrections.

Both new Stageshow sheets printed `rehearsal passed` for the layout gate;
their motion reports remain `inconclusive` / exit 2 because of sampling gaps.
No uninterrupted motion coverage or physical iPad/Safari check is claimed.
Prior screenshots of the discarded diagram do not validate this revision.
Those checks describe the superseded independent-vane composition. They do not
validate the shared-view geometry in the revision below. The unused v3 asset
and exact generation prompt remain in `docs/windmill-art-v2.md`.

## Earlier front-wind and shared-blade revision, 2026-11-06 (v4, superseded)

The following records the v4 implementation and its checks. V5 replaces its
oblique raster detail with a true side camera; those checks do not validate
the replacement side geometry.

The independent side-vane image made the left and right views look like
unrelated blades with different motion. Both views now use the original
`paper-pinwheel-v2.png`, identical image bounds, the same red-blade material
point `(-84, -76)` and a matching white-and-gold marker. The main view stays
front-facing; the detail applies one common oblique projection to the paper,
axle and blue air. The faint rest of the rotor makes that camera change
readable. The v3 generated side-vane asset is retained as historical provenance
but is not used by the live detail; no new image was generated for this change.

The stream starts in front of the paper and approaches parallel to the axle,
then bends opposite the turning tangent. One orange arrow identifies only the
part of the push that turns the blade. It does not claim that all force
perpendicular to the axle produces rotation, or that force travels with the
air along the paper's curve. The scientific geometry and its limitations are
documented in `BladeForceDiagram.REHEARSAL.md`.

One parent animation callback paints the hero and detail with the exact same
angle and chapter time. The detail has no local clock or rAF loop. Entry aligns
counterclockwise from the retained current pose over 1.5 seconds and holds
until 4 seconds. Both views then sweep 48 degrees counterclockwise from
4 to 14 seconds and retain that pose to the end of the 18-second chapter.
Blue air continues on the parent clock during the final reading hold.
The weather badge says “Slow motion” during playback or “Still view” with
reduced motion; the local view says “Tilted view.”

The regenerated AAC narration lasts 13.173 seconds Chinese and 12.660 seconds
English. The five-chapter base duration is now 65 seconds. Phone chapter two
uses a separate 358 × 630 Stage; other chapters and the experiment retain their
established sizes.

All 491 project tests and the final production/PWA build pass. Final Chrome
checks at 1120/390/350px confirm the shared original image, 392 animation frames
with zero angle mismatches, CCW teaching motion, pause/replay, static posters,
comfortable compact caption clearance and no page errors. The experiment still
turns CCW under strong wind and coasts in the same direction after wind stops.
A fresh reviewer confirmed the final geometry and stills; their only remaining
static-mode label mismatch was fixed and independently rechecked.

Both current Stageshow sheets printed `rehearsal passed` for the layout gate.
Their motion reports remain `inconclusive` / exit 2 because of 12 wide and
7 phone sampling gaps. Every contact-sheet frame was inspected, but no
uninterrupted motion-coverage or physical iPad/Safari pass is claimed.
See `BladeForceDiagram.REHEARSAL.md` for exact filenames, counts and limits.

## Historical true side-view revision, 2026-11-06 (v5)

The tilted view synchronized the angle but left the incoming direction
ambiguous. The left diagram now looks exactly from the side, along a direction
in the rotor plane. `projectBladeSidePoint({x,y,z}) = {x:-z,y:y}` puts the axle
horizontal and the rotor reference plane vertical. Screen origin `(268,122)`
and scale `.56` keep the paper, axle, material mark and air in that same
projection. Blue air begins at front-side depth 430 and travels left to right
parallel to the axle, clearly facing the rotor rather than being described
relative to the audience.

The front hero is unchanged. The side geometry is built with `bladePaperPoint`:
four curled surfaces give the edge-on wheel context, with the selected red
surface bright and the others faint. This is a schematic fold tied to the
same rotating material point and angle, not an exact 3D reconstruction of the
generated front artwork. No new image was generated and the historical v3
side-vane PNG remains unused. The side view contains no circular rotation arc;
the selected blade's front-view CCW motion projects as vertical movement.

At the fold, the blue stream deflects downward, opposite the upward projection
of the orange turning component. The same parent callback still paints both
views. Entry alignment, the 4–14 second 48-degree teaching turn, pause/replay,
the final reading hold and reduced-motion pose retain the v4 timing design.
Left and right labels explicitly identify Side view and Front; other chapters,
the legend and descriptions also use wheel-relative front wording.

The current local AAC clips last 12.089 seconds Chinese and 13.495 seconds
English. Chapter two remains 18 seconds and the film's base duration remains
65 seconds. The compact blade stage remains 358 × 630.

All 503 project tests and the final production/PWA build pass. Chrome at
1120/390/350px confirms complete side-diagram bounds, no overflow, pause/replay,
static posters and no page errors. The sampled392frames have zero front/side
angle mismatch; the incoming stream has zero vertical variation before it
bends, and the selected side marker rises with the front marker's CCW movement.
A fresh reviewer confirmed the horizontal wind/shaft, vertical edge-on wheel,
arrow direction and readable bilingual layouts in the final chronological
frames, with no remaining picture defects.

The current wide and phone Stageshow sheets both print `rehearsal passed` for
the layout gate. Their motion coverage remains `inconclusive` / exit2 because
of10wide and2phone sampling gaps. All contact-sheet frames were inspected;
no uninterrupted continuous-motion or physical iPad/Safari pass is claimed.
See `BladeForceDiagram.REHEARSAL.md` for exact captures and limits.

The free local narration revision preserves all approved bilingual wording.
All 503 tests and the production build pass. Chrome played all ten AAC clips
at 1× and checked their actual durations, language switching, pause and voice-off
without page errors. A fresh production browser cached all ten clips, reloaded
offline and played both Chinese and English successfully. The model files remain
in the ignored `.windmill-tts.local/models` cache; only the generated audio is
bundled in the web app. Voice previews were supplied for listening evaluation;
the automated checks establish playback and timing, not subjective voice quality.

## Historical v6 oblique camera

The chapter-two detail now uses a 45-degree yaw / 15-degree elevation camera,
with an elliptical wheel plane, a visible rear axle, and all paper, airflow and
force geometry projected consistently. The right-hand front view remains the
rotation reference. Captions fade sequentially and diagram labels have a cream
glyph halo for landscape contrast. The established science wording, local AAC
narration, shared clock and 65-second film duration are retained.

All 510 tests passed; the final production/PWA build and 60 targeted checks
also passed after visual polish. Browser checks at 1120/390/350px confirm bounds,
pause/replay and zero angle mismatches across 392 frames. Both Stageshow layout
gates print `rehearsal passed`; motion coverage remains inconclusive because of
sampling gaps. A fresh visual review and follow-up confirmed the angle, wind,
caption transition and label contrast. See `BladeForceDiagram.REHEARSAL.md` for
the precise capture paths and remaining coverage limits.

## Historical V7 revision intent, 2026-11-06

The user rejected the v6 direction and oblique reading. Correct the composition
as well as the geometry: make the perspective paper wheel the chapter-two focal
object, with the existing front artwork reduced to a labelled rotation reference.
Keep the established bilingual wording, free local narration and shared clock.

Use one perspective camera for a shaded, opaque paper mesh, shaft, post and air.
The incoming field stays fixed in world space and travels from the wheel's front
along its axis. Each illustrated stream must meet the first actual paper surface,
then leave that same contact; no detached curve may orbit with the red marker.
Expose the rear shaft throughout the teaching turn. Give the paper a returned
corner and depth cues, rather than a set of flat projected wedges. Gold denotes
rotation; blue denotes airflow. Do not reuse the former tangential-force arrow
as an airflow arrow.

Desktop gives the angled scene the large right-hand area and places readable
captions beneath the left explanation. Compact uses the 358 × 630 design with
copy first, then the large angled scene and a small front reference. Verify
actual wide and phone pictures, direction through time, pause/replay, reduced
motion and the Stage filming gate before recording this revision as complete.

## Historical V7 implementation and review

The chapter-two focal object is now a shaded opaque Canvas mesh through one
perspective camera, yaw45°/elevation8°. The existing generated front image is a
small labelled reference; other chapters retain their art. The paper has a
rolled section, reverse faces and returned corners narrowing to18% radius. The
rear shaft remains exposed beyond the paper, including the completed poster.

Three world-fixed incident rays arrive along the axis. Each first-hit contact
connects continuously to its own departing path and particle travel; no stream
is detached and carried around by the red marker. Air bends opposite the spin
direction and leaves the open paper edge before reaching the rear. Blue denotes
airflow and gold denotes rotation, with the same CCW angle in both views.

Copy and captions now lead on compact screens, followed by the large angled
scene and small front reference. Desktop captions sit on the quiet left ground.
The inset has no inherited wheel-position/scale transition on chapter entry;
the narration and shared parent-clock choreography are unchanged.

All547 tests in46 files, TypeScript, content validation and production/PWA build
pass. Chrome at1120/390/350px found no overflow, cropped captions or page errors;
392 sampled frames had zero angle mismatches and no change to the world inlets.
Pause/replay and reduced-motion posters pass. Fresh visual review rejected
intermediate flat sails, disconnected wind and an occluded axle; final review
confirmed their fixes and reported no remaining must-fix issue. The paper is
still a stylized direction model, not CFD or a reconstruction of the generated
front artwork. Film reports and coverage limits are recorded in
`BladeForceDiagram.REHEARSAL.md`.

## V8 original hero and one matching blade, 2026-11-06

The user rejected the larger procedural wheel. The original generated front
wheel and meadow are restored as the main image. The45° detail is secondary and
contains only the original red blade: its exact source pixels, grain, fold and
outline are masked at runtime and projected with a small illustrative depth lift.
It is not another analytic paddle. Desktop remains960×500; compact restores the
front hero above the explanation and uses358×590 to fit the shorter detail.

One stationary axial ray reaches the original red paper throughout the teaching
turn. Blue denotes incoming air and a short visible local deflection. One
straight orange arrow is explicitly the turning component of the push, opposite
the air's sideways deflection and consistent with the main CCW rotation. The
local spin arc and material-point rings are removed. Existing bilingual wording,
free local narration, shared parent clock and48° teaching turn remain.

All551 tests across47 files, TypeScript, content validation and final
production/PWA build pass. Browser checks at1120/390/350px confirm restored hero,
loaded original texture, complete captions, no overflow/errors,362 sampled
frames without angle mismatch or inlet changes, Canvas pixel stability on pause
and replay reset. Independent science review checked component wording/signs;
fresh visual review found no must-fix shape, direction, crop or overlap issue.
Static pictures do not establish continuous rotation coverage. Exact film
records and limits are in `BladeForceDiagram.REHEARSAL.md`.


## V9 caption and crease-targeted air, 2026-11-06

The opening caption now naturally describes feeling a breeze on one's cheeks,
rather than “feeling it moving” on the face. Chinese and English text and both
free local AAC clips match; durations6.848s/6.992s fit the existing10s chapter.
The other eight AAC files were content-hash checked unchanged.

The secondary streamline now highlights the original bright fold at texture
(u380,v500), whose visible PNG crease spans u378..382. Arrival arrowhead, blue
contact and outgoing bend meet there. The annotation tracks this fold through
the shared teaching turn, while incoming direction remains parallel to the
shaft(-z). This replaces a world-fixed ray which could hit a flatter part of the
red paper. Force remains the opposite tangential component, and the main hero,
layout, leaf artwork and chapter timing are unchanged.

64 focused detail/content/motion/geometry checks, TypeScript, content validation
and the production/PWA build pass. Browser checks cover opening text at1120/390px,
fold contact and bounds at1120/390/350px,362 shared-angle frames with fixed axial
direction and exact material-target continuity, pixel-stable pause and replay.
Independent visual review confirms that the arrival now meets the visible fold,
blue air bends there and orange push stays distinct; no must-fix crop or label
collision was found. See `BladeForceDiagram.REHEARSAL.md` for film evidence.
