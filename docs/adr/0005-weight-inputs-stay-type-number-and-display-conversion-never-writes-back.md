# 5. Weight inputs stay `type="number"`, and display conversion never writes back

Date: 2026-09-21

## Status

Accepted

## Context

Users choose a unit system (`User.unitSystem`, METRIC or IMPERIAL) and every weight in the app
displays in it (#186, part of #176). Storage stays canonical kilograms; `User.height` stays
centimetres; nutrition stays in grams. Conversion is display-only, which raises two questions.

**Which input type?** A German user types `62,5`, an American `62.5`. A `type="text"
inputMode="decimal"` field would hand the raw, locale-dependent string to the 15 `parseFloat`
call sites in the workout flow, and `parseFloat("62,5")` is `62` — a silent truncation. A
`type="number"` field's `.value` is period-normalised by the HTML spec regardless of the user's
locale (and empty for anything unparseable), so every existing `parseFloat` keeps working.

**How is drift avoided?** 1 lb is 0.45359237 kg, so a converted-and-rounded value is not the
value that was stored. Writing displayed values back accumulates error: 100 kg shown as 220 lb
and saved again is 99.79 kg, and five such cycles measured 0.017 kg of drift. Conversion in both
directions is exact only when the value goes through untouched (225 lb stored as 102.05828325 kg
re-reads as exactly 225 lb).

## Decision

**Weight inputs stay `type="number"`.** Localised decimal handling is not reintroduced through
the input type.

**Never write back a value the user did not type.** Form state keeps canonical kg. `WeightInput`
renders that state converted to the user's unit (rounded to 0.5 kg or 1 lb) and calls `onChange`
only when the user types, with the typed number — treated as exact in their own unit — converted
once to kg. Where a form submits a whole record (Profil), `weightToKg` / `heightToCm` take the
stored value as `originalKg` / `originalCm` and return it untouched when the input still shows
what the display of that stored value would have shown. Volume figures convert at the boundary
where analytics payloads enter the page (`volumeAnalyticsForDisplay`).

**`unitSystem` is independent of `locale`.** It is seeded once at registration from the
`Accept-Language` region subtag and never re-derived; a German user in the US wants an English UI
and pounds at the same time.

## Consequences

- Display rounds: a stored 22.25 kg shows as 22.5 kg until edited, but stays 22.25 kg in the
  database. Typed values are kept exactly, so an edited field can show a rounded number after blur.
- Any new weight field must go through `WeightInput` (or `weightToKg` with the stored original),
  never `parseFloat` on a displayed value.
- Registration still asks for weight in kg; the unit system applies from the first login.
- Height converts in the input widget only, to whole inches for imperial users.
