# UI Refactoring Plan – Workout Tracker (shadcn/sera)

**Status:** Aktiv  
**Branch:** `UI-Refactoring`  
**Letztes Update:** April 2026 (ExerciseCard shadcn Migration + Phase 4 Active Workout Vereinfachung)

---

## Ziel

Komplette Migration der Frontend-UI auf **shadcn/ui** mit dem **sera Preset** (Zinc + Tabler Icons + OKLCH Tokens + scharfe Kanten).

Zusätzlich: Wo sinnvoll, nicht nur optische Migration, sondern auch **UX-Verbesserungen** und **Shared Components** schaffen.

---

## Abgeschlossene Phasen (Stand jetzt)

### Phase 0–2: Foundation + Kernseiten
- Design System Setup (Tokens, Dialog, Card, Button, Badge, Field, Tabs, AlertDialog etc.)
- Mobile Navigation (Drawer)
- Login / Register / Profile / Dashboard
- History (List + Detail + Edit)
- DatePicker Komponente

### Phase 3: Cycles + Templates (abgeschlossen)
- **Cycles List** → vollständig modernisiert
- **Templates (Vorlagen)**
  - Tab-Shell (`/templates`)
  - Übungen-Tab (inkl. Filter + Cards)
  - Workout-Vorlagen-Tab (inkl. Cards)
  - **Neue Shared Component**: `ExerciseEditorDialog` (Create + Edit + View/Readonly)
  - Alte Exercise-Modals (`create-`, `edit-`, `view-exercise-modal.tsx`) entfernt

**Phase 3 gilt hiermit als abgeschlossen.**

**Abschlussdatum:** April 2026  
**Zusammenfassung Phase 3:**
- Cycles List vollständig auf shadcn/sera migriert (Cards, Badges, Buttons, AlertDialog, Tabler Icons, semantische Tokens).
- Templates-Bereich (`/templates`) komplett überarbeitet:
  - Tab-Shell modernisiert (shadcn Tabs mit line-Variante).
  - Übungen-Tab: Filter, Cards, Suche → saubere shadcn-Komponenten.
  - Workout-Vorlagen-Tab: Cards, Aktionen, Status-Badges.
- **Neue Shared Component geschaffen**: `ExerciseEditorDialog` (Create + Edit + Readonly/View-Modus).
- Alte dedizierte Exercise-Modals entfernt.
- Starke Fokus auf Wiederverwendbarkeit (die neue Dialog-Komponente wird bereits in Templates und im aktiven Workout verwendet).

Phase 3 wird hiermit offiziell abgeschlossen.

### Phase 4 – Teil 1 + Teil 2 Fortschritt (aktueller Stand)

**Workout Start Screen + Modals (Teil 1) + Active Workout Screen (Teil 2) – visuelle shadcn/sera Migration + architektonische Vereinfachung**

- **Teil 1 (Start Screen)**: Vollständige Modernisierung des `/workout` Einstiegs (Karten, Buttons, Tabler Icons, semantische Tokens). Alle relevanten Modals (GymLocation, PastWorkoutSetup, TemplateSelection, CycleWorkoutSelection) auf shadcn Dialog + Card + Button umgestellt, X-Buttons entfernt wo nicht nötig, Flow für "Vergangenes Workout tracken" klar restrukturiert mit Zurück/Weiter-Schritten. Dunkle/Light-Mode Fixes, Badge-Positionierung, Call-to-Action Buttons auf primary (schwarz).
- **Teil 2 (Active Workout + ExerciseCard)**: 
  - Entfernung der `isExerciseComplete`-Logik (inkl. grüner Ränder) – User: "aus meiner sicht können wir das is exercise complete komplett entfernen. Ich habe eine Idee wie wir das besser darstellen können aber dazu kommen wir später."
  - Entfernung der Live-Unterscheidung "geplant vs. ungeplant" während der Execution (war reines Frontend-Konstrukt, Backend speichert es nicht). 
    - `workout-context.tsx`: States/Handler (`removedPlannedSets`, `unplannedSets`, zugehörige Funktionen) entfernt, Resets gesäubert.
    - `active-workout-screen.tsx`: `areAllSetsLogged` auf "jede Exercise hat mind. einen geloggten Satz" vereinfacht.
    - `exercise-card.tsx`: Keine lokalen unplanned-States mehr; `plannedSets` nur noch für initiale Rows + Defaults.
  - **Visuelle shadcn-Migration der `ExerciseCard`** (1020+ Zeilen → sauber, ~700 Zeilen nach Cleanup):
    - Volle Komposition mit `Card` + `CardContent` (py-0/gap-0 Overrides für dichte Listen-Karten, dnd-kompatibel).
    - Einheitliche Set-Rows: `rounded-md border border-border bg-muted/30` (logged: `bg-card`), keine inneren `rounded-lg`.
    - 100% semantische Tokens + Tabler Icons (keine Hard-Farben, keine Emojis/SVGs).
    - Formulare: `Input` + `Label` + `Button` (ghost/icon/outline).
    - Delete-Confirm: Custom Overlay → `AlertDialog` (destructive Action, keine X-Buttons).
    - "+ Satz hinzufügen" nun **funktional** (lokale `additionalSetNumbers` für Free-Workouts + Extras; uniformes Logging-Modell für planned + additional).
    - Logged-Extras und planned geloggte Sätze einheitlich dargestellt (Badge, Edit/Delete-Buttons, neutraler Check).
  - Weitere Screen-Elemente (Timer, Bottom Bar, Add-Exercise) teilweise schon auf Tokens migriert.
