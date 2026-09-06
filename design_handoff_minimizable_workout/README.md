# Handoff: Minimizable Active Workout

## Overview
Adds the ability to minimize an in-progress workout so the user can navigate the rest of
the app while the session keeps running. Two new surfaces:

1. A **grab handle** at the top of the active workout screen. Dragging it down (or tapping it)
   pushes the workout screen off the bottom of the viewport.
2. A **minimized workout bar** pinned to the bottom of every other screen. Tapping anywhere on it
   brings the workout back.

Covers GitHub issue #128 (visual design for the two new surfaces).

## About the Design Files
The file in this bundle is a **design reference created in HTML** — a prototype showing intended
look and behavior, not production code to copy directly. The task is to **recreate it inside
`apps/frontend`** using that app's existing environment: Next.js + React, Tailwind v4 with the
tokens in `app/globals.css`, the shadcn components in `components/ui/`, and `@tabler/icons-react`.
Do not port the inline styles — they exist only because the prototype has no Tailwind build.
Every value in this document was lifted from the real source files, so each one maps back to an
existing Tailwind class or CSS variable.

## Fidelity
**High-fidelity.** All surrounding chrome (active workout screen, dashboard, Menü drawer, Verlauf
list, app header) was recreated pixel-for-pixel from the current source, so the two new surfaces
can be judged in situ. Recreate the new surfaces exactly; leave the existing chrome untouched.

## Screens / Views

### 1. Active workout — with grab handle
File reference: `components/workout/active-workout-screen.tsx`

The only change is a new strip inserted **above** the existing sticky header
(the `bg-card border-b sticky top-0 z-10` div), as the first child of the screen.

**Grab handle strip**
- Container: full width, height `28px` (`h-7`), flex, centered both axes,
  `cursor-grab active:cursor-grabbing`, `touch-action: none`, background = page background.
- Bar: width `72px`, height `4px`, `border-radius: 1px` (`rounded-[1px]`),
  background `var(--muted-foreground)` at 30% (`bg-muted-foreground/30`).
- Deliberately **not a chevron**. The 4px / `rounded-[1px]` bar is the same visual language as the
  collapsed set-progress indicators in `exercise-card.tsx` (`h-[2.5px] rounded-[1px] w-4`),
  one notch heavier so it reads as grabbable. It sits on its own row, so it never competes with
  the `text-2xl font-bold` workout title beside it.
- While dragging: bar widens to `96px` and darkens to `bg-muted-foreground/75`.
  Transition `background 120ms, width 120ms`.
- Hit target is the whole 28px strip plus the full screen width — comfortably past 44px once the
  header row below it is included in the drag gesture (see Interactions).

### 2. Mid-drag
- The workout screen translates on `transform: translateY(dragY)`, clamped to `>= 0`.
- At `dragY > 0` the sheet takes `border-radius: 16px 16px 0 0` and
  `box-shadow: 0 -16px 44px -8px oklch(0.141 0.005 285.823 / 0.32)`.
- The screen underneath (whatever route the user was last on, default `/dashboard`) is visible and
  covered by a scrim: `oklch(0.141 0.005 285.823 / 0.12)` in light,
  `oklch(0 0 0 / 0.35)` in dark.

### 3. Minimized workout bar
Pinned bottom: `fixed bottom-0 left-0 right-0`, above page content, below the drawer overlay
(see note in Interactions). Square corners (`rounded-none`), matching the app's button/card style.

- Background `var(--primary)`, text `var(--primary-foreground)`.
  Light: `oklch(0.21 0.006 285.885)` on `oklch(0.985 0 0)`.
  Dark: `oklch(0.92 0.004 286.32)` on `oklch(0.21 0.006 285.885)` — i.e. it inverts with the
  theme exactly like a default `<Button>`.
- **Pull-up handle row**: height `20px` (`h-5`), flex centered, containing a
  `72px x 4px`, `rounded-[1px]` bar at `primary-foreground / 35%`. Same handle language, inverted.
