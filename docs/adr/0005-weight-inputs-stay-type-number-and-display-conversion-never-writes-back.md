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
renders that state converted to the user's unit (to the three decimals a weight can be typed
with; body weight to one) and calls `onChange`
only when the user types, with the typed number — treated as exact in their own unit — converted
once to kg. Where a form submits a whole record (Profil), `weightToKg` / `heightToCm` take the
stored value as `originalKg` / `originalCm` and return it untouched when the input still shows
what the display of that stored value would have shown. Volume figures convert at the boundary
where analytics payloads enter the page (`volumeAnalyticsForDisplay`).

**`unitSystem` is independent of `locale`.** It is seeded once at registration from the
`Accept-Language` region subtag and never re-derived; a German user in the US wants an English UI
and pounds at the same time.

## Consequences

- Display keeps what was typed: 27,25 kg stays 27.25 kg and 60.5 lb stays 60.5 lb after blur.
  Display used to round to 0.5 kg or 1 lb, which showed a typed 27.25 kg as 27.5 and a typed
  60.5 lb as 61; that was dropped (amended 2026-11-02) because the field then disagreed with
  what the user entered. The cost is a value entered in the other unit: a 100 kg set shows as
  220.462 lb to an imperial user. The stored kg is untouched either way.
- Any new weight field must go through `WeightInput` (or `weightToKg` with the stored original),
  never `parseFloat` on a displayed value.
- Registration still asks for weight in kg; the unit system applies from the first login.
- Height converts in the input widget only, to whole inches for imperial users.