- **Dokumentation**: Dieser Plan fortlaufend aktualisiert mit Entscheidungen, Begründungen (DDD/Flexibilität: historische Daten immutable, plannedSets = load-time only) und detailliertem Stand.
- **Ergebnis**: ExerciseCard bereit für die Extraktion einer shared `WorkoutExercise`-Komponente (geplant: modes execution | editor | review für Live, Template/Cycle-Editor, History-Review).

**Stand:** Phase 4 Teil 2 (visueller + logischer Teil für ExerciseCard + Active) als Meilenstein abgeschlossen. Nächster Fokus: UX-Verfeinerungen + echte Shared Component.

---

## Übergang zu Phase 4

**Phase 3 offiziell abgeschlossen** → April 2026

Ab sofort arbeiten wir in **Phase 4: Workout Screen**.

### Phase 4 – Teil 1: Workout Start Screen (abgeschlossen)

**Abschlussdatum:** April 2026

**Erreichtes:**

- Komplette visuelle und technische Modernisierung des **Workout Start Screens** (`/workout`):
  - Alle Karten, Buttons und UI-Elemente auf shadcn-Komponenten + semantische Tokens umgestellt.
  - Tabler Icons statt Emojis und alter SVGs.
  - Konsistente, ruhige Optik mit scharfen Kanten (sera-Stil).

- Modernisierung und Vereinheitlichung aller relevanten Modals im Start-Flow:
  - **GymLocationModal** → vollständig auf Dialog + semantische Tokens umgestellt.
  - **PastWorkoutSetupModal** → stark vereinfacht und Flow komplett restrukturiert.
  - **TemplateSelectionModal** → moderne Karten-Ansicht mit Filtern.
  - **CycleWorkoutSelectionModal** → moderne Liste mit klarer Hervorhebung von empfohlenen Workouts.

- **Neuer, konsistenter Flow für „Vergangenes Workout tracken“**:
  - Klare Trennung der Schritte: Typ auswählen → (bei Cycle/Template) Auswahl → gemeinsamer „Workout Details“-Schritt (Datum + Dauer) → Gym-Auswahl.
  - Jeder Schritt hat nun explizite **Zurück**- und **Weiter**-Buttons.
  - Bessere mentale Modelle und weniger Verwirrung zwischen „normalem Start“ und „Vergangenes tracken“.

- Technische Verbesserungen:
  - Sauberere State- und Flow-Trennung in `start-screen.tsx`.
  - Vorbereitung auf zukünftige Shared Components durch klarere Trennung der Auswahl-Logiken.

**Fazit:** Der Einstieg in den Workout-Bereich ist jetzt spürbar moderner, konsistenter und benutzerfreundlicher.

---

### Phase 4 – Vorläufige Ziele (weiterhin gültig)
- Analyse des aktuellen Workout-Screens (Start + Active + alle Modals)
- Identifikation von stark duplizierten UI-Patterns → Kandidaten für Shared Components
- shadcn-Migration der relevanten Komponenten
- Gezielte UX-Verbesserungen (nicht nur Optik)
- Erstellung von hochwertigen, wiederverwendbaren Komponenten (z.B. Exercise Selector, Set Logger, Rest Timer Controls, Workout Header etc.)

**Nächster Schritt:** Gemeinsame Priorisierung der nächsten Themen in Phase 4 (voraussichtlich Active Workout Screen + erste Shared Components).

---

### Phase 4 – Teil 2: Active Workout Screen – Vereinfachung der ExerciseCard & Shared Component (laufend)

**Entscheidung (April 2026):**