- **Content row**: `padding: 2px 16px 18px`, `display:flex`, `align-items:center`,
  `justify-content:space-between`, `gap:12px`.
  - Left column, `min-width:0`:
    - Workout name — `Oxanium 600 14px / 1.2`. Source: `activeWorkout.workoutDayName`
      (fallback `originTemplateName`, then `'Workout'` / `'Freies Workout'`), same expression the
      active workout `<h1>` already uses. Example: "Legs".
    - Current exercise — `Oxanium 400 12px / 1.3`, `opacity: 0.65` (light) / `0.7` (dark),
      `white-space:nowrap; overflow:hidden; text-overflow:ellipsis`.
      Format `#{index} {exerciseName}`. Example: "#3 Kurzhantel Bulgarian Split Squat".
      "Current" = the last exercise with a logged set, else the first exercise with none.
  - Right, `flex-shrink:0`: **rest timer chip**, rendered only while the rest timer is running.
    An inverted `RestTimerDisplay`: `padding: 6px 12px`, `border-radius: 10px` (`rounded-lg`),
    background `var(--primary-foreground)`, text `var(--primary)`.
    Contains "Pause" (`Oxanium 500 12px`) and the time (`Oxanium 700 18px`, `tabular-nums`).
    Overtime should keep `RestTimerDisplay`'s existing `destructive` treatment.
- Total bar height: **72px** with no chip; the chip fits inside that.
- Every page that can show the bar needs `padding-bottom: 96px` (`pb-24`) on its scroll container
  so the last card clears the bar.
- Deliberately excluded from the bar: duration, pause/play, "Beenden", and any chevron.
  The bar is a return affordance, not a second control surface.

### 4. Menü drawer with the bar visible
File reference: `components/mobile-nav.tsx`, `components/ui/drawer.tsx`
- The vaul drawer sheet is offset up by the bar height: its bottom edge sits at `72px`, not `0`.
- The workout bar stays fully visible below the drawer, above the `bg-black/20 backdrop-blur-sm`
  overlay, so the running session is never hidden by navigation.
- Drawer content is unchanged.

### 5. Any other route (Verlauf shown)
File reference: `app/history/page.tsx`
- No change beyond the bottom padding. Included in the mock to confirm the bar reads correctly
  over a dense list.

## Interactions & Behavior

**Minimize**
- `pointerdown` on the handle strip (and, recommended, on the header row) starts the gesture;
  record `startY`.
- `pointermove` on `window`: `dragY = Math.max(0, e.clientY - startY)`. Follow the finger 1:1,
  no transition while dragging.
- `pointerup` on `window`: commit if `dragY > 110`, else spring back to `0`.
  A downward flick faster than ~0.5 px/ms should also commit regardless of distance.
- Commit animates to `translateY(100%)` with `transform 320ms cubic-bezier(0.32, 0.72, 0, 1)`.
- Tapping the handle without dragging also minimizes.
- Swipe **up** on the handle does nothing (the screen is already up).

**Expand**
- Tap anywhere on the minimized bar, or swipe up on it. The whole bar is the target.
- Same 320ms curve, reversed. Restore the workout screen's previous scroll position.
- The bar cannot be dismissed by swiping down — the only ways out of a workout stay
  "Workout beenden" and "Verwerfen" inside the full screen.

**Navigation while minimized**
- The app header and Menü return in full. This requires a change to `mobile-nav.tsx`, which
  currently bails out entirely:
  ```
  pathname?.startsWith('/workout') || (activeWorkout && !isHistoryEdit)
  ```
  That guard must become conditional on the workout being *expanded*, e.g.
  `(activeWorkout && !isHistoryEdit && !isWorkoutMinimized)`. Without it the nav is hidden and
  minimizing achieves nothing.
- Minimizing should route the user to their previous route, or `/dashboard` on first minimize.

**Timers**
- Workout duration and rest timer keep running while minimized; nothing pauses.
- The existing pause state is respected — if paused before minimizing, it stays paused.

**Reduced motion**
- With `prefers-reduced-motion: reduce`, skip the translate animation and cross-fade instead.

## State Management
Lives in `lib/workout-context.tsx` alongside `activeWorkout`:
- `isWorkoutMinimized: boolean` — persisted (same mechanism as the existing active workout
  persistence) so a reload doesn't resurrect a full-screen workout unexpectedly.
