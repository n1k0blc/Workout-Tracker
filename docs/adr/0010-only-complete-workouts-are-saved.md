# 10. Only complete workouts are saved

Date: 2026-11-02

## Status

Accepted

## Context

A workout could be saved with sets missing: "Beenden" was enabled as soon as every Übung had one
logged set, and a set could be logged with fields empty. History then held workouts that looked
like sessions but were half-filled — a planned set neither done nor skipped, a working set without
RIR (#221).

A forgotten workout made it worse. The active workout lives only in `localStorage` until it is
finished, there is no service worker or push, and nothing can run while the app is closed. A
session left on Saturday was still "running" on Monday, with a duration that grew until the user
came back and pressed "Beenden" on a number nobody had trained for.

Two questions followed from asking the user, after 5 hours, whether they are still training.
**What happens when nobody answers?** And **what should an incomplete workout be allowed to
become?** The tempting answer to both is to be gentle: save whatever there is, or keep it as a
recoverable draft. Both keep the rule soft.

## Decision

**A workout is saved only when it is complete — by the user or by the app — and an incomplete one
is discarded, not rescued.**

"Complete" is one pure function, `checkWorkoutCompleteness`: every planned set and added row is
logged or swiped away, every logged working set has RIR, at least one set is logged. The live
"Beenden", past-workout tracking and the outcome below all call it; nothing keeps a second rule.

When the 5-hour prompt (`useForgottenWorkout`) gets no answer within its 5-minute countdown:

- **Complete → saved.** The workout ends at its **last logged set**: `totalDuration` is measured
  from the start to that set, and `localDate` is that set's day. The server decides "today is
  done" from `localDate`, so stamping a Saturday workout with Monday's date would hide Monday's
  recommended workout. A save leaves Blueprints and Vorlagen alone: it carries no
  `overwriteBlueprint` and no `saveAsTemplate*`.
- **Incomplete → discarded**, with a toast the next time the user sees the app.
- **A failed automatic save keeps the draft** and asks again after an hour. A network problem must
  never turn into a lost workout.

The timestamp that starts the 5 hours is its own (`DraftMeta.startedAt`), not the timer's start —
pausing shifts that one forward, and a paused workout is still a forgotten one. The countdown runs
only while the app is on screen and starts over at a full 5 minutes each time it comes back, so a
workout is never settled by a question its owner could not have seen. Tabs of one browser share the
draft, so the outcome is guarded by a claim (Web Locks, with a `localStorage` claim where it is
missing): the tab that wins it settles the workout, the others let go of it.

## Consequences

**Accepted cost: an unanswered, incomplete workout is discarded and cannot be undone.** Someone who
trained for an hour, forgot a set, closed the app and ignored the prompt for five minutes on screen
loses that hour. We take that on deliberately:

- A discarded draft could be kept somewhere recoverable, but then there are two kinds of workout
  with different guarantees, and every consumer of history has to know which it is reading. The
  cost of the rule is a rare, bounded loss; the cost of softening it is a permanent doubt about the
  data.
- Saving it anyway is the old behaviour, and the reason for this decision.
- The prompt says in advance which of the two will happen and that a discard cannot be undone, and
  the countdown only runs while the user is looking, so the loss needs someone to have seen the
  warning and not acted on it.

Keeping a discarded workout as a recoverable draft is left out of #221 and can be added without
changing this rule.

Pausing before the last set counts as workout time in an automatic save: the dedicated start
timestamp does not record pauses, and the result is an estimate for a workout nobody ended.

A draft written before `startedAt` existed falls back to the workout's own creation time, which
pausing never touched.