Die strikte Unterscheidung zwischen **geplanten und ungeplanten Sätzen** während der Live-Ausführung wird weitgehend entfernt.

**Begründung:**
- Das Backend persistiert diese Unterscheidung nicht wirklich (außer als initiale `plannedSets` aus dem Blueprint beim Laden eines Workouts).
- Die gesamte Tracking-Logik (`unplannedSets`, `removedPlannedSets`, komplexe `isExerciseComplete`-Berechnungen etc.) ist ein reines Frontend-Konstrukt für den Live-Modus.
- Für die gewünschte Flexibilität ("der User kann jederzeit alles ändern") bringt diese Unterscheidung während des Trainings mehr kognitiven Overhead als echten Mehrwert.
- Geplante Sätze bleiben relevant **beim Laden** eines Workouts aus einem Blueprint oder einer Vorlage (als initiale Anzeige), aber nicht als laufendes Tracking-Konzept während der Ausführung.

**Auswirkungen auf die Architektur:**
- Die `ExerciseCard` (bzw. zukünftige Shared Komponente) wird dadurch massiv vereinfacht.
- Folgende Logik kann entfernt oder stark reduziert werden:
  - Lokales `unplannedSets`-State-Management
  - `removedPlannedSets` Tracking im Context
  - Große Teile der Completion-Validierung, die zwischen geplant/ungeplant unterscheidet
- Die Shared Component soll in Zukunft folgende Modi unterstützen:
  - Live Execution (Logging von Sätzen)
  - Editor (Template-Erstellung, Cycle Wizard, Blueprint-Bearbeitung)
  - Review (fertiges Workout anschauen / vergangenes Workout nachtragen)

**Nächste Schritte (Phase 4 – Active Workout):**
1. Deep Dive + Dokumentation der aktuellen Logik in `ExerciseCard` und `WorkoutContext`.
2. Entfernen der geplant/ungeplant-Tracking-Logik während der Ausführung.
3. Reines shadcn-Upgrade der äußeren Hülle von `ActiveWorkoutScreen`.
4. Schrittweise Modernisierung und Vereinfachung der `ExerciseCard`.
5. Extraktion einer wiederverwendbaren `WorkoutExercise`-Komponente (mit Modus-Unterscheidung).

---

**Umsetzung Stand (April 2026):**

- `isExerciseComplete` Logik (inkl. grüner Rand um komplette Exercises) komplett entfernt (User: "aus meiner sicht können wir das is exercise complete komplett entfernen. Ich habe eine Idee wie wir das besser darstellen können aber dazu kommen wir später.").
- Live-Unterscheidung "geplant vs ungeplant" während Execution entfernt:
  - Entfernt aus `WorkoutContext` Interface + State + Handler (removedPlannedSets, unplannedSets, zugehörige add/remove/mark-Funktionen).
  - `active-workout-screen.tsx`: `areAllSetsLogged` stark vereinfacht (jede Exercise hat ≥1 geloggten Satz).
  - `exercise-card.tsx`: Kein lokales unplanned State/Handling mehr; `plannedSets` dienen nur noch als initiale Vorschau/Defaults beim Rendern der Zeilen.
- Visuelle shadcn/sera Migration der `ExerciseCard` durchgeführt (nach der logischen Vereinfachung):
  - Imports: Card/CardContent/CardHeader, Button, Badge, Input, Label, AlertDialog*, Tabler Icons (keine Emojis/SVGs mehr).
  - Äußere Struktur: `<Card className="py-0 gap-0 ...">` + `<CardContent className="p-4 ...">` (dichte Karten für Liste, dnd kompatibel).
  - Set-Rows: einheitlich `rounded-md border border-border bg-muted/30` (bzw. bg-card für geloggte), keine rounded-lg auf inneren Containern.
  - Keine hardcodierten Farben (kein green-*/blue-600/gray-700/text-gray-900 etc.); durchgehend semantic tokens (`text-foreground`, `text-muted-foreground`, `bg-card`, `bg-muted/30`, `border-border`, `text-destructive`).
  - Formulare: alle `<input>`, `<label>`, raw `<button>` durch shadcn `Input`/`Label`/`Button` (variant default/outline/ghost, size sm/icon) ersetzt.
  - Delete-Confirm: von custom fixed-overlay auf `<AlertDialog>` migriert (mit `AlertDialogAction` destructive, Cancel, keine X-Buttons).
  - "Satz hinzufügen": funktional gemacht über lokalen `additionalSetNumbers` + Edit-State (ermöglicht freie + extra Sätze bei geplanten Blueprints, uniformes Logging-Modell).
  - Zusätzliche geloggte Sätze (Extras oder komplett freie Übungen) werden jetzt korrekt als geloggte Zeilen mit Edit/Delete angezeigt.
  - Badge + IconCheck für Status (neutral statt grün, da Complete-Visual später neu).