- `minimizeWorkout(): void`, `expandWorkout(): void`.
- `lastNonWorkoutRoute: string` — where to land on minimize.
- Drag position (`dragY`, `isDragging`) is local component state, not context.
- Reset `isWorkoutMinimized` to `false` in `completeWorkout` and `discardWorkout`.
- No new data fetching.

## Design Tokens
All from `app/globals.css`. Use the CSS variables / Tailwind tokens, not the literals.

| Token | Light | Dark |
| --- | --- | --- |
| `--background` | `oklch(1 0 0)` | `oklch(0.141 0.005 285.823)` |
| `--foreground` | `oklch(0.141 0.005 285.823)` | `oklch(0.985 0 0)` |
| `--card` | `oklch(1 0 0)` | `oklch(0.21 0.006 285.885)` |
| `--popover` | `oklch(1 0 0)` | `oklch(0.21 0.006 285.885)` |
| `--primary` | `oklch(0.21 0.006 285.885)` | `oklch(0.92 0.004 286.32)` |
| `--primary-foreground` | `oklch(0.985 0 0)` | `oklch(0.21 0.006 285.885)` |
| `--muted` | `oklch(0.967 0.001 286.375)` | `oklch(0.274 0.006 286.033)` |
| `--muted-foreground` | `oklch(0.552 0.016 285.938)` | `oklch(0.705 0.015 286.067)` |
| `--border` | `oklch(0.92 0.004 286.32)` | `oklch(1 0 0 / 10%)` |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` |

- Radius: `--radius: 0.625rem` → `rounded-lg` = 10px, `rounded-md` = 8px, `rounded-sm` = 6px.
  The handles use a literal `rounded-[1px]`; the bar itself is `rounded-none`.
- Spacing used by the new surfaces: 2, 4, 8, 12, 16, 18, 20, 28, 72, 96 px.
- Type: **Oxanium** (`--font-sans`, weights 400/500/600/700), loaded in `app/layout.tsx`.
  Sizes in the new surfaces: 12px (`text-xs`), 14px (`text-sm`), 18px (`text-lg`).
- Motion: `320ms cubic-bezier(0.32, 0.72, 0, 1)` for the sheet;
  `120ms` linear for the handle's own width/color feedback.
- Drag commit threshold: `110px`.

## Assets
No new assets. Icons are `@tabler/icons-react`, already a dependency — the prototype substitutes
the `@tabler/icons-webfont` build purely so it can run without a bundler. Icons appearing in the
recreated chrome: `IconMenu2`, `IconHome`, `IconBarbell`, `IconRefresh`, `IconListCheck`,
`IconHistory`, `IconChartBar`, `IconLogout`, `IconTrash`, `IconArrowsUpDown`, `IconPlus`,
`IconPlayerPause`, `IconTrendingUp`, `IconCalendar`, `IconClock`, `IconList`.
The new surfaces use **no icons at all**.

## Files
- `Minimizable Workout.dc.html` — the prototype. Ten phone frames at 393x852:
  turn **2a** is the dark-mode set (active workout, mid-drag, minimized dashboard, minimized with
  Menü open, minimized Verlauf); turn **1a** below it is the same five in light mode, and its
  first frame is **live** — drag or click the grab handle to minimize, click the bar to expand.
- `support.js` — runtime needed for the prototype to open in a browser. Not part of the design.

## Source files the recreation was based on
`app/globals.css`, `app/layout.tsx`, `app/dashboard/page.tsx`, `app/history/page.tsx`,
`app/workout/page.tsx`, `components/mobile-nav.tsx`,
`components/workout/active-workout-screen.tsx`, `components/workout/exercise-card.tsx`,
`components/workout/workout-timer.tsx`, `components/workout/rest-timer-display.tsx`,
`components/CircularProgress.tsx`, `components/TrendIndicator.tsx`,
`components/ui/{button,card,badge,drawer,toggle,toggle-group}.tsx`.
Repo: `n1k0blc/Workout-Tracker@main`, subtree `apps/frontend`.
