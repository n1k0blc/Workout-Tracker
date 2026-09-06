# 1. An active workout lives in a persistent overlay, not at a route

Date: 2026-09-05

## Status

Accepted

## Context

An active workout could not be left. The user either finished it or discarded it —
there was no way to check a previous session, look at a template, or read analytics
mid-workout.

Nothing in the state layer was responsible for that. `WorkoutProvider` already sits in
the root layout, the draft is already mirrored to `localStorage`, and both timers are
already timestamp-based, so they survive navigation on their own. The block was
cosmetic: `MobileNav` returned `null` whenever a workout was active, and `/workout`
rendered the active screen instead of the start screen.

That makes the obvious design a route-derived one: unhide the nav, render a bar
whenever a workout exists and the route is not `/workout`, and let "minimize" simply
mean "navigate away". It needs no new state, browser back works by construction, and
reload and deep links are free.

**That design is wrong here, and the reason is not obvious.**

`ExerciseCard` keeps eleven pieces of state in the component, five of which are
session-meaningful rather than merely visual:

| State                     | What its loss looks like                          |
| ------------------------- | ------------------------------------------------- |
| `skippedPlannedSetNumbers`| planned sets the user swiped away **reappear**     |
| `additionalSetNumbers`    | extra draft set rows the user added **vanish**     |
| `sideEdits`               | half-entered unilateral values (left in, right pending) |
| `loggedSideEdits`         | in-flight per-side corrections to a logged set     |
| `editValues`              | typed-but-not-yet-logged weight/reps               |

Plus `isCollapsed` per card, `newlyAddedIds` on the screen, and scroll position.

None of it is in the context and none of it is persisted — deliberately, since these
are per-session view concerns rather than part of the saved workout. A route change
unmounts `/workout` and resets all of it. Today that only happens on a page reload,
which is rare and accidental. Under a route-derived minimize it would happen every
time the user glanced at anything, which is the entire point of the feature.

The skip state is the sharpest example: its own comment notes that it "survives server
re-sync because we filter on render". It does not survive unmount.

A second, smaller factor: the intended interaction is a drag that follows the finger
down into the bar. Under a route-derived model the destination is not mounted, so the
screen would translate over an empty background while a `router.push` races the
animation — a simulated sheet rather than a real one.

## Decision

The active workout renders in an **`ActiveWorkoutOverlay`, mounted in the root layout
for as long as a live workout exists**, and is minimized by a `isMinimized` flag in the
workout context rather than by navigating.

Minimized is a `translateY` that leaves the bar's height on screen, so **the mini-bar is
the overlay's own top edge** — not a separate component that mirrors its state.

Consequences that follow from the overlay never unmounting:

- All eleven state slots, open cards and scroll position survive minimize/restore.
- The drag animation moves the real DOM node, so it is honest rather than simulated.
- `isMinimized` persists alongside the draft, defaulting to expanded when absent.
- Expanding pushes a history entry so back-means-collapse; every minimize path routes
  through one context action, which consumes that entry.
- The route no longer decides what the user sees, so `/workout` needs an explicit guard:
  it offers to open the running session instead of rendering the start screen, which
  would otherwise let `startWorkout` overwrite a live session.
- `WorkoutCompletionModal` moves to the root layout, since completing a workout clears
  `activeWorkout` and so unmounts the overlay that used to own the modal.

This applies to **live sessions only**. Past-workout tracking and history editing are
data entry, not sessions: they have no running timer to watch, and they are reached from
a screen that a live session makes unreachable anyway.

A prerequisite: `/history/[id]/edit` was the last route still hijacking the single
workout slot. It adopts the local-state-plus-injected-handlers pattern that the template
and cycle-blueprint editors already use, after which `isHistoryEdit` is deleted. Without
that, "a workout is in the context" does not reliably mean "a live session is running",
and the overlay would mount over the history editor.

## Consequences

**Accepted costs**

- Past-workout tracking is unreachable while a session is live. Backfilling a forgotten
  Tuesday between squat sets is not a real workflow, and supporting it would reintroduce
  the multi-slot collision this removes.
- The overlay is a stacking context above the nav and below dialogs. Anything that must
  appear over an expanded workout has to be a portalled dialog.
- Minimizing has to close any open workout dialog, or a portalled picker at a higher
  z-index is left floating over the app after the workout collapses.

**Watch for**

A CSS `transform` on an ancestor becomes the containing block for `position: fixed`
descendants. The workout screen has both a `sticky top-0` header and a `fixed bottom-0`
action bar, and both re-anchor to the overlay once it is transformed. That is the
desired behaviour — the action bar should slide away with the screen — but it depends on
the overlay being exactly viewport-sized, and it should be confirmed on a device rather
than assumed.

**Rejected alternatives**

- *Route-derived minimize* — the design above; discards session state on every use.
- *Route-derived plus mirroring the five state slots into `sessionStorage`* — cheaper
  than the overlay, but it fixes neither scroll position nor the animation, and it
  spreads persistence logic through the most complex component in the app.
- *A genuine two-slot context (`liveWorkout` + `editingWorkout`)* — keeps the shared save
  path, but preserves `isHistoryEdit`'s branching in the timers, in draft persistence and
  in the nav. Decoupling the one remaining consumer deletes that branching instead.

## Related

Not addressed here, and deliberately not bundled: finishing a workout can still
overwrite a template or blueprint that was edited earlier in the same session, via the
"Blueprint aktualisieren" / "Vorlage überschreiben" options in the completion dialog.
The overlay makes that reachable but did not create it.
