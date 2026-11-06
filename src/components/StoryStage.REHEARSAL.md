# StoryStage rehearsal

## Direction

Reworked the five original narrated SVG stories using the framing, story, motion,
and rehearsal methods in `benjitaylor/skills/stageshow` (installed version 1.1.1).
The closest motion reference is `examples/payout-flow`: no cursor, overlapping
arrivals, a readable result held in place. Its financial UI and kit were not
copied into the children's story player; existing SVG characters, local voices,
and the nine spoken lines per story remain the product's own material.

The sequence in each chapter is a request, an action, and a response. The focal
object changes because of the spoken line. Earlier people and props remain in
the scene. Three small learning-word slots make the current subject readable
at phone size. The phone framing crops scenery while retaining actors and props.

## Motion decisions

- Family: each family member arrives, then moves into the group for the next introduction.
- School things: the pencil and book travel between their owners, settle onto
  the table, then the bag opens and the pencil case emerges and opens.
- Colors: red, blue, and yellow are all balloons. Earlier balloons move to
  separate parking positions so the next color does not hide them.
- Numbers: blocks are picked up and placed to make a bridge; Momo crosses only
  after the third block has landed.
- Classroom: door and window rotate on their hinges; the child makes room as
  Momo enters, then moves to the chair.

One bounded clock drives travel and finite gestures. Pause freezes the pose;
replay resets the current action without replacing the stage or its props.
The narration still advances on actual audio completion. Reduced motion uses
settled, finite poses. The result stays in the same geometry at the ending.

## Verification

- TypeScript and production/PWA build pass.
- 449 tests pass, including motion timing, cancellation, rate changes, reduced
  motion, valid SVG geometry, the yellow balloon, and English-only labels.
- Headless Chrome: all five stories played from line 1 through line 9 to their
  endings at 1024px. Contact sheets cover every spoken line.
- 390px phone framing: all five endings checked, no horizontal page overflow.
- Pause, continue, same-line replay, retained prop identity, playback-speed
  change, and reduced motion checked in the actual player.
- Existing local audio, subtitle text, learning targets, and routes remain covered
  by the content and playback regression tests.

The browser captures and interaction scripts for this run are in
`/private/tmp/little-words-rehearsal/`. Verification uses the actual narrated SVG
player and its controls; the upstream faux-UI kit's film gate was not used.
Physical iPad/Safari hardware was not tested. Minor pose changes, such as the
child's leg shape on sitting, are still stylized rather than a skeletal rig.