- Context + Card bereinigt, sodass keine toten Referenzen auf entfernte unplanned-Logik mehr existieren.
- Dokumentation (dieses File + implizit im Code) aktualisiert.

**Nächstes (laut User):** Nach dieser visuellen Migration UX-Verfeinerungen + echte Shared `WorkoutExercise` Komponente (modes: execution | editor | review) für Live + Cycle-Wizard + History-Review + Templates.

---

**Ergebnis:** ExerciseCard ist nun visuell konsistent mit sera (Tabler, sharp, semantic, Card-basiert), logisch stark vereinfacht und bereit für Extraktion/Sharing.

**Status:** Visuelle shadcn-Migration der ExerciseCard abgeschlossen (inkl. notwendiger Logik-Cleanup für additional sets + Context-Säuberung). ESLint clean, TS clean (keine neuen Fehler).

---

### Phase 4 – Teil 2 abgeschlossen (visueller Teil + Vereinfachung)

Nächste Arbeit (nicht in diesem Schritt): UX-Feinschliff + Design/Implementierung der shared WorkoutExercise Komponente (mode-basiert) die dann in active, history review, template editor, cycle wizard verwendet wird.

---

### Phase 4 – Vorläufige Ziele (weiterhin gültig)

---

## Geplante zukünftige Phasen (angepasst)

### Phase 4: Workout Screen (nächste große Phase)
**Priorität: Hoch**

- Erstellung weiterer **Shared Components** speziell für den aktiven Workout-Screen
- Nicht nur reine shadcn-Migration, sondern gezielte **UX-Verbesserungen**
- Mögliche Themen (Beispiele):
  - Exercise Selection Flow (bessere Suche/Filter/Erstellung)
  - Set Logging UI (schnelleres Eintragen, bessere visuelle Rückmeldung)
  - Rest Timer (verbesserte Darstellung + Bedienung)
  - Workout Navigation / Übersicht während des Trainings
  - Bessere mobile Interaktionen (Swipe, Quick-Actions etc.)

**Ziel:** Der Workout-Screen soll nicht nur "schön" sondern spürbar angenehmer zu bedienen sein.

### Phase 5: Analytics + Cycle Detail
- Vollständige Überarbeitung der Analytics-Seite
- Überarbeitung der Cycle-Detailseite (inkl. der geteilten Chart- und Filter-Komponenten)
- Nutzung der in Phase 4/5 geschaffenen Shared Analytics-Komponenten

**Vorteil dieser Reihenfolge:** Die komplexen Chart- und Filter-Patterns werden einmal sauber als Shared Components gebaut und dann konsistent in Analytics + Cycle Detail verwendet.

---

## Spätere / Unveränderte Phasen (bleiben bestehen)

- Weitere Pages / Flows (falls noch nicht abgedeckt)
- Template Editor / Cycle Wizard (tiefere Modernisierung)
- Allgemeines Polishing & Konsistenz-Checks
- Performance- und Accessibility-Optimierungen
- Finale Design-System-Härtung

---

## Begründung der Anpassung

- Der **Workout Screen** ist der am häufigsten genutzte Bereich der App. Hier lohnt sich der Aufwand für echte UX-Verbesserungen am meisten.
- Die **Analytics-Thematik** ist relativ komplex und teilt sich Komponenten mit der Cycle Detailseite. Eine dedizierte spätere Phase vermeidet doppelte Arbeit.
- Templates + Cycles List als Abschluss von Phase 3 ist sauber und gibt ein gutes Erfolgserlebnis.

---

## Nächste Schritte (Stand jetzt)

1. Phase 3 offiziell als abgeschlossen markieren (erledigt)
2. Phase 4 detailliert planen (Workout Screen Shared Components + UX Ideen)
3. Mit der Umsetzung von Phase 4 beginnen (Teil 1 + visuelle + logische Teil 2 für ExerciseCard bereits umgesetzt – siehe oben)

**Aktueller Fokus nach diesem Commit:**
- UX-Verfeinerungen am Workout-Screen
- Extraktion der shared `WorkoutExercise` Komponente (modes)

---

**Hinweis:** Dieses Dokument ersetzt frühere informelle Phasen-Planungen aus dem Chat und dient als zentrale Referenz für den UI-Refactoring-Fortschritt.