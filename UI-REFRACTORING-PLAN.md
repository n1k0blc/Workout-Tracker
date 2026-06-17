# UI Refactoring Plan – Workout Tracker (shadcn/sera)

**Status:** Aktiv  
**Branch:** `UI-Refactoring`  
**Letztes Update:** Mai 2026 (Ansatz B abgeschlossen: ExerciseCard als primäre zentrale Komponente validiert und dokumentiert. Alle Haupt-Flows (Active, History-Edit, Custom-Template-Edit, System-Template-Readonly-View) nutzen die eine `exercise-card.tsx` via Props-API + readonly. Legacy-Duplikation in Cycles notiert.)

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

**Stand:** Phase 4 Teil 2 (ExerciseCard + Active Workout UX inkl. Swipe/Table/Indicators, Fixes + Exercise Add Overlay shadcn Migration + neuer großer zentrierter + Icon Trigger) als Meilenstein abgeschlossen. Nächster Fokus: Shared WorkoutExercise Komponente (modes execution/editor/review).

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

**Nachtrag (UI-Alignment):** Die "Vorgeschlagenes Workout"-Card wurde an die Standard-Card-Struktur angepasst (gleiches flex + Icon + h2 + p + Button-Pattern wie Free/Template/Cycle/Past-Cards). Kein CardHeader/CardTitle mehr (vermeidet uppercase via CSS), Icon hinzugefügt (IconTarget), Titel in normaler Schreibweise.

**Mobile-Fix:** Allen Karten-Icons `flex-shrink-0` und den `.flex-1`-Containern `min-w-0` hinzugefügt. Verhindert, dass bei schmalen Mobile-Viewports der Icon "verschwindet" (durch Content mit hoher min-width wie lange Set-Texte in der Suggested-Liste geclippt oder aus dem Flow gedrängt wird).

**Phase 4 – Workout Screen (visuelle + UX Migration) als abgeschlossen markiert.**

**Zusammenfassung des abgeschlossenen Schritts (April 2026):**
- Workout Start Screen: Vollständige shadcn/sera-Migration aller Cards (inkl. Alignment der "Vorgeschlagenes Workout"-Card mit Icon + normaler Typografie), Modals (Gym, Past, Template, Cycle), Flows (Vergangenes tracken mit Steps + Zurück/Weiter).
- Active Workout Screen + ExerciseCard: Tiefe Refactoring (Entfernung isExerciseComplete + geplant/ungeplant Tracking, Long-Press Drag, Tap-to-Collapse, Table-Layout für Sets, LTR/RTL Swipe für Log/Delete, Collapsed Horizontal Bars, immer editierbare Inputs nach Log, etc.).
- Completion Flow: Completion Confirmation (Blueprint + Save-as-Template), WorkoutCompletionModal (Slideshow mit Stats, Confetti, PRs) und Save-Template-Input vollständig auf shadcn migriert + poliert (inkl. a11y, Icons, Farben, Mobile-Fixes).
- Alle Entry-Points (vorgeschlagen, frei, Vorlage, Zyklus, Vergangenes) nutzen nun einheitliche UI-Patterns.
- Konsistenz: Tabler Icons, semantische Tokens, scharfe Ecken (sera), Card-Composition, keine Hard-Farben.
- Bugfixes & Polish währenddessen: CORS/Dev für Mobile-Testing, diverse kleine Fixes.
- Tests/Lint: eslint --max-warnings=0 + tsc clean nach jedem relevanten Schritt, Commits/Pushes regelmäßig.

Der Workout Screen (Start + Active + Completion) ist nun visuell und UX-technisch auf dem gewünschten Niveau und bereit für die Extraktion als wiederverwendbare Komponente.

---

### Phase 4 – Vorläufige Ziele (weiterhin gültig)
- Analyse des aktuellen Workout-Screens (Start + Active + alle Modals)
- Identifikation von stark duplizierten UI-Patterns → Kandidaten für Shared Components
- shadcn-Migration der relevanten Komponenten
- Gezielte UX-Verbesserungen (nicht nur Optik)
- Erstellung von hochwertigen, wiederverwendbaren Komponenten (z.B. Exercise Selector, Set Logger, Rest Timer Controls, Workout Header etc.)

**Nächster Schritt:** Phase 4 – Teil 3: Extraktion Shared Components für einheitlichen Workout Screen / WorkoutExercise mit Modi (siehe neuen Abschnitt unten). User hat den UI/UX-Teil des Workout Screens als abgeschlossen betrachtet.

**History Integration (dieser Schritt):**
- In der History-Liste (app/history/page.tsx): Entfernt den separaten "Bearbeiten"-Button (IconEdit).
- Der Klick auf ein Workout-Card geht nun direkt auf die Edit-Seite (/history/[id]/edit).
- Die History-Edit-Seite (app/history/[id]/edit/page.tsx) nutzt jetzt die zentrale Komponente <ActiveWorkoutScreen mode="edit" showBottomBar={false} /> (nach setActiveWorkoutDirectly im Context).
- Die Edit-Seite behält den eigenen Header (Titel, Datum-Picker) und eigenen Save-Button (der die aktuellen Daten aus dem Context/activeWorkout für updateCompletedWorkout nutzt).
- Dadurch wird die einheitliche Edit-UI (ohne Log-Spalte, mit voller Add/Reorder/Replace/Add-Set Funktionalität) für History-Edit verwendet.
- Die alte custom per-Set Form wurde durch die zentrale Komponente ersetzt.

**Erster Schritt der Shared Komponente (dieser Commit):**
- Zentrale Komponente `ActiveWorkoutScreen` (zukünftig `WorkoutScreen`) erweitert um `mode?: 'active' | 'edit'`.
- `ExerciseCard` unterstützt jetzt `mode`, im 'edit' Modus wird die Checkhaken-Spalte (Logging) komplett entfernt (Grid auf 4 Spalten, keine Log-Buttons/Swipes für Log).
- Für den Einstiegspunkt "Vergangenes Workout tracken" wird nun explizit `mode="edit"` verwendet (kein Live-Timer, stattdessen Dauer-Input wie bisher; keine Logging-UI).
- Timer (Workout + Rest + Pause) nur im 'active' Modus (bzw. !isPast).
- Alle anderen Funktionen (Add/Remove/Reorder/Replace, Edit Sets, Swipe für Delete bei ungeloggten in active, Additional Sets, etc.) bleiben gleich.
- Vorbereitung für zukünftige Nutzung in Template-Editor, Cycle Wizard, History Edit (dort wird der parent die Daten/Callbacks liefern, die Komponente rendert die einheitliche Ansicht im edit Modus).

**Technical Debt: Vollständige Shared-Component-Features für abgeschlossene Workouts (April 2026)**

- Im Zuge der "stück für stück" Integration der zentralen Workout-Screen-Komponente wurde die History-Edit-Seite (`/history/[id]/edit`) auf `<ActiveWorkoutScreen mode="edit" />` umgestellt. Dadurch stehen für das Bearbeiten abgeschlossener Workouts bereits viele Features der Shared Component zur Verfügung (Sets editieren, Additional Sets, Add/Remove Exercises, Replace, Reorder etc. in der UI).
- **Workaround im WorkoutContext (`lib/workout-context.tsx`)**: Alle relevanten Mutations-Funktionen (`logSet`, `updateSet`, `deleteSet`, `addAdditionalSet`, `addExercise`, `removeExercise`, `replaceExercise`, `reorderExercises` etc.) prüfen frühzeitig, ob `activeWorkout.status === 'COMPLETED' || 'DISCARDED'`. In diesem Fall wird **kein** API-Call ausgeführt, sondern ein lokales Deep-Clone + Patch auf dem In-Memory-Objekt via `setActiveWorkout(cloned)` durchgeführt. Die Edit-Seite persistiert dann beim "Speichern" über einen dedizierten `updateCompletedWorkout`-Pfad.
- Dies ermöglicht aktuell, dass die Shared Component ohne Blocker für History-Edits genutzt werden kann (insbesondere Set-Werte immer editierbar + strukturelle Änderungen in der lokalen UI-Repräsentation).
- **Limitation**: Das Backend erlaubt derzeit keine (oder nur sehr eingeschränkte) strukturellen Mutationen an bereits abgeschlossenen oder verworfenen Workouts. Viele der vollen Features der Shared Component (Übungen ersetzen, Reihenfolge ändern, Übungen hinzufügen/entfernen beim Editieren historischer Sessions) können **nicht** serverseitig persistiert werden. Die lokalen In-Memory-Änderungen sind rein temporär und würden bei Reload/Neuladen verloren gehen, wenn nicht explizit gespeichert wird – und selbst dann ist die volle Feature-Menge für Completed-Workouts backend-seitig (noch) nicht vorgesehen.
- **Grund**: Historische Daten sind per Design weitgehend immutable (siehe Projekt-Philosophie). Die aktuelle API und das Datenmodell für `Workout` + `ExerciseLog` + `SetLog` sind primär auf "laufende Sessions" und "immutable Performed History" ausgelegt. Ein nachträgliches Umschreiben der Übungsliste + Reihenfolge + Sätze eines abgeschlossenen Workouts war bisher nicht Teil der Anforderungen.
- **Plan**: Nach Abschluss des UI-Refactorings wird ein dediziertes **Backend-Refactoring** durchgeführt. Ziel ist es, dass abgeschlossene Workouts die **vollen Mutations-Features der Shared Component** unterstützen (Übungen ersetzen, Reihenfolge ändern, Hinzufügen/Entfernen von Übungen, etc. beim Bearbeiten in der History/Edit-Ansicht), ohne die Unveränderlichkeit der tatsächlichen historischen Logs zu verletzen (vermutlich über ein separates "performed snapshot" / Revision-Modell oder erweiterte Update-Endpunkte für historische Workout-Sessions).
- **Explizit**: Dieses Backend-Refactoring wird **nicht jetzt** umgesetzt. Die aktuelle lokale In-Memory-Hack-Lösung ist bewusst als temporärer Technical Debt dokumentiert, um die schrittweise Einführung der zentralen Shared Component (Workout Screen mit active/edit-Modi) nicht zu blockieren.

  (Zusatz Mai 2026 aus User-Feedback zu Templates:) Nachdem wir sets in der Synthetic pre-filled hatten (für Save-Validierung), waren Replace-Exercise und Set-Delete (Swipe) deaktiviert oder wirkungslos, weil die Card "logged sets" Guards aktiviert hat (sets.length >0 → replace disabled; Swipe-Delete nur !logged; planned-discard nur UI-skip). 
  Gelöst durch: Zurück zu sets:[] + planned für Templates (UI sieht unlogged planned → Guards relaxed), plus Card-spezifische isTemplateSynthetic (id-Prefix) Checks die Guards lockern und in discardUnloggedSet echte Mutation der plannedSets/sets via setActiveWorkoutDirectly machen. Auch das ist reiner Bridge-Debt (kein Backend). Die "immutable logged" Logik passt nicht zu editable Blueprints. Wird sauberer mit dediziertem Editor-Modus.

**Zusätzliche Symptom des Debt (Templates-Bridge, Mai 2026):**
- Beim Bearbeiten bestehender Vorlagen (die bereits Sätze haben) schlug die Client-Validierung im `TemplateEditorScreen.handleSave` ("Jede Übung muss mindestens einen Satz haben") fehl, obwohl die Daten vorhanden waren.
- Ursache: Die synthetischen ExerciseLogs werden mit `sets: []` + `plannedSets: [...]` initialisiert. Die Auto-Commit-Logik im `ExerciseCard` (Edit-Mode, `useEffect` + `setTimeout(0)` + `handleLogSet`) hat harte Annahmen (`if (w > 0 && r > 0)` aus dem aktiven Workout-Kontext) und ist asynchron. Dadurch ist `ex.sets.length === 0` beim sofortigen Klick auf "Speichern" noch der Fall. Manuelles Hinzufügen eines Satzes triggert direkte Context-Mutation → funktioniert dann.
- Workaround implementiert: In `buildSyntheticWorkout` werden für geladene Templates die Target-Sets **sofort als `sets` (SetLog-Shape) vorgefüllt**. Die Card-Logik (`!getLoggedSet`) skippt dann das Re-Commit. Zusätzlich defensiv die Validierung so angepasst, dass sie auch `plannedSets` berücksichtigt.
- Das ist ein klassisches Symptom der "Misuse" des Performed-Workout-Modells (Logging-Semantik, Deferred-Commits, Guards für reale Sätze) für pure Planned/Blueprint-Editing. Kein Backend-Problem (die Validierung ist rein client-seitig vor dem API-Call; das Template-Backend akzeptiert das Payload). Wird mit dem zukünftigen dedizierten Editor-Modus / besserer Entkopplung der Shared Component sauberer. Bis dahin als Teil des bekannten Technical Debt mitgenommen.

**Wichtige Reflektion (User-Request Mai 2026):** Wir haben inzwischen spürbar individuelle Logik eingebaut (`isTemplateSynthetic` per ID-Prefix, unterschiedliches Seeding von sets vs. plannedSets, entspannte Guards nur für Templates, separate Cleanup-Effekte, etc.). Das widerspricht dem ursprünglichen Ziel einer **einzelnen zentralen Komponente** mit sauberen Modi (`active` für Live-Session mit Timern/Logging, `edit` für volles strukturelles + wertbasiertes Editieren von Plänen oder vergangenen Sessions).

Die zentrale Komponente existiert (`ActiveWorkoutScreen` + `ExerciseCard` mit `mode`), aber der State-Layer (`WorkoutContext` + interne Card-States wie `additionalSetNumbers`, `skippedPlannedSetNumbers`, "logged vs. planned") ist stark auf "Ausführung + performed History" ausgelegt. Deshalb mussten wir für Blueprints (Templates) und History-Edit den gleichen Hack + Sonderfälle verwenden.

### Ursprung des lokalen In-Memory-Mutations-Hacks (chronologisch)
1. Die Shared Component (ExerciseCard + Screen) wurde primär für das **aktive Workout** (Logging, Timer, Swipe-to-log, Collapse etc.) gebaut und dann für UX-Verbesserungen verfeinert.
2. Als nächster "stück für stück"-Schritt sollte die Komponente für **History-Edit** von abgeschlossenen Workouts wiederverwendet werden (User-Wunsch: kein separater "Bearbeiten"-Button mehr, direkter Klick auf Karte → zentrale Komponente im edit-Modus).
3. Problem: Das Backend erlaubt (aus Design-Gründen: Immutable History + aktuelle API für ExerciseLog/SetLog) keine oder nur sehr eingeschränkte strukturelle Änderungen an `COMPLETED`/`DISCARDED` Workouts (kein Replace, Reorder, Add/Remove Exercise auf bereits gespeicherten Sessions).
4. Um trotzdem die volle UI (Add/Remove/Reorder/Replace + Edit aller Werte) sofort nutzen zu können, ohne auf ein großes Backend-Refactoring zu warten:
   - `setActiveWorkoutDirectly(realCompletedWorkout)` hijackt den globalen Context.
   - In **allen** Mutations-Funktionen (`logSet`, `updateSet`, `deleteSet`, `addExercise`, `removeExercise`, `replaceExercise`, `reorderExercises`, `addAdditionalSet` ...) wurde ein früher Check eingebaut:
     ```ts
     if (activeWorkout?.status === 'COMPLETED' || activeWorkout?.status === 'DISCARDED') {
       // lokaler Deep-Clone + Patch
       setActiveWorkout(cloned);
       return;   // kein apiClient-Aufruf
     }
     // sonst normaler API-Pfad
     ```
   - Die History-Edit-Seite hat einen eigenen "Speichern"-Button, der den (lokal mutierten) `activeWorkout` aus dem Context nimmt und über einen dedizierten `updateCompletedWorkout`-Endpoint persistiert (der die performed-Daten für diesen historischen Record ersetzt).
5. Als Templates als nächster Einstiegspunkt kamen, wurde exakt derselbe Mechanismus verwendet (synthetisches Objekt mit `status: 'COMPLETED'`, `setActiveWorkoutDirectly`, gleicher Hack). Dadurch kamen die Modell-Konflikte (reine `target*` + `isWarmup` vs. performed `sets` + `plannedSets`, "logged immutable" Guards in der Card) und die weiteren Sonderfälle (`isTemplateSynthetic`).

Der Hack war eine bewusste, dokumentierte Übergangslösung ("Technical Debt"), um die zentrale Komponente schnell an allen Stellen einzusetzen ("wir refactoren ja stück für stück").

### Professionelle Lösung (Ziel: keine Prefix-Hacks, keine Status-Missbrauch für UI-Verhalten)
Wir wollen bei **einer** zentralen Komponente bleiben (`WorkoutScreen` mit `mode: 'active' | 'edit'`), aber saubere Trennung der Konzepte:

- `mode="active"`: Timer, Logging-Column, Swipe-to-log, Pause, "beenden"-Flow, Context ist "Session".
- `mode="edit"`: Keine Timer, keine Logging-Spalte, volle strukturelle Freiheit (Add/Remove/Reorder/Replace + Werte editieren). Der Parent entscheidet, ob es sich um "performed History" (History-Edit) oder "reinen Plan/Blueprint" (Templates, Cycle-Wizard) handelt.

Mögliche saubere Architektur (ohne Workarounds pro Sonderfall):
1. Im `WorkoutContext` einen expliziten Modus/Flag einführen:
   - `editingBlueprint: boolean` (oder allgemeiner `localEditMode: 'performed-history' | 'blueprint' | null`).
   - `setActiveWorkoutDirectly(workout, options?: { isBlueprintEdit?: boolean, isPast?: boolean })`.
   - Die Mutations-Funktionen short-circlen lokal, **wenn** `editingBlueprint || status COMPLETED (für History)` — aber das UI-Verhalten (Guards) wird vom Flag gesteuert, nicht vom Status.
2. Im `ExerciseCard` (und Screen):
   - Statt `isTemplateSynthetic` (ID-Prefix) nur noch `isBlueprintEdit` aus dem Context oder via Prop.
   - "logged" / "immutable after log" Guards nur aktiv, wenn es sich um **performed** Edit handelt (History).
   - Bei Blueprint-Edit: alles ist "Plan", jede Zeile ist editierbar/entfernbar/erset zbar, Swipe-Delete entfernt wirklich aus dem Plan, kein Skip-Mechanismus, keine "unlogged planned" vs. "logged" Unterscheidung für Struktur-Operationen.
3. Die Card-internen States (`additionalSetNumbers`, `skippedPlannedSetNumbers`) bleiben execution-spezifisch. Für Blueprint-Edit mutieren wir direkt die Plan-Daten (über die Context-Mutations, die dann lokal updaten).
4. Templates / Cycle-Wizard wrappen weiterhin (Name, Gym, eigenes Speichern), injizieren aber ein sauberes "Blueprint"-Objekt (nicht mehr als fake-COMPLETED-Workout getarnt, oder mit klarem Flag).
5. Langfristig (nach Backend-Refactoring): Die gleichen Mutations-Endpunkte können für Blueprints und ggf. für Revisionen von History verwendet werden — der Hack fällt dann komplett weg.

Das stellt sicher, dass die **eine** Komponente die zwei Modi sauber unterstützt, ohne dass in der Card oder im Context überall "wenn es ein Template ist..." steht.

(Stand jetzt haben wir die Sonderlogik noch — der User-Request war genau der Anstoß, das sauber zu machen.)

---

## Entscheidung: Ansatz B – ExerciseCard als primäre zentrale Komponente (Mai 2026)

**User-Entscheidung:** Wir drehen die volle Zentralisierung des gesamten Workout-Screens (`ActiveWorkoutScreen` als universelle Komponente für alle Einstiegspunkte) zurück.

**Begründung (User + Analyse):**
- Die umgebenden Belange (Header, Metadaten, Save-Flow, Timer vs. keine Timer, Dnd-Scope, Persistence) sind zu unterschiedlich zwischen aktivem Session, History-Edit (performed) und Blueprint-Edit (Templates/Cycles).
- Die volle Screen-Abstraktion führt zu zu viel Leakage, Context-Hijacking und Sonderlogik (`isBlueprintEdit`, synthetische COMPLETED-Objekte, unterschiedliches Seeding, angepasste Guards).
- Der wirklich wertvolle, komplexe und UX-kritische Teil ist die **ExerciseCard** (Collapse, Swipe, Table-Rows, Edit-State, Action-Buttons, Add-Set, etc.).
- Bessere Trennung: ExerciseCard wird die zentrale, mode-fähige Komponente. Die konkreten Screens (Workout-Page, History-Edit, Template-Editor, Cycle-Wizard) bauen ihre eigene Hülle drumherum und nutzen die Card.

**Ziel-Architektur:**
- `ActiveWorkoutScreen` wird **nur noch** für die aktive Ausführung (/workout Page, inkl. "Vergangenes Workout tracken") verwendet.
- `ExerciseCard` wird zur **zentralen Shared Component** mit klaren Modi / Konfigurations-Flags.
- Jeder Screen ist wieder etwas individueller, aber die schwere, duplizierungsanfällige Logik lebt nur einmal in der Card.

### Gewünschte Verhaltens-Matrix für die zentrale ExerciseCard

| Feature                        | Active (Live) | History Edit (Completed) | Template Editor (Blueprint) |
|--------------------------------|---------------|---------------------------|-----------------------------|
| Collapse / Expand              | Ja            | Ja                        | Ja                          |
| Werte eines Satzes ändern      | Ja            | Ja                        | Ja                          |
| Satz-Typ ändern (Aufwärmen/Arbeit) | Ja         | Ja                        | Ja                          |
| Reorder Exercises (Dnd)        | Ja            | **Nein**                  | Ja                          |
| Exercise löschen               | Ja            | **Nein** (Button weg)     | Ja                          |
| Exercise austauschen (Replace) | Ja            | **Nein** (Button weg)     | Ja                          |
| Sätze hinzufügen               | Ja            | **Nein**                  | Ja                          |
| Sätze löschen                  | Ja (unlogged via Swipe) | **Nein**             | Ja                          |
| Logging (Check-Spalte, Swipe LTR, Log-Button) | Ja     | **Nein** (komplett weg)   | **Nein** (komplett weg)     |
| Swipe RTL (Delete/Discard)     | Ja (bei unlogged) | **Nein**                | Ja (bei allen Sätzen)       |

**Vorgeschlagene API für die zentrale ExerciseCard (empfohlen):**

```ts
interface ExerciseCardProps {
  exercise: ExerciseLog;        // (für Blueprints wird weiterhin gemappt)
  exerciseNumber: number;
  mode?: 'active' | 'edit';     // grundsätzliche Unterscheidung

  // Feingranulare Steuerung für Edit-Varianten (besser als viele Modi)
  allowReorder?: boolean;
  allowExerciseActions?: boolean;   // Replace-Button + Delete-Exercise-Button
  allowSetManagement?: boolean;     // "+ Satz hinzufügen" + Delete pro Satz
  allowLogging?: boolean;           // Check-Spalte + Log-Verhalten + Swipe-Log
}
```

Oder alternativ ein `variant`-Enum:
- `'execution'`
- `'history-edit'`
- `'blueprint-edit'`

Die Props-Variante ist flexibler und vermeidet eine Explosion von Modi.

### Rollback- & Migrations-Plan (stück für stück)

**Phase 1: Klärung & Plan (aktuell)**
- Diese Entscheidung und die Matrix in die UI-REFRACTORING-PLAN.md aufnehmen.
- Keine Code-Änderungen an der Card oder Screens in diesem Schritt.

**Phase 2: Erweiterung der ExerciseCard (zentrale Komponente)**
1. Props der `ExerciseCard` um die Steuerungs-Flags erweitern (`allowReorder`, `allowExerciseActions`, `allowSetManagement`, `allowLogging`).
2. Bestehende `mode` beibehalten (für grundsätzliche Unterschiede wie Check-Spalte).
3. Alle relevanten Stellen bedingt machen:
   - `showCheckColumn` → von `allowLogging`
   - Replace-Button + Delete-Exercise-Button → von `allowExerciseActions`
   - Dnd-Listeners am Header → von `allowReorder` (ansonsten keine Drag-Attributes)
   - "+ Satz hinzufügen" Button + Delete-Buttons pro Satz → von `allowSetManagement`
   - Swipe-Logik (LTR Log, RTL Discard) → entsprechend anpassen (bei History komplett deaktivieren oder auf No-Op)
   - Auto-Commit-Effekt und `additionalSetNumbers` / `skipped...` Logik vorsichtig nur bei erlaubten Features aktivieren.
4. `isBlueprintEdit`-Hack aus der Card entfernen und durch die neuen Props ersetzen.
5. Sicherstellen, dass die Card auch ohne vollen `useWorkout()`-Context sinnvoll genutzt werden kann (für zukünftige Prop-driven Nutzung in Blueprints).

**Phase 3: Rollback der Screen-Zentralisierung**
1. `/workout/page.tsx`: Bleibt bei `<ActiveWorkoutScreen ... />` (wie bisher).
2. `app/history/[id]/edit/page.tsx`:
   - Eigenen Header + Metadaten + Speichern-Button behalten.
   - Statt `<ActiveWorkoutScreen mode="edit" ... />` eine eigene Liste rendern:
     - Kein (oder deaktivierter) DndContext.
     - `<ExerciseCard mode="edit" allowReorder={false} allowExerciseActions={false} allowSetManagement={false} allowLogging={false} ... />` für jede Exercise.
   - Eigenes `onSave` das die aktuellen Werte aus dem Context oder direkt aus den Cards sammelt.
3. `components/templates/template-editor-screen.tsx`:
   - Eigenen Header (Name + empfohlenes Gym) + Speichern-Button.
   - Eigene (oder beibehaltene) Liste mit DndContext (wenn Reorder erlaubt).
   - `<ExerciseCard mode="edit" allowReorder={true} allowExerciseActions={true} allowSetManagement={true} allowLogging={false} ... />`
   - Beim Speichern die Daten aus dem Context (oder zukünftig aus Props) in Template-Payload mappen.
4. `ActiveWorkoutScreen` selbst:
   - Kann intern weiter die Card mit `allow*={true}` und `mode="active"` nutzen.
   - Wird nicht mehr in Templates oder reinen History-Edit-Seiten importiert.
   - Optional: Umbenennen in `ActiveSessionScreen` oder ähnlich, um Klarheit zu schaffen.

**Phase 4: Aufräumen & Debt-Reduktion**
- Entfernen oder Deaktivieren der `blueprintEdit`-Flag-Hacks und `isTemplateSynthetic`-Logik.
- Reduktion der Abhängigkeit der Card vom globalen `WorkoutContext` wo möglich (z. B. Mutations als optionale Props für die Blueprint-Fälle).
- Aktualisierung der Technical-Debt-Dokumentation (der Hack bleibt für History-Edit von Completed, wird aber nicht mehr für Blueprints benötigt).
- Entfernen oder Markieren der alten `TemplateExerciseCard` als deprecated.
- Tests / manuelle Verifikation der drei Szenarien (Active, History-Edit, Template-Edit).

**Phase 5: Zukünftige Nutzung**
- Cycle-Wizard / Blueprint-Schritte können dann ebenfalls die zentrale ExerciseCard mit `allowLogging={false}` + vollen strukturellen Flags nutzen.
- Langfristig: Die Card kann stärker prop-driven werden (Exercises + Callbacks statt Context), sodass Blueprints gar keinen Context-Hijack mehr brauchen.

### Vorteile dieses Ansatzes
- ExerciseCard bleibt die eine Quelle der Wahrheit für das komplexe Verhalten.
- Keine erzwungene Vereinheitlichung von inkompatiblen Domänen (Session vs. Blueprint).
- Weniger Sonderlogik und Hacks.
- Jeder Screen kann sein Datenmodell und seinen Speicherfluss sauber halten.
- Immer noch große Wartbarkeitsgewinne (keine drei verschiedenen Implementierungen der Card-UX).

---

### Validierung & Dokumentation: Zentrale ExerciseCard-Komponente (Mai 2026)

**Validierung (Code-Inspection):**
- **Eine einzige zentrale Komponente**: `apps/frontend/components/workout/exercise-card.tsx` (mit Props-API für Mode + feingranulare Steuerung + readonly).
  - Wird verwendet für **alle relevanten Einstiegspunkte**:
    - Aktives Workout + Past-Tracking: `components/workout/active-workout-screen.tsx` (mode="active", alle allow* true).
    - History-Edit von Completed Workouts: `app/history/[id]/edit/page.tsx` (direkt Cards, mode="edit", alle allow* false – nur Werte/Typ/Collapse).
    - Template-Editor (Custom + System-Vorlagen): `components/templates/template-editor-screen.tsx` (mode="edit"; Custom: allow structural true + allowLogging=false + Handler; System: readonly=true, keine Actions, Inputs disabled/readOnly, Name/Gym static).
    - Benutzerdefinierte Übungen: `components/templates/exercises-tab.tsx` (direkt Cards mit onClick → Edit für Custom; View für System).
    - Vorlagen-Liste: `components/templates/workout-templates-tab.tsx` (Custom + System Cards klickbar → Edit bzw. Readonly-View).
- **Kein Hijack mehr für Blueprints**: Templates/Editor nutzen lokalen State + injizierte `on*`-Handler (Props-driven).
- **Readonly/View für System-Vorlagen** vollständig unterstützt (keine Buttons, keine Editierbarkeit, reiner Display + Collapse).
- **Swipe/Collapse/Type/Value-Edit** zentral in einer Komponente (keine Duplizierung in den Haupt-Flows).
- **Verbleibende Duplikate (niedrige Priorität)**: Cycles (`BlueprintExerciseCard`), Analytics (`SelectedExerciseCard` – reine Anzeige). Alte `template-exercise-card.tsx` deprecated.

**Dokumentierter Stand im Plan:**
- Ansatz B (nur ExerciseCard zentral, individuelle Screens drumherum) ist umgesetzt und validiert.
- Props-API (mode + allowReorder/ExerciseActions/SetManagement/Logging + readonly + Handler) ermöglicht die gesamte Matrix ohne Sonderfälle pro Screen.
- `ActiveWorkoutScreen` ist nicht mehr die universelle "eine Komponente für alles" (wird nur noch für aktive Sessions genutzt).
- Technical Debt (Context-Hijack, Performed-Modell für Pläne) reduziert; zentrale Card ist wartbar und erweiterbar (z. B. für Cycle-Wizard).

**Zusammenfassung Validierung:**
Alles Wesentliche für Exercise Cards (Live-Execution, Blueprint-Edit, History-Edit, Readonly-View für System) lebt in **einer** Komponente. Die UI-Refactoring-Ziele (keine parallelen Implementierungen, einfache Änderungen an einer Stelle, Flexibilität per Props) sind für die Haupt-Flows erreicht. Nächster logischer Schritt: Migration der Cycle-Cards.

(Stand der Codebase: siehe aktuelle Commits auf Branch `UI-Refactoring`.)

Dieser Plan wird nun als verbindliche Richtung in der Dokumentation festgehalten. Implementierung erfolgt schrittweise und nur nach Bestätigung.

---

**Nächste konkrete Schritte nach diesem Plan:**
1. ExerciseCard Props + interne Guards erweitern (saubere, dokumentierte Flags).
2. History-Edit-Seite auf individuelle Card-Nutzung umstellen.
3. Template-Editor analog umstellen.
4. `ActiveWorkoutScreen` auf seinen Kern-Use-Case reduzieren.
5. Debt-Doku und Code-Kommentare aktualisieren.

**User-Bestätigung (Mai 2026):** User hat Ansatz B mit der Props-API für ExerciseCard bestätigt und die Umsetzung freigegeben.

**Umsetzungs-Status:** Erste Implementierung abgeschlossen (ExerciseCard Props-API + Callsite-Updates für History-Edit und Template-Editor). ActiveWorkoutScreen auf seinen primären Use-Case reduziert. Siehe nachfolgende Commits und Todo.

**Nächster Schritt: Integration der Shared Komponente in den Template-Editor (Create + Edit benutzerdefinierter Vorlagen) – April 2026**

**Ziel:**
- Sowohl `/templates/new` (neue Vorlage erstellen) als auch `/templates/[id]/edit` (bestehende benutzerdefinierte Vorlage bearbeiten) sollen die **gleiche zentrale Komponente** (`ActiveWorkoutScreen` mit `mode="edit"`) für die Übungs-/Satz-Liste verwenden.
- Keine separate `TemplateExerciseCard` + lokaler State-Management für die Exercise-Liste mehr (Duplikation vermeiden).
- Alle Edit-Features der Shared Component stehen sofort zur Verfügung: Long-Press Reorder, Tap-to-Collapse mit horizontalen Balken-Indikatoren, Table-Layout für Sätze, immer editierbare Felder, Replace, Delete Exercise, "+ Satz hinzufügen", große zentrierte + Icons für Add Exercise (Empty-State + unter der Liste), volle shadcn/sera Konsistenz.

**Herausforderung & Lösungsansatz (analog zu History-Edit):**
- Die Shared Component + `WorkoutContext` sind primär auf `Workout` + `ExerciseLog` (mit `sets` performed + `plannedSets` Snapshot) ausgelegt.
- Templates verwenden ein separates Modell (`WorkoutTemplateExercise` + `WorkoutTemplateSet` mit reinen `target*` + `isWarmup`).
- **Lösung (stück für stück, unter Nutzung des bestehenden Completed-Hacks):**
  1. Im `TemplateEditorScreen` (der gemeinsame Wrapper für new + edit):
     - Behalte lokale State nur für Metadaten: `name`, `recommendedGymId`, `availableExercises`, `availableGyms`, `loading`/`saving`.
     - Lade bei `templateId` die Vorlage via `apiClient.getWorkoutTemplate`.
     - Konstruiere ein **synthetisches `Workout`-Objekt**:
       - `id`: `'template-' + templateId` oder `'new-template-' + Date.now()`
       - `status: 'COMPLETED'` (aktiviert den lokalen In-Memory-Mutations-Pfad im Context – siehe Technical Debt oben).
       - `isFreeWorkout: true`
       - Für jede Template-Exercise: `ExerciseLog` mit `sets: []` (initial) + `plannedSets: [...]` gemappt aus den TemplateSets (`isWarmup` → `setType: 'WARMUP'|'WORKING'`, `targetReps/Weight/Rir` → `reps/weight/rir`).
     - Rufe `setActiveWorkoutDirectly(syntheticWorkout)` (ähnlich wie in `history/[id]/edit`).
     - Ein `useEffect` Cleanup beim Unmount setzt den Context zurück (vermeidet Leak eines Fake-Workouts in andere Flows).
  2. Im Render: Die Info-Felder (Name, empfohlenes Gym) bleiben als Cards/Felder im Wrapper (wie DatePicker in der History-Edit). Darunter wird `<ActiveWorkoutScreen mode="edit" showBottomBar={false} />` eingebettet.
  3. Der Shared Screen übernimmt komplett: Dnd (long-press), ExerciseCards (edit-Modus ohne Check-Spalte), Add-Exercise (große + Icons + `ExerciseSelectionModal` – bereits shared und mit Custom-Exercise-Support), alle Mutations (werden lokal gecloned wegen Status).
  4. Auf "Speichern" im Wrapper:
     - Lies `activeWorkout` aus dem Context.
     - Mappe zurück: Für jede Exercise nimm die committeten `sets` (oder Fallback `plannedSets`), konvertiere `setType` + Werte zurück zu `isWarmup` + `target*`.
     - Baue das bekannte Template-Payload und rufe `createWorkoutTemplate` oder `updateWorkoutTemplate`.
     - Validierung (Name + jede Übung ≥1 Satz) bleibt im Wrapper (kann später mit canFinish-Logik harmonisiert werden).
  5. Styling: TemplateEditorScreen auf sera migrieren (bg-background, Card/CardContent, semantic Tokens, Tabler Icons statt lucide/emoji, keine hard blue/gray).

**Vorteile:**
- Sofortige Konsistenz mit Active-Workout und History-Edit (eine Komponente, ein Verhalten für Add/Remove/Reorder/Replace/Edit-Sets).
- Die UX-Verbesserungen (Collapse + Balken, Long-Press Drag, Table, Swipe wo sinnvoll auch im Edit) kommen "gratis" zu den Templates.
- ExerciseSelectionModal + ExerciseEditorDialog (für Custom Exercises) werden weiterhin einheitlich genutzt.
- Vorbereitung auf Cycle-Wizard (Blueprint-Editing) als nächsten Schritt.

**Risiken / Bekannte Einschränkungen (werden mit dem Debt mitgetragen):**
- Wir "missbrauchen" den Workout-Context + Completed-Hack temporär für Blueprint-Editing (kein echter Workout, keine Persistenz über den Fake-Status).
- Mapping performed <-> planned muss robust sein (Mount-Commit-Effekt im ExerciseCard in Edit-Mode hilft, Werte auch ohne explizites "Loggen" verfügbar zu machen).
- Globale Context-Hijacking: Template-Editor muss sauber cleanupen. Bei laufendem echtem Workout sollte man idealerweise nicht gleichzeitig Templates editieren (User-Flow ist sequentiell).
- Später (Backend-Refactoring + bessere Shared-Komponente) kann man die Editor-Logik weiter entkoppeln (props-driven statt Context-only).

**Umsetzungsreihenfolge (dieser Schritt):**
1. Plan + Doc-Update (hier).
2. `TemplateEditorScreen` anpassen: Import `useWorkout`, `ActiveWorkoutScreen`, `Card` etc. Synthetischen Workout bauen + setDirectly. Wrapper-Layout modernisieren.
3. `handleSave` umschreiben auf Mapping aus `activeWorkout`.
4. Alte Exercise-Liste, `TemplateExerciseCard`-Renders, lokalen `exercises` State, eigenen Dnd + Handler für die Liste entfernen (Modal bleibt, wird aber jetzt vom Shared Screen gerendert – doppelte Instanz vermeiden).
5. Styling-Alignment (Header, Info-Card, Buttons, Loading-State).
6. Testen der Flows: Neue Vorlage anlegen (Empty + big +, Sets hinzufügen, Edit, Reorder, Replace, Save), Bestehende Custom-Vorlage laden + editieren + save.
7. Lint + tsc + Commit/Push.
8. Plan-Doc aktualisieren (Status "Templates nun über Shared Component").

Danach: Nächster "stück für stück" Kandidat ist der Cycle-Wizard / Blueprint-Editing.

---

### Phase 4 – Teil 2: Active Workout Screen – Vereinfachung der ExerciseCard & Completion Flow (abgeschlossen)

**Abschlussdatum:** April 2026

**Erreichtes (Zusammenfassung):**
- Entfernung der `isExerciseComplete`-Logik und der Live-Unterscheidung "geplant vs. ungeplant" während der Execution (wie vom User gewünscht und begründet).
- Tiefe UX-Modernisierung der `ExerciseCard` (Long-Press Drag-Reorder, Tap Header für Collapse/Expand, Table-Layout für Sets mit (2x)-Labels, LTR-Swipe zum Loggen, RTL-Swipe zum Entfernen ungeloggter Sätze, Collapsed Horizontal Bars für Fortschritt, immer editierbare Inputs auch nach dem Loggen, fat Check als reiner Indicator, einheitliche Behandlung von Additional Sets).
- Completion Flow vollständig auf shadcn/sera (Confirmation mit Blueprint-Update + Save-as-Template, WorkoutCompletionModal mit Slides/Confetti/PRs, Save-Template-Input-Dialog).
- Alle Entry-Points (vorgeschlagenes, freies, Vorlage, Zyklus, Vergangenes) nutzen einheitliche Patterns und die gleiche `ExerciseCard`-Logik.
- Konsistenz, Accessibility, Mobile-Fixes, Icons, Tokens durchgängig angewendet.
- Regelmäßige Lint/TSC/Commits.

**Fazit Teil 2:** Der aktive Workout Screen (inkl. ExerciseCard und Completion) ist nun visuell, UX-seitig und technisch auf einem hohen, einheitlichen Niveau.

---

### Phase 4 – Teil 3: Extraktion Shared Components – Einheitlicher Workout Screen / WorkoutExercise (neu)

**Ziel (wie vom User im April 2026 formuliert):**
- Der **Workout Screen** (bzw. der Kern: die Ansicht mit der Liste von Übungen/Sätzen) soll als **eine einzige, wiederverwendbare Shared Component** zur Verfügung stehen.
- Jeder Einstiegspunkt (vorgeschlagenes Workout, freies Workout, Vorlage, Zyklus, etc.) soll **dieselbe Komponente** laden – keine parallelen Implementierungen mehr.
- Dieselbe Ansicht soll später an anderen Stellen der App genutzt werden können:
  - Vorlagenerstellung und -bearbeitung (Editor-Modus)
  - Cycle Wizard / Blueprint-Bearbeitung
  - History Review (Review-Modus)
  - Evtl. weitere Previews
- **Vorteil:** Änderungen (z. B. neue Swipe-Geste, neues Set-Layout, neue Validierung) müssen nur noch **an einer zentralen Stelle** gemacht werden. Das reduziert Drift, Wartungsaufwand und Inkonsistenzen massiv.

**Aus Sicht des Agenten: Ja, das macht absolut Sinn.**
- Aktuell gibt es bereits Duplikation (z. B. `workout/exercise-card.tsx` für Live, `templates/template-exercise-card.tsx`, `cycles/blueprint-exercise-editor-card.tsx`, verschiedene SelectedExerciseCards in Analytics/History).
- Die Philosophie "Flexibilität über Rigidität" gilt für den User-Flow, nicht für die UI-Implementierung. Eine zentrale Komponente mit klaren Modi (execution | editor | review) passt perfekt.
- Der `WorkoutContext` kann als zentrale State-Logik dienen oder in Modi aufgeteilt werden.
- Vorbereitung: Die jüngsten Refactorings an `ExerciseCard` (Entfernung geplant/ungeplant, Table, Swipe, etc.) und die Vereinheitlichung der Entry-Points waren genau die notwendige Vorarbeit.

**Geplanter Ansatz (detaillierter Plan folgt nach Analyse):**
1. **Analyse aller Entry-Points und aktuellen Implementierungen** (start-screen, active-workout-screen, template-editor-screen, cycle editors, history views, analytics).
2. **Identifikation der gemeinsamen Teile**: Exercise List Rendering, Set Logging/Editing, Add/Remove/Reorder/Replace, Validation, Swipe/Table-UI, etc.
3. **Design der Shared Component**:
   - Primär-Kandidat: `WorkoutExercise` (oder `WorkoutView`) mit `mode` Prop (`"execution" | "editor" | "review"`).
   - Oder eine Komposition aus kleineren Shared Pieces (`ExerciseList`, `SetRow`, `ExerciseHeader` etc.) + Modi.
   - Props: `exercises`, `onLogSet`, `onUpdateSet`, `onAddExercise`, `readonly`, `showPlannedDefaults`, etc.
   - Wiederverwendung des bestehenden `WorkoutContext` wo sinnvoll, oder Kontext-Provider pro Modus.
4. **Migration schrittweise**:
   - Zuerst die Live-Execution (active-workout) auf die Shared Komponente umstellen.
   - Dann Template-Editor (ersetzt TemplateExerciseCard).
   - Dann Cycle/Blueprint.
   - History Review.
   - Sicherstellen, dass alle Entry-Points (vorgeschlagen, frei, Vorlage...) die **gleiche Komponente** rendern.
5. **Dokumentation & Tests**: Jeder Modus mit Beispielen, Unit-Tests für gemeinsame Logik.
6. **Zusätzliche Shared Pieces** (falls noch nicht vorhanden): ExerciseSelector (bereits ExerciseSelectionModal + EditorDialog), Set-Logger etc.

**Nächste konkrete Schritte (nach User-Bestätigung):**
- Analyse der aktuellen Code-Basen (Einstiegspunkte, Duplikationen).
- Erstellung eines detaillierten Design-Dokuments / API-Sketch für die Shared Component.
- Entscheidung: Eine große `WorkoutScreen`-Komponente oder feingranularere `WorkoutExercise` + Komposition?
- Implementierung starten (beginnend mit der Live-Execution als Referenz-Implementierung).

Das passt perfekt zur Projekt-Philosophie (Flexibilität für den User, aber saubere, wartbare Architektur) und zu den früheren Plänen ("Bevor wir die Shared Component extrahieren..."). Wir vermeiden zukünftig parallele Implementierungen und gewinnen massiv an Konsistenz und Wartbarkeit.

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

## Phase 4 – UX Verbesserungen Active Workout Screen (ExerciseCard) – Detaillierter Plan

**User Request (April 2026):** Nach der visuellen Migration und Entfernung von isExerciseComplete wollen wir die UX des aktiven Workout-Screens (fokussiert auf ExerciseCard) verbessern. Orientierung an Screenshots einer anderen guten Workout-App (IMG_0837.PNG, IMG_0838.PNG, IMG_0840.PNG). 

**Wichtige Vorgaben:**
- Farben, Schrift, semantische Tokens, shadcn Patterns (Card, Badge, Button ghost/icon, Input etc.) **bleiben exakt wie in unserem aktuellen sera Design** (kein grün für "done" im Sinne von isComplete – stattdessen schwarz/fett = foreground für geloggte Indikatoren).
- Icons für Set-Typ (Aufwärmen / Arbeit) **genau wie in der History-Detail-Seite** (`/history/[id]` und Edit): 
  - WARMUP → `<IconFlame className="..." />` (in Badge outline)
  - WORKING → `<IconBarbell className="..." />` (in Badge default)
- Fokus: **Gesture-first** (Long-Press Drag, Tap-to-toggle, Swipe-to-log / Swipe-to-delete) für natürlicheres mobiles Feeling.
- Flexibilität bleibt erhalten (Add/Remove/Reorder/Replace mid-workout, Edit before/after log, Free + Blueprint Workouts, unilateral/double-weight Labels, planned defaults als Startwerte).

**Ziel-Layout (aus Beschreibung + Referenz):**
- **Collapsed (default):** Header mit # + ExerciseName + rechts: Replace-Icon + Delete-Exercise-Icon. **Darunter** horizontale Linien (pro Satz eine kurze Linie) – ausgegraut für ungeloggt, **schwarz/fett (bg-foreground)** für geloggt.
- **Expanded:** Saubere Tabellen-ähnliche Zeilen pro Satz mit Spalten/Zellen:
  - Typ (Icon Flame oder Barbell – tappbar zum Umschalten vor dem Loggen)
  - Gewicht (kg, ggf. mit (2x) Hinweis)
  - Wdh (Reps)
  - RIR
  - Checkhaken (zum Loggen per Tap; bei geloggt: **fetter** / stroke-[3] + farbig)
- Kein sichtbares Grip-Icon und kein Chevron mehr.
- Swipe auf Satz-Zeile:
  - Links → Rechts (LTR): loggt den Satz (Check wird fett). Alternative: Tap auf Checkhaken.
  - Rechts → Links (RTL): löscht den (geloggten) Satz.
- Long-Press (klick+halten) irgendwo auf die ExerciseCard (Header) → Drag zum Umsortieren der Exercises (ganze Liste).
- Kurzer Tap auf den Exercise-Namen (oder Header-Bereich) → collapse/expand toggle.
- Exercise-Level Actions (Replace, Delete Exercise) bleiben rechts im Header.

**Detaillierter Umsetzungsplan**

### 1. Drag & Drop für Exercise Reorder (Long-Press statt Grip)
- **active-workout-screen.tsx** (DndContext):
  - Sensors anpassen:
    ```ts
    const sensors = useSensors(
      useSensor(PointerSensor, {
        activationConstraint: {
          delay: 300,      // Long-Press Delay (ms)
          tolerance: 8,    // erlaubte Bewegung während des Haltens
        },
      }),
      useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );
    ```
  - handleDragEnd bleibt gleich (ruft reorderExercises).
- **exercise-card.tsx**:
  - Entferne `IconGripVertical` aus Imports.
  - Entferne den gesamten Grip-Button (die kleine drag-handle Schaltfläche links).
  - Verteile `{...attributes} {...listeners}` auf den Header-Container (`<div className="px-4 py-3 flex ... bg-muted border-b">` oder einen direkten Wrapper um # + Name).
  - Style: `cursor-grab active:cursor-grabbing` am Header (wird beim Drag aktiv).
  - Die Action-Icons rechts (Refresh/Trash) bekommen `onPointerDown={(e) => e.stopPropagation()}` damit Long-Press dort nicht den Drag startet.
  - Die isDragging Style (opacity etc.) bleibt über dnd-kit.
- Verhalten: Kurzer Tap auf Header → kein Drag (wegen Delay). Halten + leicht bewegen → Card hebt ab und Liste reordered sich. Passt perfekt zum "auf die exercise card klickt und hält".

### 2. Collapse/Expand per Tap (kein Chevron Icon)
- Entferne `IconChevronDown` aus Imports + den ganzen Collapse-Button (inkl. onClick).
- Mache den linken Header-Bereich ( `#${exerciseNumber} ` + `exercise.exerciseName` ) per `onClick` toggle-bar:
  ```tsx
  onClick={(e) => {
    e.stopPropagation(); // falls Listener auf Parent
    setIsCollapsed(!isCollapsed);
  }}
  ```
- Der Header (außer die rechten Action-Buttons) kann generell toggle triggern.
- Konfliktvermeidung: Weil Sensor-Delay existiert, wird ein normaler Tap (schnell loslassen) den Click auslösen, bevor Drag aktiviert wird.
- isCollapsed State bleibt (default true).
- Beim Drag (isDragging) ggf. temporär nicht togglen (optional).

### 3. Exercise Actions bleiben
- Refresh (IconRefresh / Replace) + Trash (IconTrash / Exercise löschen) **bleiben** rechts im Header, in beiden Zuständen (collapsed + expanded).
- Bisherige disabled-Logik + AlertDialog + Modal für Replace bleiben 1:1.
- Keine Änderung an handleRemoveExercise / handleReplaceExercise.

### 4. Expanded: Satz-Tabelle mit Zellen (Icon + Werte + Check)
- Im `!isCollapsed && <CardContent className="p-3 space-y-1">` (engerer Padding).
- Alle Sätze als einheitliche "Tabellenzeilen" rendern (keine gestapelten Karten mehr mit separatem bg für planned/unplanned).
- Verwende ein konsistentes Grid pro Zeile:
  ```tsx
  <div className="grid grid-cols-[auto,1.2fr,1fr,0.8fr,auto] gap-x-2 items-center py-1.5 border-b last:border-b-0 ...">
    {/* 1. Typ-Zelle */}
    {/* 2. Gewicht */}
    {/* 3. Wdh */}
    {/* 4. RIR */}
    {/* 5. Check */}
  </div>
  ```
- **Typ-Zelle (erste Spalte):** 
  - Verwende exakt die Icons aus History:
    ```tsx
    <Badge variant={isWarmup ? 'outline' : 'default'} className="p-0.5" onClick={toggleType}>
      {isWarmup ? <IconFlame className="size-5" /> : <IconBarbell className="size-5" />}
    </Badge>
    ```
  - Für ungeloggte Zeilen: Klick auf Icon toggelt SetType (WARMUP <-> WORKING) und updated editValues.
  - Kein separates <select> mehr – Icon reicht (wie im Referenz-Screenshot implizit).
- **Wert-Zellen (Gewicht / Wdh / RIR):**
  - **Geloggte Zeile (Display):** 
    - `<span className="tabular-nums font-medium">{weight} <span className="text-[10px] text-muted-foreground">kg</span></span>`
    - Ähnlich für Reps ("Wdh"), RIR ("RIR x").
    - Berücksichtige `exercise.isDoubleWeight` / `isUnilateral` mit kleinem Suffix oder Title (z.B. in der Spaltenüberschrift oder als Hint).
  - **Ungeloggte Zeile (Prepare / Edit):** kleine `<Input type="number" className="h-7 text-sm tabular-nums p-1" />` direkt in der Zelle. 
    - Pre-Fill mit planned values (über getEditValue) oder leer bei Additional.
    - Keine Labels mehr pro Input (spart Platz – Header optional).
  - Edit-Modus für bereits geloggte Sätze: Wenn `editingSetId === set.id`, werden die Zellen zu Inputs (wie bei ungeloggt), die Check-Spalte wird zu Save + Cancel (kleine Buttons oder Icons).
- **Checkhaken-Spalte (letzte):**
  - Immer `<button>` mit `<IconCheck ... />`.
  - Ungeloggt: normal / halbtransparent, Klick → `handleLogSet(setNumber)`.
  - Geloggt: `className="... stroke-[3] text-foreground"` (fetter), Klick optional (noop oder Edit-Trigger).
  - Bei erfolgreichem Log: der Check wird sofort fett (nach Re-Render durch Context-Update).
- **Zusätzliche Zeilen:**
  - Geplante ungeloggte Zeilen: immer alle `plannedSets.length` rendern (auch wenn Werte schon in editValues überschrieben).
  - Additional / Free prepare Zeilen: nach den geplanten (wenn welche im additionalSetNumbers).
  - Extra geloggte (höhere setNumbers als planned): unten anhängen.
- Entferne die alten großen Checkboxen, grünen BGs (schon neutral), separaten "Freie Workouts" Zweig – alles unified in den Grid-Rows.
- Leerer Zustand: wenn keine planned und keine logged und keine drafts → kleiner Hinweistext.

**5. Loggen per Check-Tap oder LTR-Swipe**
- Tap auf Checkhaken (wie oben) bleibt.
- Zusätzlich: Swipe Geste LTR auf der gesamten Satz-Zeile → ruft dasselbe `handleLogSet` auf (für die betroffene Zeile).
- Nach erfolgreichem Log wird der Check in der Zeile fetter (automatisch durch Re-Render).

**6. Löschen per RTL-Swipe**
- Nur auf **geloggten** Zeilen sinnvoll: Swipe RTL auf der Zeile → `handleDeleteSet(set.id)`.
- Visuelles Feedback während des Swipes (siehe 8).
- Der alte Trash-Button pro geloggtem Satz kann entfernt oder durch ein kleines Edit-Icon ersetzt werden (Delete nur noch per Swipe, um UI clean zu halten).
- Ungeloggte Zeilen: RTL-Swipe kann die Drafts zurücksetzen / ignorieren.

**7. Collapsed: Horizontale Satz-Indikatoren**
- Nur rendern wenn `isCollapsed`.
- Direkt unter dem Namen (im Header, nach dem flex oder in extra div mit `ml-[2.5rem] flex gap-1 mt-1`):
  ```tsx
  {setSlots.map((slot, i) => {
    const logged = !!getLoggedSet(slot);
    return <div key={i} className={`h-[2.5px] w-4 rounded-[1px] ${logged ? 'bg-foreground' : 'bg-muted-foreground/30'}`} />;
  })}
  ```
- `setSlots` berechnen:
  - Wenn `hasPlannedSets`: `exercise.plannedSets!.map(p => p.order)`
  - Sonst (Free): `Array.from({length: Math.max(exercise.sets.length, additionalSetNumbers.length || 0, 1)}, (_,i)=>i+1)`
- Die Linien sind **diskret**, aber sichtbar. "Schwarz und fett" = `bg-foreground` (in Light = fast schwarz, in Dark = hell aber prominent).
- Optional: Title/Tooltip "3 von 5 Sätzen geloggt".
- Beim Loggen oder Löschen (auch per Swipe) aktualisiert sich die Anzeige sofort (da Exercise-Prop frisch kommt).

**8. Allgemeine Swipe-Implementierung (für 5+6)**
- Keine neue Dependency zuerst (um schlank zu bleiben). Native Pointer Events (funktioniert für Touch + Maus).
- Lokaler State im Card:
  ```ts
  const [swipeState, setSwipeState] = useState<{ rowKey: number | string; offset: number } | null>(null);
  ```
- Pro Satz-Zeile (dem Grid-Div) Handler:
  - `onPointerDown`, `onPointerMove`, `onPointerUp`, `onPointerLeave` (oder Touch-Äquivalente + Pointer für Unified).
  - Berechne horizontales Delta. Nur wenn |deltaX| >> |deltaY| (horizontal dominant) → Swipe aktiv.
  - Während Swipe: `style={{ transform: `translateX(${offset}px)` }}` + leichte BG-Färbung (positive = primary/10 für Log, negative = destructive/10 für Delete).
  - Threshold ~70-90px:
    - deltaX > thresh → log action (wenn ungeloggt)
    - deltaX < -thresh → delete action (wenn geloggt + confirmed)
  - Nach Action: offset animiert auf 0 zurück (oder setTimeout + state reset).
- Guards:
  - Kein Swipe während `editingSetId` oder `loading`.
  - Bei fokussiertem Input in der Zeile: Swipe nicht starten oder sofort abbrechen.
  - Nur eine aktive Swipe gleichzeitig.
- Optional später: `framer-motion` für `animate` und besseres "snap back" + Velocity-basiertes Commit.

**9. Weitere Details & Polish**
- Unilateral / Double-Weight: Hinweise bleiben (z.B. in Spalten-Header oder als `text-[10px]` neben den Werten).
- Edit-Button: Für geloggte Zeilen ein kleines `IconEdit` in der Zeile (neben oder statt altem Trash). Klick → Edit-Modus (Inputs in den Zellen + Save/Cancel in der Check-Spalte).
- + Button: Nach den Zeilen, kann als eigene Grid-Zeile mit col-span und dashed border gestylt werden.
- Loading States: Buttons und Swipes disabled während `loading`.
- Accessibility: aria-labels auf Icons ("Satz loggen", "Satz löschen per Wischgeste"), role="row" etc. optional.
- Animationen: Collapse kann mit `max-h-0` / transition oder später motion.height; neue Zeilen kurzer Fade.
- Update TODO-Kommentar im Code.
- Styles: Alles mit unseren Tokens (border-border, bg-card / muted/30, text-foreground, text-muted-foreground). Keine rounded-lg auf inneren Zeilen (rounded-md oder none).
- Edge Cases: 
  - Swipe auf Additional-Row (unlogged) → LTR loggt sie (validiert vorher).
  - RTL auf unlogged → ignoriert oder cleared die Draft.
  - Viele Sätze → Liste scrollt natürlich mit der Seite.
  - Free Workout Start → keine planned Lines, Indikatoren wachsen mit jedem geloggten Satz.
- Nach Implementierung: Manuelles Testen auf echtem Mobile (iOS Safari + Android Chrome) + Desktop.

**Betroffene Dateien**
- `apps/frontend/components/workout/exercise-card.tsx` (Hauptarbeit: Header, neue Grid-Rows, Swipe-Handler, Indicators, Icon-Imports, State-Erweiterungen, alte Checkbox/Select-Logik entfernen)
- `apps/frontend/components/workout/active-workout-screen.tsx` (nur Sensor-Update + ggf. kleine Style-Anpassung am Add-Exercise Button)
- `UI-REFRACTORING-PLAN.md` (dieser Abschnitt + später "Umsetzung Stand")
- Optional: `apps/frontend/types` (keine Änderung erwartet)
- Wenn wir framer-motion für Swipes nutzen: `package.json` + Import.

**Empfohlene Reihenfolge der Umsetzung (Plan-First, schrittweise)**
1. Sensor-Update + Grip entfernen + Long-Press Drag auf Header testen (nur Reorder).
2. Chevron entfernen + Tap auf Name für Toggle + Indikatoren (7) implementieren + collapsed Test.
3. Tabellen-Layout für Expanded (4) ohne Gesten portieren (inkl. Type-Icons, Edit-Modus, + Button, alle Row-Typen). Aktuelle Logik (handleLog etc.) an neue Zellen binden.
4. Swipe-Logik (8) + LTR/RTL Actions (5+6) + visuelles Feedback hinzufügen. Click-Check parallel.
5. Polish, Labels, Edge-Cases, Accessibility, Tests.
6. Update Plan-Doc mit "Umsetzung abgeschlossen".
7. Commit & Push (ähnlich wie vorher).

**Nächste Schritte nach Plan-Bestätigung**
- User gibt Feedback / Anpassungen zum Plan.
- Dann inkrementelle Implementierung (mit Zwischencheckpoints pro Punkt 1-5).
- Danach können wir über weitere Screens (z.B. Rest-Timer) oder die Shared Component sprechen.

Dieser Plan respektiert die Projekt-Philosophie (Flexibilität, keine starren Blueprints, mobile-first PWA) und baut direkt auf der vorherigen shadcn-Migration der ExerciseCard auf.

**Umsetzung Stand (aktuell, inkl. User-Feedback-Fixes):** 
- Header UX + collapsed indicators + set type icons (Flame/Barbell) as before.
- Table: always consistent Input cells for values (no layout shift on log), dynamic header showing (2x) for Gewicht/Wdh based on exercise flags.
- Logged rows: inputs (value from logged or editing buffer on tweak), live updateSet on field change (no explicit save), fat non-interactive check (no unlog via tap/swipe), delete only via RTL swipe (no per-row buttons).
- Unlogged rows: inputs + normal check (tap or LTR swipe to log).
- RTL swipe (delete gesture) on **unlogged** set: removes/hides the row for both additional/extras **and** planned unlogged sets (planned: local skippedPlannedSetNumbers, filtered in render + indicators). Clears edits + for additional removes from list.
- RTL swipe on **logged** set: no effect whatsoever (cannot delete logged sets via swipe).
- RTL swipe on **logged** set: no effect whatsoever (cannot delete logged sets via swipe).
- LTR or check tap only affects unlogged (logs them; no unlogging).
- Type change via icon only pre-log.
- Lint/tsc clean.
- Plan updated.

All points addressed.

**Zusätzliche Fixes aus Mac-Testing (User-Report nach Swipe/Tabellen-Umsetzung):**
- **Collapsed Indikatoren für ungeplante Sätze**: `getSetIndicatorSlots()` in exercise-card.tsx berücksichtigte bei `hasPlannedSets` nur die (gefilterten) plannedSets. Ungeplante zusätzliche Sätze (via "+ Satz hinzufügen", egal ob noch ungeloggt in additionalSetNumbers oder bereits geloggt in exercise.sets) fehlten in den horizontalen Balken im Collapsed-State.
  - Fix: Umgestellt auf einheitliches `Set<number>`-Union: non-skipped planned + alle logged sets (extras inkl.) + additional drafts. Dann sortiert. Funktioniert jetzt für planned+added, free-workouts und gemischt. Balken-Farbe via `getLoggedSet(slot)` (bg-foreground vs muted-foreground/30) bleibt korrekt.
  - "egal ob gelogged oder ungelogged" jetzt abgedeckt; skipped planned bleiben ausgeblendet (kein Balken).
- **Rest-Timer Light-Mode Kontrast bei Overtime**: Timer wird bei `restTimer > restTimerTarget` korrekt rot (`bg-destructive`). Vorher `text-destructive-foreground` (nicht definiert im sera-Theme) → in Light-Mode schwarze Schrift auf Rot (schlechter Kontrast).
  - Fix: `--destructive-foreground: oklch(0.985 0 0);` (weiß) explizit in `:root` und `.dark` von globals.css hinzugefügt + `--color-destructive-foreground` im `@theme inline` exposed. Damit `text-destructive-foreground` auf red jetzt überall weiße Schrift liefert (Light + Dark). Besser als hard `text-white` im Timer, da konsistent für alle Destructive-Buttons (z.B. Löschen in Card/Templates/Cycles).
  - RestTimerDisplay selbst unverändert (nutzt bereits die Klasse für isOvertime).
- **Reihenfolge von ungeplanten Sätzen in der Tabelle**: Nachdem ein ungeplanter Satz geloggt wurde (wird in "Extra logged sets" gerendert) und dann ein weiterer ungeplanter hinzugefügt wird (landet als unlogged Draft in additionalSetNumbers), erschien der neue Draft immer direkt nach den geplanten Rows (weil "Additional prepare rows" Block vor "Extra logged" stand). Dadurch stand er nicht "ganz unten nach dem bereits geloggten ungeplanten".
  - Fix: Statt zwei separaten Blöcken (die bei Block-Reihenfolge nur den happy-path abdecken würden) jetzt ein einziges kombiniertes Rendering für Extras: berechne alle relevanten extra setNumbers (drafts + logged extras), sortiere aufsteigend nach setNumber, rendere via `renderDraftRow` / `renderLoggedExtraRow` Helfern in dieser Reihenfolge. Neue ungeplante landen damit immer am Ende der Extra-Sektion (korrekt nach bereits geloggten ungeplanten). Funktioniert auch bei "out-of-order" loggen von Drafts und für Free-Workouts. Helfer-Funktionen kapseln die (unterschiedlichen) Row-JSX, um Duplizierung zu vermeiden.
  - Verifiziert: eslint + tsc clean auf der Datei.
- Verifiziert: eslint (betroffene Datei clean), tsc (keine neuen Fehler in modified files), semantische Tokens + keine Hardcodes.
- Plan + Code-Stand aktualisiert.

---

### Phase 4 – Nächster Schritt: Übung-hinzufügen Overlay + Trigger auf shadcn/sera (User Request)
**User Request (direkt):** "okay super dann lass uns als nächstes das übung hinzufügen overlay auf shadcn umstellen. Ich fände es gut wenn wir anstatt "Übung hinzufügen" button einfach ein großes + icon zeigen das mittig ausgerichtet ist und eckig ist. Wenn man darauf klickt öffnet sich das overlay"

**Ziel:**
- Vollständige Migration des `ExerciseSelectionModal` (shared Component für Active-Workout, Replace in Card, Template-Editor, Cycle-Blueprint, etc.) auf shadcn/ui + sera Tokens.
- Redesign des Triggers **im aktiven Workout-Screen**: Statt des alten dashed Text-Buttons ("+ Übung hinzufügen" / "Erste Übung hinzufügen") ein großes, mittig ausgerichtetes, **eckiges/quadratisches** + Icon (IconPlus, Tabler), das prominent als CTA dient. Klick öffnet das (nun moderne) Overlay.
- Konsistenz: Filter, Liste, Create-Custom-Button ebenfalls auf Button/Input/Card-Patterns migriert.
- API modernisiert zu controlled Dialog (open + onOpenChange) für bessere Integration mit anderen shadcn Dialogs.
- Mobile UX: Große Tap-Targets, gutes Scrolling, semantische Farben (auch Light-Mode).

**Warum shared?**
- ExerciseSelectionModal wird aktuell in vielen Kontexten verwendet (active-workout-screen, exercise-card für Replace, template-editor-screen, cycle editors, blueprint-editor-step, analytics?, cycles pages).
- Die visuelle Modernisierung des Overlays profitiert allen Flows.
- Der Trigger-Redesign (großes + Icon) wird **nur für den aktiven Workout** umgesetzt (andere Editoren können später ihre alten dashed Buttons ebenfalls upgraden oder behalten).

**Detaillierte Umsetzungsschritte:**
1. **exercise-selection-modal.tsx**
   - Props anpassen:
     ```ts
     interface ... {
       open: boolean;
       onOpenChange: (open: boolean) => void;
       onSelect: (exerciseId: string, exercise?: Exercise) => void;
     }
     ```
   - Statt custom `<div className="fixed inset-0 bg-black...">` + inner white box: `<Dialog open={open} onOpenChange={onOpenChange}> <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden"> ...`
   - Header: Dialog-nahe Struktur + Title "Übung hinzufügen" + optional Close (Dialog bringt eigenes X mit IconX; bei Bedarf via [&>button]:hidden ausblenden).
   - Search: `<Input type="text" ... placeholder="Übung suchen..." />` (kein custom focus-ring blue).
   - Filters (Muscle + Equipment):
     - Statt custom bg-blue-600 chips: `<Button variant={active ? 'default' : 'outline'} size="sm" onClick=... >` (wie bereits in exercises-tab.tsx umgesetzt).
     - Wrap in flex gap, scrollable on small screens if nötig.
   - "Benutzerdefinierte Übung erstellen": Statt dashed button → `<Button variant="outline" className="w-full" onClick=...><IconPlus className="mr-2 size-4" /> Benutzerdefinierte Übung erstellen</Button>`
   - Exercise List:
     - Statt custom gray buttons: Liste von `<button className="w-full text-left rounded-md border border-border bg-card p-4 hover:bg-accent transition-colors ...">` oder `<Card className="cursor-pointer" onClick=...><CardContent ...>` (Pattern aus exercises-tab).
     - Name: font-medium text-foreground
     - Sub: text-sm text-muted-foreground mit muscle • equipment + optional Custom Badge (use <Badge variant="secondary" className="...">Custom</Badge>)
     - Loading / Empty states mit text-muted-foreground.
   - Imports: IconPlus, IconX (falls manuell), Button, Input, Card/CardContent, Badge, Dialog* from ui, und behalte ExerciseEditorDialog.
   - Entferne alle Hardcodes (gray-*, blue-*, bg-white, text-gray-900 etc.) → Tokens.
   - Behalte die volle Funktionalität (Search+Filter live via useEffect, duplicate-check lebt im Caller, handleExerciseCreated fügt hinzu + select + close create).

2. **Call Sites updaten (alle Verwendungen)**
   - active-workout-screen.tsx
   - exercise-card.tsx (Replace Flow)
   - components/templates/template-editor-screen.tsx
   - app/cycles/[id]/... , app/cycles/[id]/edit/... , components/cycles/blueprint-editor-step.tsx
   - app/analytics/page.tsx (falls aktiv genutzt)
   - Jeweils: State bleibt `const [show, setShow] = useState(false);`
     Statt `{show && <ExerciseSelectionModal onClose={() => setShow(false)} onSelect={...} /> }`
     → `<ExerciseSelectionModal open={show} onOpenChange={setShow} onSelect={...} />`
   - In manchen Callern (z.B. Replace) wird zusätzlich replacingId gesetzt/gelöscht → onOpenChange oder onClose-Callback anpassen (kann onOpenChange nutzen um bei close zu resetten).
   - ExerciseEditorDialog (sub) bleibt unverändert.
- Wichtig: Der Button "Benutzerdefinierte Übung erstellen" **im Overlay** verwendet bereits die shared `ExerciseEditorDialog`. Nach erfolgreichem Erstellen wird die Übung sofort in die sichtbare Liste eingefügt und automatisch selektiert (`handleExerciseCreated`). Das ist die korrekte Nutzung der Shared Component.

3. **Trigger Redesign nur im Active Workout (active-workout-screen.tsx)**
   - Empty State (wenn exercises.length === 0):
     - Im bestehenden `<Card><CardContent className="p-8 text-center">` :
       - Text "Noch keine Übungen hinzugefügt"
       - Darunter/als zentrale Aktion: großes quadratisches + Icon
         ```tsx
         <Button
           variant="outline"
           onClick={() => setShowExerciseModal(true)}
           className="mx-auto h-16 w-16 rounded-lg p-0 flex items-center justify-center"  // eckig, square, centered
         >
           <IconPlus className="size-8" />
         </Button>
         ```
   - Wenn exercises vorhanden (nach der Dnd Liste):
     - Entferne den alten `<button className="w-full py-3 ... border-dashed border-gray-300 ...">+ Übung hinzufügen</button>`
     - Stattdessen mittig zentriertes großes + :
       ```tsx
       <div className="flex justify-center py-3">
         <Button
           variant="outline"
           onClick={() => setShowExerciseModal(true)}
           className="h-14 w-14 rounded-lg p-0"   // oder h-16 w-16 für "groß"
         >
           <IconPlus className="size-7" />
         </Button>
       </div>
       ```
   - Import: `IconPlus` aus '@tabler/icons-react' hinzufügen (andere Icons schon da).
   - "eckig": rounded-lg (passt zu sera Card rounded-lg, keine pill/rounded-full, keine starken Schatten).
   - Mittig: flex justify-center + mx-auto.
   - Optional: bei Hover leichte Scale oder border-primary für Feedback, aber keep ruhig.
   - Der Bottom Action Bar (Verwerfen / Beenden) bleibt unten fixiert.

4. **Sonstiges / Polish**
   - In der Modal ggf. den Dialog X ausblenden wenn gewünscht (`className="[&>button]:hidden"`), aber für Picker ist X praktisch (User kann ohne Select abbrechen). Aktuell Dialog-Default lassen.
   - Duplicate-Toast etc. bleiben.
   - Nach Migration: prüfen ob in Template/Cycle-Editoren die alten Trigger noch sinnvoll sind (später können die auch auf großes + oder Icon-Button umgestellt werden).
   - Keine Breaking Changes an der eigentlichen Add-Logik (addExercise aus Context).

**Betroffene Dateien**
- `apps/frontend/components/workout/exercise-selection-modal.tsx` (Hauptarbeit)
- `apps/frontend/components/workout/active-workout-screen.tsx` (Trigger + Callsite + Import IconPlus)
- `apps/frontend/components/workout/exercise-card.tsx` (Callsite für Replace)
- Alle anderen Call-Sites (Template, Cycles, Blueprint, Analytics)
- `UI-REFRACTORING-PLAN.md`

**Empfohlene Reihenfolge**
1. Plan in dieses Doc schreiben + User-Confirm (implizit durch "lass uns").
2. Modal migrieren + neue Props.
3. Call-Sites updaten (beginnend mit active + card, da primärer Kontext).
4. Trigger in active-workout-screen auf großes + Icon umbauen (Empty + Add-More).
5. eslint --max-warnings=0 + tsc auf betroffenen Files.
6. Manuell testen: Active Workout (empty + mit Exercises + Replace), mind. ein Editor-Flow (Template).
7. Plan updaten, commit + push.

Dieser Schritt baut direkt auf der shadcn-Migration von ExerciseCard, anderen Modals (Gym, Past, Complete, Discard, TemplateSelection) und der shared ExerciseEditorDialog auf. Passt perfekt zur sera-Preset-Philosophie (Tokens, Tabler, Card/Button, scharfe Kanten).

**Status nach Abschluss:**
- Modal vollständig auf shadcn/sera migriert (Dialog, Button, Input, Badge, Tokens, Tabler IconPlus).
- Props auf controlled open/onOpenChange umgestellt; alle Call-Sites (7+) aktualisiert.
- Im aktiven Workout: "Übung hinzufügen" Text-Buttons durch große, mittig zentrierte, eckige (rounded-lg) quadratische + Icon Buttons (h-16/w-16 bzw. h-14/w-14) ersetzt — für Empty State und nach der Exercise-Liste.
- Filter, Liste, Custom-Create modernisiert.
- eslint clean (primäre Files), tsc clean (keine neuen Fehler), Plan + Commit/Push.
- Passt zu Flexibilität (mid-workout add jederzeit) + mobile-first PWA.

Zusätzlich: Der "Workout beenden?"-Dialog (Overlay mit "Blueprint aktualisieren" und "Als Vorlage speichern" Optionen) war bereits auf shadcn Dialog umgestellt und wurde mit Card-Wrapping für die Optionen weiter poliert. Die nachgelagerte Namenseingabe für "als neue Vorlage speichern" (wenn gewählt) wurde von altem custom Overlay auf shadcn Dialog + Input + Footer-Buttons migriert.

**WorkoutCompletionModal (Slide-Show) vollständig migriert:**
- Haupt-Modal: shadcn `Dialog` + `DialogContent` (controlled open/onOpenChange, hidden default X, eigene Close-Button mit IconX).
- Alle Navigation: Buttons (outline/ghost/default), Progress mit `bg-primary` / `bg-muted`.
- Alle 6 Slides: Tabler Icons (IconBarbell, IconClock, IconTrophy, IconTrendingUp, IconListCheck, IconClipboardList), semantic tokens (text-foreground/primary/muted-foreground, bg-primary/10, bg-card, border-border, bg-muted).
- Summary: Set-Typen jetzt mit Badge + IconFlame/IconBarbell (konsistent zu ExerciseCard), Warmup/Working Unterscheidung via Badge-Variant.
- PRsSlide: Amber Akzent für Feier, nutzt bereits gute shadcn PersonalRecordCard. (später: explizite border border-border hinzugefügt für sichtbare Umrandung wie auf Dashboard).
- Callsite in workout/page.tsx angepasst.
- Keine lucide mehr, volle sera-Konsistenz, Dark/Light safe.
- Lint + tsc clean.
- Accessibility-Fix: `DialogTitle` (visuell versteckt via `@radix-ui/react-visually-hidden`) hinzugefügt, da Radix Dialog einen Title für Screenreader erfordert. `showCloseButton={false}` explizit gesetzt.
- Confetti: useEffect now depends on `open` prop so it triggers correctly when the modal opens (was firing on initial mount before because component is always in tree).
- PRs slide: removed 🎉 emoji; switched trophy to IconAward (Tabler) with semantic black/white colors (bg-muted / text-foreground) instead of gold/amber; close button now rounded-lg (eckig) instead of rounded-full.

**Wichtiger Bugfix (entdeckt nach Migration):** Beim Öffnen des Workout-Screens (zum Starten) kam es zu einem Error in `calculateWorkoutStats` bei `workout.exercises`. 
Ursache: Die CompletionModal-Komponente ist jetzt immer im React-Tree (controlled Dialog). Der Callsite übergab `completedWorkout!` (State initial `null`). Die Stats-Berechnung lief bei jedem Render und crashte bei fehlendem Workout. 
Gelöst durch: `workout?` optional, sichere Default-Stats, Guards in `renderSlide()` und im Slide-Content, Callsite mit `?? undefined`. Zusätzlich `SetType.WARMUP` Enum statt String-Literal für bessere Typsicherheit.

### Phase 4 – WorkoutCompletionModal (Statistiken-Slideshow nach Workout-Abschluss) – Migration auf shadcn/sera
**User Request:** "lass uns mal den großen block der slide show angehen die nach dem speichern eines workouts angezeigt wird, in dem man die stats des workouts sieht. Das sollte auch komplett auf unser shadcn modell angeglichen werden"

**Ziel:**
- Vollständige visuelle und technische Migration der `WorkoutCompletionModal` (inkl. aller 6 Slides) auf shadcn/sera: Dialog statt custom fixed, Tabler Icons (keine lucide), 100% semantische Tokens (keine blue-600, gray-900, bg-white, orange-50 etc.), Button/Card/Badge wo sinnvoll, konsistente rounded-lg/eckig, mobile-first.
- Bewahren der UX: Confetti (kurz), Swipe (useSwipe Hook), Progress Dots, Desktop Arrows, Finish/Skip, PRs-Slide optional ausblenden, animate-fadeIn, detaillierte Summary mit Sets.
- Persönliche Records nutzen bereits die gute `PersonalRecordCard` + `GymTag` (shadcn).
- Keine Breaking Changes an Logik (hasPRs, slide index adjustment, onClose → Template-Save oder Dashboard).

**Detaillierter Plan:**
1. **Struktur der Haupt-Komponente (`WorkoutCompletionModal.tsx`)**
   - Props erweitern auf controlled: `open: boolean; onOpenChange?: (open: boolean) => void;` + behalte onClose für Kompat (oder nur onOpenChange, update Callsite).
   - Root: Statt `<div className="fixed inset-0 z-50 ... bg-black/50 backdrop-blur-sm">` → `<Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }} > <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-xl"> ...`
     - DialogContent übernimmt Backdrop + Positioning + Accessibility.
     - Optional `className="[&>button]:hidden"` wenn wir eigenes Close wollen (User bevorzugte oft keine X bei Confirm-Flows).
   - Confetti bleibt global im Portal-Bereich (vor oder nach Content).
   - Skip/Close Button: Statt custom absolute button mit lucide X + gray bg → shadcn Button ghost oder IconButton mit `IconX`, positioniert, oder Dialog's eigenes X nutzen + anpassen.
   - Slide Area: `<div className="min-h-[500px] flex items-center justify-center p-8 bg-card">` (nutze Card-ähnlich).
   - Navigation Footer: In eigenem Bereich mit border-t oder Padding.
     - Progress Dots: `bg-primary` für active, `bg-muted` für inactive + hover.
     - Buttons: Alle zu `<Button variant="outline" size="sm" className="...">` mit Tabler Icons (`IconChevronLeft`, `IconChevronRight`).
     - Last Slide "Fertig" Button: `variant="default"` (primary).
     - "Überspringen" (non-last): ghost oder outline.
   - Keep `useSwipe` Hook (funktioniert unabhängig).
   - Import: `Dialog*` from ui/dialog, `Button` from ui/button, Tabler Icons statt lucide.

2. **Slide-Komponenten (apps/frontend/components/slides/*.tsx) – einheitlich**
   - Jede Slide: `text-center space-y-6 animate-fadeIn`
   - Icon Container: Statt `p-4 bg-blue-100 rounded-full` → `p-4 bg-primary/10 rounded-full` oder `bg-muted` je nach Slide.
     - Icon Farbe: `text-primary` (für Volumen/Dauer/Übungen/Sets/Summary), für PRs `text-yellow-500` oder passendes (oder `text-foreground` mit accent).
   - Titel: `text-2xl font-semibold text-foreground`
   - Große Zahl: `text-6xl font-bold text-primary`
   - Subtext: `text-xl text-muted-foreground`
   - Beschreibung: `text-muted-foreground max-w-md mx-auto`
   - Ersetze alle lucide:
     - TrendingUp → IconTrendingUp
     - Clock → IconClock
     - Dumbbell → IconBarbell (bereits im Projekt verwendet)
     - ListChecks → IconListCheck oder IconChecklist
     - Trophy → IconTrophy
     - TrendingUp (klein) → IconTrendingUp
     - ClipboardList → IconClipboardList
   - Volume/Duration/Exercises/Sets: einheitliches Blau → primary Theme.
   - PRsSlide: Gelb-Theme beibehalten (bg-yellow-100 → bg-amber-100 oder `bg-primary/10` mit Trophy Icon in passender Farbe), nutzt bereits gute PersonalRecordCard.
   - SummarySlide (komplexester):
     - Exercise Cards: Statt `bg-gray-50 rounded-lg p-4` → `<Card className="bg-muted/30">` oder einfach div mit `border border-border bg-card rounded-md p-4`
     - Set Rows: Warmup → orange Theme durch `bg-orange-50 border-orange-200` etc. anpassen zu semantisch:
       - Warmup: `bg-muted border border-border` + Badge outline + IconFlame (wie in ExerciseCard!)
       - Working: `bg-muted/50 border border-border` + Badge default + IconBarbell
     - Nutze `<Badge variant={isWarmup ? 'outline' : 'default'}>` + Tabler Icons für SetType (konsistent mit ExerciseCard!).
     - Header mit # + Name: text-foreground, muted labels.
   - Alle Slides behalten ihre props und Logik.

3. **Callsite Update (`app/workout/page.tsx`)**
   - Statt conditional `{showCompletionModal && <WorkoutCompletionModal onClose=... />}`
     → `<WorkoutCompletionModal open={showCompletionModal} onOpenChange={(o) => { if (!o) handleCompletionModalClose(); }} ... />` (align mit ExerciseSelectionModal Pattern).
   - Entferne veraltete conditional Logik wenn möglich.
   - Stelle sicher, dass handleCompletionModalClose weiterhin korrekt (set false + template logic) triggert.

4. **Weitere Anpassungen / Polish**
   - Entferne lucide-react Importe überall (ersetze durch @tabler/icons-react).
   - Behalte `animate-fadeIn` (global definiert).
   - Confetti: Bleibt, z-index beachten (vor Content).
   - Accessibility: aria-labels für Dots/Buttons behalten/verbessern.
   - Mobile: Arrows hidden (md:flex), Swipe funktioniert, Dots immer da.
   - Keine harten Farben mehr (blue-600 → primary, gray-900 → foreground, bg-white → card, etc.).
   - Rounded: rounded-lg / rounded-md für eckigen sera Look (keine xl wenn nicht nötig).
   - Nach Migration: Test-Flow: Workout abschließen → Choice Dialog → Completion Slides (mit/ohne PRs) → Swipe/Click Nav → Fertig → ggf. Template Save.
   - Update Plan-Doc + Commit.

**Betroffene Dateien**
- `apps/frontend/components/WorkoutCompletionModal.tsx`
- `apps/frontend/components/slides/VolumeSlide.tsx`, `DurationSlide.tsx`, `ExercisesSlide.tsx`, `SetsSlide.tsx`, `PRsSlide.tsx`, `SummarySlide.tsx`
- `apps/frontend/app/workout/page.tsx` (Callsite)
- Optional: `apps/frontend/hooks/useSwipe.ts` (nicht nötig)
- `UI-REFRACTORING-PLAN.md`

**Reihenfolge der Umsetzung**
1. Plane detailliert in diesem Doc.
2. Migriere Haupt-Modal + Dialog-Wrapper.
3. Migriere Slides nacheinander (einfache zuerst, Summary zuletzt).
4. Update Callsite + Parent-Handling.
5. Lint + tsc + manuelles Verifizieren (inkl. Dark/Light Mode, PRs, Swipe).
6. Plan-Status + Commit/Push.

Das ist der letzte große "alte" Block im Post-Workout Flow. Danach ist der aktive Workout Screen visuell fast komplett auf sera.

**Status nach Abschluss (April 2026):** Templates (Create + Edit für benutzerdefinierte Vorlagen) erfolgreich auf die zentrale Shared Component (`ActiveWorkoutScreen` + `ExerciseCard` im `mode="edit"`) umgestellt. Wrapper (`TemplateEditorScreen`) behält Metadaten (Name, Gym) + Save-Logik, delegiert die gesamte Exercise-Liste + Interaktionen an die Shared Component. Synthetisches COMPLETED-Workout + bestehender lokaler Hack ermöglichen die Integration ohne Backend-Änderungen. Layout auf sera vereinheitlicht. Alter lokaler State + `TemplateExerciseCard` aus dem Editor entfernt.

Zusätzlich: `ActiveWorkoutScreen` um `showHeader?: boolean` Prop erweitert (Default true). Im `mode="edit"` (Templates, History-Edit) kann der innere Sticky-Header (inkl. "Freies Workout" Fallback) ausgeblendet werden, da der Parent eigene Überschriften/Metadaten liefert. Für "Vergangenes Workout tracken" (isPastWorkout) bleibt der Header (wegen Dauer-Input) erhalten. History-Edit und Template-Editor nutzen `showHeader={false}`.

Plan-Doc + Commit/Push durchgeführt.

Nächster Fokus (stück für stück): Cycle Wizard / Blueprint Editing mit derselben Komponente.

---

**Nächster Fokus nach diesen Fixes:** Weiter mit Phase 4 (Shared WorkoutExercise Komponente für execution|editor|review, oder weitere Polishing wie Swipe-Feedback-Verbesserungen, +Satz als Tabellenzeile etc. je nach User-Feedback).

---

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

## Post-Refactoring Cleanup (Mai 2026)

Nach Abschluss der visuellen + architektonischen UI-Refactoring-Arbeiten (zentraler `ExerciseCard` mit Mode+Flags für execution/edit/review-ähnliche Flows, zentrale `AnalyticsChart` + Utils, shadcn/sera-Migration aller Hauptseiten, Cycle-Detail Polishing, History-Edit + Template-Editor Integration etc.) hat der User das Refactoring als abgeschlossen betrachtet.

**Zusätzliche Cleanup-Runde – Untersuchung auf ungenutzte/legacy Komponenten:**

Das gesamte `apps/frontend/components/` (inkl. workout/, templates/, cycles/, analytics/, ui/, slides/ etc.) sowie relevante App-Pages und Imports wurden systematisch untersucht (Directory-Listing, Import-Greps über alle .tsx, Cross-Referenzen auf zentrale Komponenten, Suche nach alten Modal-/Card-Namen, Backup-Files).

**Entfernte, nun ungenutzte Legacy-Komponenten (vollständig durch zentrale ersetzt):**

- `components/templates/template-exercise-card.tsx` — Alte, eigenständige Card-Implementierung für Templates (eigener Dnd/Collapse/State, lucide Icons). Wurde in `template-editor-screen.tsx` komplett durch die zentrale `ExerciseCard` (mode="edit", allow* Flags) ersetzt. Keine Imports mehr außerhalb der Datei selbst.
- `components/templates/template-editor-modal.tsx` — Altes Modal für Template-Erstellung/Bearbeitung. Superseded durch dedizierte Routes (`/templates/new`, `/templates/[id]/edit`) + `TemplateEditorScreen` (welches den zentralen Screen + Shared ExerciseCard nutzt).
- `components/cycles/blueprint-exercise-card.tsx` + `components/cycles/blueprint-exercise-editor-card.tsx` — Die beiden alten, dedizierten Blueprint-Cards (Dnd, eigene Props, alte Muster). Die Cycle-Wizard Steps (`blueprint-editor-step.tsx`, `review-step.tsx`) und der `cycle-wizard` wurden im Zuge der Migration auf die **zentrale** `ExerciseCard` (mit Mapping zu ExerciseLog-Shape + restricted Props) umgestellt. Keine externen Imports mehr.
- `app/templates/page.tsx.bak` — Überbleibsel einer Backup-Datei (verwies auf längst entfernte alte Exercise-Modals).

**Ergebnis der Untersuchung:**
- Die zentralen Komponenten (`components/workout/exercise-card.tsx`, `AnalyticsChart` + chart-utils/styles, `ExerciseSelectionModal`, `ExerciseEditorDialog`, `SelectedExerciseCard`, `PersonalRecordCard`, `WorkoutCompletionModal` + Slides, diverse shadcn-UI) sind jetzt die einzige Quelle der Wahrheit und werden konsistent in Active Workout, History-Edit, Template-Editor, Cycle-Wizard (inkl. Review), Cycle-Detail und Analytics genutzt.
- Interne Feature-Dateien (z.B. die Step-Komponenten im `cycles/`-Ordner, die nur relativ vom `cycle-wizard.tsx` importiert werden) sind **keine** toten Komponenten — sie bilden den Wizard.
- UI-Primitives und kleine Shareds (GymTag, CircularProgress, TrendIndicator, date-picker, protected-route etc.) sind weiter aktiv genutzt.
- Keine weiteren toten Exercise-Cards, Modals oder Duplikate aus der Refactoring-Phase gefunden.
- Alle Entfernungen: Keine broken Imports (Grep + tsc clean für referenzierte Stellen), ESLint auf geänderten/ betroffenen Files ohne neue Violations (pre-existing `any` in data-shaping und Context-Hack bleiben als documented Technical Debt).

**Dokumentation:** Diese Sektion schließt die UI-Refactoring-Phase ab. Der Fokus kann nun auf neue Features, Backend-Refactoring (für echte History-Edit-Mutationen) oder weitere UX-Polish verschoben werden.

---

## Aktueller Schritt (Mai 2026, stück für stück): Cycle Overview (List) + Blueprint Editor (Ziel des Day-Clicks)

**User Request:**
- Auf der Cycle-Übersichtsseite (app/cycles/page.tsx) werden die einzelnen Trainingstage (working days) pro Zyklus als klickbare Mini-Items angezeigt. Klick führt in den Blueprint-Editor (`/cycles/[id]/edit/[workoutDayId]`).
- Die Seite + die erreichbare Editor-Seite auf shadcn/sera bringen.
- Im Editor explizit die **zentrale ExerciseCard** im exakten Modus verwenden, wie für Template-Editing (mode="edit", allowReorder/allowExerciseActions/allowSetManagement=true, allowLogging=false, injected on* Handler, controlled via lokale State-Maps mit plannedSets für restAfterSet, kein Context-Hijack).

**Erreichtes:**
- `app/cycles/page.tsx` (die Seite mit den klickbaren Working Days):
  - Bereits größtenteils shadcn (Card/CardContent für Zyklus-Cards, Button, Badge, AlertDialog, Tabler Icons, bg-background, semantic Tokens).
  - Die Grid-Mini-Items für WorkoutDays (weekday short + Name + "# Übungen + Chevron" → Edit-Link) waren rohe divs (rounded-md, bg-muted/30).
  - Auf shadcn-Konsistenz gehoben: rounded-lg + border-border + bg-card (hover:bg-accent für aktive editierbare), cursor-pointer + onClick router.push für aktive Tage mit Blueprint (ganze Box klickbar, Stop-Propagation für Parent-Card), reiner IconChevronRight als visueller Hinweis (kein separater Link mehr nötig). Für abgeschlossene Tage: bg-muted/30, statisch (kein Klick).
  - Unbenutzter `Link`-Import entfernt.
  - Funktionalität 1:1 erhalten (Navigation zum Editor, Anzeige von #Exercises etc.).
- `app/cycles/[id]/edit/[workoutDayId]/page.tsx` (Blueprint Editor, Ziel der Klicks):
  - War bereits migriert: volle Nutzung der **zentralen** `ExerciseCard` (import aus workout/exercise-card) exakt im Template-Edit-Mode:
    - mode="edit"
    - allowReorder/allowExerciseActions/allowSetManagement={true}, allowLogging={false}
    - Injected controlled Handler: onRemoveExercise, onReplaceExercise, onAddSet, onRemoveSet, onUpdateSet (update sowohl exercises als auch exerciseLogs-Mapping)
    - Mapping exerciseLogs aus BlueprintExercise mit parallel sets + plannedSets (shared id, restAfterSet carry)
    - DndContext + SortableContext um die Cards (vertical)
    - shadcn überall (Card für Settings, Button outline/default, Input/Label, Dialog für Save-as-Template, semantische Tokens in Loading/Header/Selects).
  - Zusätzlich für exakte Übereinstimmung mit Template-Editor: DnD-Sensors auf **long-press** (PointerSensor mit delay:300 / tolerance:8) umgestellt — exakt wie in template-editor-screen.tsx und active-workout-screen.tsx. Damit verhält sich Long-Press-Drag auf dem Card-Header (für Reorder) identisch.
  - Tote States/Functions (blueprintId, handleUpdateExercise) entfernt, idx im Mapper entfernt, any im Catch durch unknown + Type-Guard ersetzt, useEffect-Dep-Warnung per disable kommentiert (üblich bei Load-Patterns).
  - ESLint --max-warnings=0 + relevante tsc-Cleanliness für die Datei erreicht.
- Incidental: Fehlender schließender `</div>` im Filters-Wrapper der Cycle-Detailseite (`app/cycles/[id]/page.tsx`) entdeckt und gefixt (verursachte JSX Parse Error beim tsc; war aus früheren partiellen shadcn-Versuchen).
- Keine Funktionsänderungen an Blueprint-Logik, Save-Payload, Flexibilität oder Datenmodell.

**Status nach diesem Schritt:**
- Die Cycle-List (mit den Working-Day-Quicklinks) ist visuell shadcn-konsistent.
- Der direkte Blueprint-Editor (erreichbar per Klick auf die Tage) nutzt **eine** zentrale ExerciseCard mit exakt denselben Props/Verhalten wie der Template-Editor (inkl. Drag-UX).
- Nächste mögliche Schritte (laut Plan): Vollständige shadcn der verbleibenden harten Styles in `app/cycles/[id]/page.tsx` (Analytics-Filter-Buttons noch mit bg-blue-600/gray-100, viele bg-white shadow Container, harte Chart-Farben), oder Wizard-Schritte weiter angleichen.

### Chart Centralization Update (aktuell)
- `components/analytics/AnalyticsChart.tsx` als zentrale Komponente für Einzelcharts und Comparison-Charts erstellt (kapselt Scrollable + Recharts-Boilerplate, shared Styles, Tooltips, Formatierer).
- `chart-utils.ts` für zentrale Format-Funktionen (formatXAxisLabel etc.) extrahiert.
- Mehrere Einzelcharts auf der Haupt-Analytics-Page (Volume, ORM, RIR Time-Mode) und auf der Cycle-Detail-Page (Volume) auf die zentrale Komponente umgestellt.
- Duplikate (lokale format*-Funktionen) entfernt/zentralisiert durch Import aus utils.
- Komponente unterstützt `footer` für post-chart Stats (Totals etc.).
- Weitere Einzelcharts können schrittweise umgestellt werden; mergeChartData bleibt vorerst page-spezifisch (Datenaufbereitung).
- Fortschritt reduziert Duplikation zwischen analytics/page.tsx und cycles/[id]/page.tsx signifikant.

**Tech Debt (Analytics Week Aggregation Labels):**
- Im Time-Mode (nicht Zyklus-Modus) + `aggregation: 'week'` + Ansicht ≠ Volumen (z.B. RIR, Reps, Sets, Duration, RestTime, ORM) zeigt die X-Achse im Graph einzelne Tage (formatDate des week-start) statt "KWxx" Labels.
- Volumen-Ansicht zeigt korrekt "KW" (via shared `aggregateByWeek` + week metadata in response).
- Die Frontend-Helfer (`formatXAxisLabel`, `formatTooltipLabel`, week metadata collection in `mergeChartData`) und die einzelnen Chart-`tickFormatter` (z.B. `rirData.dataPoints[index]`) verlassen sich darauf, dass **alle** Time-Mode Analytics-Responses bei `aggregation=week` die Felder `weekLabel`, `weekStartDate`, `weekEndDate`, `workoutCount` auf den `dataPoints` mitliefern.
- Volume + die meisten anderen (reps/sets/duration/rest) nutzen den zentralen `aggregateByWeek`-Helper im Backend, der das zuverlässig macht (calendar week → "KW").
- RIR nutzt duplizierten manuellen Aggregations-Code (sowohl für ByCycle als auch Time), der die Felder zwar setzt, aber anscheinend nicht konsistent/gleich in der Response ankommt oder von den direkten Chart-States (im Gegensatz zum merged multi-line) genutzt wird.
- **Keine Code-Änderung vorgenommen** (User-Request: bei Bedarf einer Backendanpassung nur als Tech Debt dokumentieren). Die Inkonsistenz in der Backend-Aggregation über die verschiedenen Analytics-Endpoints (volume vs. rest/reps/sets/duration vs. custom RIR) ist die wahrscheinliche Ursache.
- Würde eine Vereinheitlichung aller Time-Mode get*Analytics auf den shared Helper + konsistente DTO-Erweiterung + Frontend-Typen für week metadata erfordern.

---

### Analytics Page (Haupt-`/analytics`) – shadcn + Design-Update (aktuell)

- Gesamte Seite auf Tokens gebracht: `bg-background` / `bg-card` / `border-border`, `text-foreground` / `text-muted-foreground`, Card/CardContent für Container, Button (default/outline, sm, rounded-lg eckig) für alle Filter-Chips/Toggles (Views, Muskel, Equipment, Aggregation, Cycle-Modus, Nav).
- + Icon für "Übung hinzufügen" (im ODER-Bereich des Filters): großer zentrierter quadratischer Button `h-14 w-14 rounded-lg` mit `IconPlus`, exakt wie in Wizard Step 3 / Active Workout / Templates.
- SelectedExerciseCard (shared): auf Card + semantic + Tabler (IconRefresh/Trash) + ghost icon Buttons migriert (keine hard blue-50).
- Chart-Farben (Lines + RIR-Bars): konsistent auf `var(--foreground)` (schwarz) + `var(--muted-foreground)` / Graustufen für Multi-Line und RIR-Kategorien umgestellt (Dark-Mode-fähig).
- Muscle Distribution: Pie (cluttered bei vielen Gruppen) durch sortierte horizontale Balken-Liste mit `bg-foreground` Bars ersetzt (sauber, lesbar, keine Overlap).
- Aktiv-Badges: von hard green/emerald auf neutrale `bg-foreground text-background` umgestellt (farbschema-konform, kein Akzent).
- ExerciseSelectionModal: X-Close-Button entfernt (Default in zentralem DialogContent auf `showCloseButton=false` gesetzt; Outside-Click zum Schließen ist ausreichend und bevorzugt). Manuelle `&[>button]:hidden` in anderen Modals aufgeräumt.
- Tooltips: alle auf schwarzem BG mit weißer Schrift (contentStyle/itemStyle/labelStyle) für gute Lesbarkeit in Light+Dark.
- Dialog-Default: zentrale `DialogContent` rendert nun per Default keinen X-Button (besser für Selection/Choice Modals; explizit per Prop aktivierbar).

### Cycle Detail Page (`/cycles/[id]`) – Analytics Refactoring (neu)

**Ziel:** Die Seite ist funktional fast identisch zur Haupt-Analytics-Page (nur cycle-spezifische "ByCycle"-Endpoints + feste Cycle-Kontext), daher 1:1 shadcn/sera-Behandlung.

**Wichtige User-Vorgabe zu Filtern:**
- Reihenfolge auf dieser Seite:
  1. Gym (als echtes Dropdown / Select, nicht Chips)
  2. Aggregation (Tage / Wochen)
  3. Danach die restlichen Filter (Views/Ansichten, Muskelgruppe, Equipment, Exercise-Filter "ODER")

**Zentrale Graph-Komponente:**
- Ja, es macht sehr viel Sinn. Es gibt massive Duplikation:
  - Eigener `mergeChartData`, `formatXAxisLabel`, `formatTooltipLabel` (fast identisch zur Haupt-Analytics).
  - Nahezu identische Recharts JSX für Comparison (Multi-Line), einzelne Line/Bar-Charts, ScrollableChart-Wrapper, Tick-Formatter, Tooltips.
- Vorgeschlagene Extraktion (in `components/analytics/`):
  - `chart-styles.ts` (oder `useChartTheme`): `getLineStroke(index)`, `tooltipContentStyle`, `getRIRBarFill` etc. zentral (bereits teilweise in Analytics-Refactor eingeführt).
  - `AnalyticsComparisonChart.tsx` (für >1 selectedViews).
  - `SingleMetricChart.tsx` oder wiederverwendbare `MetricLineChart` / `MetricBarChart` Wrappers, die `ScrollableChart` + `ResponsiveContainer` + gemeinsame Props (data, dataKey, tickFormatter, colors, tooltip) kapseln.
- Vorteil: Änderungen an Farben, Tooltip-Styling, mobile Scroll-Logik, Week-Label-Handling nur noch an einer Stelle. Reduziert Wartungsaufwand massiv für zukünftige Views oder Cycle-spezifische Erweiterungen.
- Erster Schritt in diesem Refactor: Die Style/Helper-Logik extrahieren und beide Pages darauf umstellen (keine volle Komponente in einem Rutsch, um Risiko niedrig zu halten).

**Weitere Aufgaben:**
- Komplette shadcn-Modernisierung der Filter (Buttons statt raw, semantic Tokens, Exercise + als großes Icon-CTA).
- Chart-Container von `bg-white shadow` → `bg-card border`.
- Muscle-Verteilung (falls vorhanden) auf horizontale Bars umstellen.
- Rest der Seite (Header, Stats-Cards, Workout-History-Liste, PRs) ebenfalls auf Tokens + Card-Pattern bringen.
- Icons: lucide → Tabler wo noch nicht geschehen.
- Keine Funktionalitätsänderungen (Aggregation, Filter-Logik, ByCycle-Calls bleiben identisch).

**Status:** Noch nicht begonnen (nach Analytics-Page-Refactor).
- Chart-Container: alle `bg-white shadow` → `bg-card border rounded-lg`.
- **Farbschema schwarz / Dark Mode**:
  - Primäre Linien (erste/vergleich) verwenden `hsl(var(--foreground))` (echt schwarz in Light, hell in Dark).
  - Bei >1 Linie: sekundäre in `hsl(var(--muted-foreground))` + dezente Grautöne für klare Unterscheidung.
  - `getLineStroke(index)` zentral, funktioniert in beiden Modi.
  - Recharts `CartesianGrid`, Tooltip etc. bleiben neutral; ScrollableChart für Mobile-H-Scroll komplett erhalten.
- **Muskelverteilung**: PieChart (cluttered bei 12+ Gruppen + Labels) ersetzt durch sortierte horizontale Balken-Liste (pure Tailwind + `bg-foreground` Bars für "schwarz", relative %, kg Werte, clean auf Mobile, keine Overlap). Gut lesbar, dark-mode safe.
- Lucide → Tabler wo verwendet (Chevrons, Icons im SelectedCard).
- Pre-existing any in Datenlayer + 2 useEffect-Deps mit disables versehen (UI-Refokus, Logik 1:1).
- Lint (0 warnings) + tsc clean für die Datei.
- Nächster Schritt: ggf. Cycle-Detail-Analytics (`/cycles/[id]`) angleichen (hat ähnliche Filter/Charts).

(Visual & UX-Ziele erreicht: schwarzes Schema, eckige Buttons, + Icon, lesbare Graphen, bessere Alternative zum Pie.)

**Lint/Checks:** eslint clean (0 warnings) für die bearbeiteten Dateien; tsc (unrelated pre-existing Fehler in start-screen bleiben unberührt).

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

**Aktueller Fokus:**
- UX-Verfeinerungen am aktiven Workout-Screen (ExerciseCard + Add-Exercise-Overlay/Trigger) – siehe neuen Abschnitt "Phase 4 – Nächster Schritt: Übung-hinzufügen Overlay + Trigger auf shadcn/sera".
- Danach: Extraktion der shared `WorkoutExercise` Komponente (modes: execution | editor | review) die in Workout + Templates + Cycles einheitlich nutzbar ist.

---

**Hinweis:** Dieses Dokument ersetzt frühere informelle Phasen-Planungen aus dem Chat und dient als zentrale Referenz für den UI-Refactoring-Fortschritt.

---

## Letzte Anpassung (Mai 2026): „Vergangenes Workout tracken“ auf Template-Edit-Modus der ExerciseCard umgestellt

**User-Feedback (direkt nach der Zentralisierungs-Validierung):**
> „... wir müssen nochmal an den vergangenes workout tracken modus ran. Hier sieht es aktuell so aus wie als wären alle sets von Anfang an gelogged und das führt zu fehlern wenn ich eine übung austauschen will und ich kann auch keine sets löschen. Aus meiner sicht können wir hier die exercise card im gleichen modus verwenden wie wir sie auch für die bearbeitung von benutzerdefinierten Workoutvorlagen benutzen. Also auch keine Logging spalte etc. Oder würde das dann dazu führen dass man das workout nicht speichern kann weil keine sets gelogged sind?“

**Problemanalyse:**
- Einstieg: `/workout` (app/workout/page.tsx) + `start-screen.tsx` → bei isPastWorkout wird via `setActiveWorkoutDirectly(...)` + `startWorkout({isPastWorkout: true})` ein Workout (meist aus Template/Cycle/Free) gestartet und ActiveWorkoutScreen mit `mode="edit"` gerendert.
- `active-workout-screen.tsx` rendert die Liste immer mit:
  ```tsx
  <ExerciseCard mode={mode} allowReorder allowExerciseActions allowSetManagement allowLogging={true} />
  ```
- Für past tracking liefert das Backend die historischen Werte bereits in `exercise.sets[]` (performed), nicht nur `plannedSets`. `getLoggedSet` → truthy → Card zeigt „logged“-Stil (dunkle Balken, Check-Spalte, isLogged=true).
- Guards in exercise-card.tsx:
  - RTL-Swipe-Delete: `effectiveAllowSetManagement && (!isLogged || !effectiveAllowLogging)`
  - Collapsed Bars: `logged = effectiveAllowLogging && !!getLoggedSet(...)` (dann foreground statt muted)
  - Check-Column: `showCheckColumn = effectiveAllowLogging`
  - LTR-Log-Swipe: nur bei `effectiveAllowLogging`
- Replace-Button selbst war per `effectiveAllowExerciseActions` sichtbar, aber durch das „pre-logged“-Feeling + ggf. API-Verhalten bei Replace auf dem frisch gestarteten past-Workout wirkten Aktionen blockiert oder führten zu Fehlern.
- `canFinishWorkout` war schon korrekt angepasst (`if (mode === 'edit' || isPastWorkout) return exercises.length > 0;`), mit Kommentar „No requirement for explicit 'logged' sets via log UI (which is hidden in edit).“

**Umsetzung (stück für stück, Props-API beibehalten):**
- In `active-workout-screen.tsx` (ExerciseCard-Callsite für die Liste):
  - `allowLogging={!isPastWorkout}` (für live-active: true; für past-tracking: false).
  - Damit für isPastWorkout exakt dieselbe Konfiguration wie im `template-editor-screen.tsx` für benutzerdefinierte Vorlagen:
    - `mode="edit"`
    - allowReorder/allowExerciseActions/allowSetManagement = true
    - allowLogging = false (keine Logging-Spalte, keine LTR-Log-Gesten, graue Indikator-Balken, RTL-Delete erlaubt auch bei vorhandenen Werten in sets[] dank `|| !effectiveAllowLogging`)
- Der `mode="edit"` (von page.tsx übergeben) sorgt zusätzlich für:
  - Dauer-Input statt Live-Timer im Header
  - Auto-Commit-Logik (useEffect + onBlur commitIfNeeded) die Werte aus Edit-Inputs via handleLogSet/contextUpdateSet in den Workout-State schreibt (auch ohne sichtbaren Check-Button)
  - Set-Typ-Toggle erlaubt (Badge-Click-Handler prüft mode==='edit')
- `canFinishWorkout` + „Workout beenden“-Button: bleibt bei `exercises.length > 0`. Die Frage „kann man nicht speichern, weil nichts gelogged ist?“ → **Nein**. Die Commit-Pfade (onBlur für Drafts/Plan, live updateSet für bereits vorhandene, addAdditionalSet + Blur) sorgen dafür, dass beim completeWorkout der aktuelle Stand (mit allen Werten in sets[] oder via Context) ans Backend geht. Analog zur handleSave-Validierung im Template-Editor (nur Anzahl Exercises + Sätze pro Exercise, keine „logged“-Semantik).

**Ergebnis:**
- Vergangenes-Tracking-Flow verhält sich jetzt identisch zum Custom-Template-Edit: volle strukturelle Flexibilität (Übung ersetzen, Sätze per RTL-Swipe löschen, +Satz, Reorder, Set-Art wechseln, Werte editieren) bis zum finalen „Beenden“.
- Visuell: keine Check-Spalte, graue Balken im Collapsed, „unlogged“-Feeling.
- Unterscheidung bewusst erhalten:
  - „Vergangenes tracken“ (isPastWorkout, status IN_PROGRESS bis Beenden): Erzeugen der performed-Daten → wie Blueprint flexibel editierbar.
  - `/history/[id]/edit` (echtes COMPLETED): Immutable-Historie → bewusst restriktiv (keine strukturellen Änderungen in der Card-Konfig; Debt-Hack im Context nur für Werte + limited).
- Keine Änderung an der zentralen `exercise-card.tsx` Props-API nötig (die allow*-Flags + mode + readonly decken den Fall bereits ab).

**Betroffene Dateien:**
- `apps/frontend/components/workout/active-workout-screen.tsx` (die Callsite-Props)
- `UI-REFRACTORING-PLAN.md` (dieser Abschnitt + Status-Update)

**Validierungsschritte (wie immer):**
1. Code-Änderung
2. `cd apps/frontend && npx eslint ... --max-warnings=0 && npx tsc --noEmit`
3. Manueller Test-Flow: Start → „Vergangenes Workout tracken“ (Template oder Free) → im Editor: Replace-Button sichtbar + funktional, Swipe RTL auf einem Satz mit Wert löscht ihn, +Satz hinzufügen + Werte eintragen (per Blur commit), Set-Typ togglen, Reorder, Collapsed-Bars grau, keine Check-Spalte → „Workout beenden“ aktiv (auch ohne „explizites Loggen“) → speichert korrekt mit den eingegebenen Werten.
4. Live-Active-Modus bleibt unverändert (allowLogging=true, volle Logging-UI).
5. Commit + Push auf UI-Refactoring.

**Status nach diesem Schritt:** Die Konfiguration der zentralen ExerciseCard für den „Vergangenes tracken“-Pfad ist jetzt konsistent mit Custom-Template-Edit. Der aktive Screen dient weiterhin als Shell für diesen Flow (Dnd, Header mit Dauer, Bottom-Bar, Complete-Logik, Completion-Modal), während reine Blueprint-Editoren (Templates) eigene Shell + lokale State + on*-Handler nutzen. Zentrale Card + Props-API ist die eine Quelle für alle Fälle.

**Nächste Schritte (offen):** Cycle-Wizard/Blueprint-Editing mit derselben Card-Konfig; ggf. Review ob replaceExercise für isPastWorkout (IN_PROGRESS) im Context auch den In-Mem-Patch-Pfad nehmen sollte (falls API für past-gestartete Workouts strukturelle Changes blockiert – User-Fehler „beim Austauschen“ nach diesem Fix beobachten); Dokumentation der verbleibenden Debt-Pfade (Context-Hijack nur noch für echte History-Edit von COMPLETED).

---

**Gesamt-Status (Mai 2026):** Ansatz B (ExerciseCard als zentrale Komponente mit Props-API) umgesetzt und validiert. Alle Haupt-Flows (Active, Past-Tracking, Custom-Template-Edit, System-Template-Readonly, History-Edit restricted) nutzen `apps/frontend/components/workout/exercise-card.tsx` via mode + allowReorder/allowExerciseActions/allowSetManagement/allowLogging + readonly. Keine Duplikation der Swipe/Collapse/Table/Gesture-Logik mehr. UI-Refactoring-Plan fortlaufend gepflegt. Lint/TSC/Commit-Routine eingehalten.

---

## Nächster Schritt: Cycle Wizard (Zyklus-Wizard) – shadcn/sera UI Refactoring (Blueprint Editing)

**User-Request (Juni 2026):** Nach Abschluss der zentralen ExerciseCard und Vergangenes-Tracking-Alignment nun den Cycle Wizard (`/cycles/new`) auf shadcn/sera migrieren und UX an den Rest der App anpassen (wie Workout-Start, Templates, History, Active Screen).

**Aktueller Stand der Cycles:**
- Cycles List (`/cycles`) und Cycle-Detail bereits in Phase 3 auf shadcn/sera migriert (Cards, Badges, Buttons, semantic Tokens, Tabler Icons).
- CycleWorkoutSelectionModal bereits im Workout-Start-Flow modernisiert.
- **Cycle Wizard / Blueprint-Editor** noch legacy: alte gray/blue Hard-Farben, custom divs mit shadow/p-6, native inputs, custom Progress-Bar aus divs, eigene `BlueprintExerciseCard` + `BlueprintExerciseEditorCard` (Duplikation zur alten Template-Card und zur zentralen ExerciseCard).
- Die Editor-Logik (per WorkoutDay Blueprint mit exercises + sets inkl. restAfterSet, Dnd pro Day, Exercise- + Template-Selection Modals, Review) ist funktional korrekt und muss 1:1 erhalten bleiben (keine Änderung an Datenmodell, Payload, Validierung, Dnd, Add/Remove/Reorder Sets/Exercises).

**Ziel (UI/UX-Konsistenz):**
- Visuell: 100% sera (bg-background/card, text-foreground/muted-foreground, border-border, primary, rounded-lg, Tabler Icons, shadcn Card/Button/Input/Label/Badge/Dialog/Select wo sinnvoll).
- UX: Konsistente Step-Navigation mit expliziten Zurück/Weiter-Buttons (wie in PastWorkoutSetup und Template-Flows), große zentrierte + Icons für Add-Exercise wo passend, Card-basierte Step-Inhalte statt custom shadow-divs, moderne Progress-Indikator (Badges oder Steps statt harter blue-bar), einheitliche Form-Controls, gute Mobile-Tap-Targets, keine Hard-Farben (kein gray-*, blue-600, orange-600 etc.).
- Strukturell: Wrapper + einfache Steps (BasicInfo, WorkoutDays, Review) schnell auf shadcn umstellen. Der komplexe BlueprintEditorStep und seine Karten stückweise migrieren (ähnlich wie Template-Editor → zentrale Card).
- Langfristig (wie im Plan notiert): Cycle-Wizard/Blueprint-Editing mit derselben zentralen `ExerciseCard` (mode="edit", allowLogging=false, volle strukturelle Flags + on* Handler für lokale FormData) nutzen, um Duplikation zu eliminieren (wie bei Templates geschehen).
- Keine Funktionalitätsänderung: Datenfluss (formData → WorkoutDayData → Blueprint → Payload für createCycle), Dnd-Logik, Modals, Submit, Validierung bleiben identisch.

**Betroffene Dateien (ohne Funktionsänderung):**
- `apps/frontend/app/cycles/new/page.tsx` (einfach)
- `apps/frontend/components/cycles/cycle-wizard.tsx` (Wrapper + Progress + Step-Routing)
- `apps/frontend/components/cycles/basic-info-step.tsx`
- `apps/frontend/components/cycles/workout-days-step.tsx`
- `apps/frontend/components/cycles/blueprint-editor-step.tsx`
- `apps/frontend/components/cycles/review-step.tsx`
- `apps/frontend/components/cycles/blueprint-exercise-card.tsx` + `blueprint-exercise-editor-card.tsx` (die Duplikat-Karten)
- Optional: Nutzung der bereits migrierten `ExerciseSelectionModal` + `TemplateSelectionModal` (bereits shadcn).
- `UI-REFRACTORING-PLAN.md` (Dokumentation + Status)

**Reihenfolge (stück für stück, nach jedem Commit/Lint):**
1. Plan in diesem Doc + User-Confirm.
2. Wrapper + Progress + Header auf shadcn/Card/Button/semantic + konsistente Cancel/Abbrechen.
3. BasicInfoStep (Form mit Card + shadcn Input/Label/Button).
4. WorkoutDaysStep (Card-Liste für Tage, Checkbox/Input/Select auf shadcn-Patterns, Buttons).
5. ReviewStep (Summary-Cards, konsistente Buttons).
6. BlueprintEditorStep (äußere Struktur + Integration der Modals + Step-Buttons).
7. Die inneren Blueprint-Cards stückweise (Header, Collapse, Table für Sets, Inputs für weight/reps/rir/restAfterSet, Badges für SetType mit IconFlame/Barbell, Add/Remove Buttons, Dnd-Handle auf IconGrip oder Long-Press wie in zentraler Card).
8. Optional: Erste Schritte zur Nutzung der zentralen ExerciseCard im Blueprint-Kontext (für zukünftige Vereinheitlichung, wie bei Templates).
9. Lint (eslint --max-warnings=0 auf betroffene Files), tsc, manuelle Verifizierung (Create Flow mit mehreren Days, Exercise hinzufügen via Modal, Sets editieren/add/remove, Reorder, Review, Submit – Datenstruktur muss identisch bleiben).
10. Plan-Doc aktualisieren (neuer Abschnitt "Cycle Wizard abgeschlossen"), Commit/Push auf UI-Refactoring.

**Vorsichtsmaßnahmen (Refactoring-Skill + AGENTS):**
- Keine Änderung an `CycleFormData`, `WorkoutDayData`, `BlueprintSetData`, Payload-Mapping oder API-Call.
- Dnd-Logik (dnd-kit), State-Management pro Step, currentDayIndex etc. unverändert.
- Modals bleiben (bereits migriert).
- Bei Blueprint-Cards: Die Edit-Logik (onUpdateSet etc.) bleibt, nur Styling + Komponenten (Card statt div, Input statt native, Badge + Tabler Icons statt hard colors + svg).
- Mobile-First, Accessibility (Labels, ARIA wo sinnvoll), Dark/Light via Tokens.
- Nach jedem größeren Schritt: eslint + tsc auf den Files, Commit mit klarer Message.

**Erwartetes Ergebnis:**
Der Zyklus-Wizard sieht aus und fühlt sich an wie der Rest der App (Workout-Start mit Steps + Modals, Template-Editor, History, Active-Screen): sera-Konsistenz, Card-basiert, Tabler, semantische Farben, einheitliche Navigation und Buttons. Funktional identisch, keine Regression bei Cycle-Erstellung oder Blueprint-Daten.

**Stand der Migration (Juni 2026):**
- Wrapper (cycle-wizard.tsx): Header, Progress, Error, Content-Card auf sera + shadcn.
- BasicInfoStep: shadcn Input/Label/Button, sera tokens.
- WorkoutDaysStep: Card per Tag, shadcn Input/Label/Button, semantic.
- ReviewStep: Card Summary + per Day, Badge, Tabler icons for set types, shadcn Buttons.
- BlueprintEditorStep (outer): Day tabs as Buttons, editor container, large + CTA, consistent nav Buttons, sera.
- blueprint-exercise-card.tsx: Card, Input, Label, Badge, Button, Tabler (Grip, Trash, Plus, Flame, Barbell).
- (WIP) blueprint-exercise-editor-card.tsx still legacy (next piece).
- Functionality unchanged (blueprint data, dnd per day, modals, submit payload identical).

**Nächste Schritte nach diesem:** Finish the editor-card styling, then consider deeper integration of the central ExerciseCard for blueprint editing (to remove the last duplication noted in the plan). Update this doc + commit.

---

**Hinweis:** Dieses Dokument ersetzt frühere informelle Phasen-Planungen aus dem Chat und dient als zentrale Referenz für den UI-Refactoring-Fortschritt. Der Cycle Wizard ist der logische nächste Kandidat nach der zentralen ExerciseCard und den Template-Integrationen.

---

## Technical Debt: Exercise Selection Modal – Name Search verursacht vollständiges Neuladen der Liste bei jedem Tastendruck (Juni 2026)

**Symptom (User-Report):**  
Beim Eintippen eines einzelnen Buchstabens im Suchfeld der `ExerciseSelectionModal` wird die gesamte Übungsliste nach jedem Buchstaben neu geladen / aktualisiert. Die Liste "springt" und das Modal fühlt sich instabil an, besonders auf Mobile beim Tippen.

**Status:** Nur analysiert. **Keine Implementierung vorgenommen.** Reine Dokumentation für zukünftige Behebung.

### Exakter Root Cause

Die Ursache liegt in einer direkten Kopplung von React-State-Änderungen an Netzwerk-Requests + aggressivem Loading-UI:

**apps/frontend/components/workout/exercise-selection-modal.tsx**

```tsx
const [search, setSearch] = useState('');
// ...
const [exercises, setExercises] = useState<Exercise[]>([]);
const [loading, setLoading] = useState(true);

const loadExercises = useCallback(async () => {
  setLoading(true);
  try {
    const data = await apiClient.getExercises({
      search: search || undefined,
      muscleGroup: muscleGroupFilter,
      equipment: equipmentFilter,
      includeCustom: true,
    });
    setExercises(data);   // kompletter Listen-Ersatz
  } finally {
    setLoading(false);
  }
}, [search, muscleGroupFilter, equipmentFilter]);  // ← neue Fn-Identity bei jedem change

useEffect(() => {
  loadExercises();
}, [loadExercises]);   // ← triggert bei jeder neuen loadExercises-Referenz
```

Such-Input (Zeile ~135):
```tsx
<Input
  value={search}
  onChange={(e) => setSearch(e.target.value)}   // direkt, ohne Debounce
  placeholder="Übung suchen..."
/>
```

**Ablauf bei jedem Buchstaben:**
1. `setSearch("b")` → Re-Render
2. `loadExercises` wird neu erzeugt (search ist Dep)
3. `useEffect([loadExercises])` feuert
4. `setLoading(true)` + `apiClient.getExercises({ search: "b", ... })`
5. Response → `setExercises(newArray)` + Liste wird komplett ersetzt
6. Wiederholen für "be", "ben", "bench"...

Dasselbe (leicht variiert) Muster existiert auch in:
- `apps/frontend/components/templates/exercises-tab.tsx:34-53` (useEffect direkt auf [search, filters])

### Backend

**apps/backend/src/exercises/exercises.service.ts:120-125**
```ts
if (search) {
  where.name = {
    contains: search,
    mode: 'insensitive',
  };
}
```

- Controller: `GET /exercises?search=...&muscleGroup=...&includeCustom=true`
- Kein Pagination, kein Caching, kein Debounce auf Server.
- Query trifft auf `Exercise` Tabelle (soft-delete via `deletedAt` + OR global + user-customs).

**Datenmenge:** Ca. 115 Basis-Übungen (aus `Exercises_premium.csv`) + beliebig viele Custom-Übungen des Users. Sehr klein → Client-seitiges Filtern wäre trivial performant.

### Warum besonders störend?

- Name-Suche ist **kontinuierliche Freitext-Eingabe** (hohe Frequenz).
- Muscle/Equipment-Filter sind diskrete Buttons (niedrige Frequenz) → dort ist Refetch weniger spürbar.
- `loading`-State ersetzt den gesamten Listenbereich (`{loading ? <div>Lädt Übungen...</div> : <Liste>}`).
- Keine Unterscheidung "Typing vs. Filter anwenden".
- `open`-Prop wird nur an `<Dialog>` weitergegeben – kein `if (open)` für initiales Laden oder Reset.
- Es gibt keinen globalen Exercise-Cache. Jede Modal-Instanz lädt selbst (auch wenn Elternteile schonmal alles geladen haben, z. B. in blueprint-editor-step oder template-editor).
- Kein AbortController, keine Beibehaltung der vorherigen Ergebnisse während des Tippens.

### Weitere Kontext-Beobachtungen

- Andere Stellen laden bereits einmalig das volle Set ohne `search` und nutzen die Liste nur zum Mappen (z. B. `blueprint-editor-step.tsx:68`, `template-editor-screen.tsx:102`, `review-step.tsx`).
- Beim Erstellen einer Custom-Exercise macht das Modal bereits ein optimistisches lokales Prepend (`setExercises((prev) => [exercise, ...prev])`) – gutes Vorbild.
- Es gibt aktuell **keine** Debounce/Throttle-Logik oder useDebounce im gesamten Frontend.
- Die Modal wird an vielen Orten genutzt: Active Workout, Replace in ExerciseCard, Templates, Cycles (Wizard + Detail), Analytics Exercise-Picker.

### Mögliche Stabilisierungs-Ansätze (für spätere Diskussion / Umsetzung)

1. **Debounce nur für die Namenssuche** (Server-Fetch bleibt)
   - Eigenen `debouncedSearch` State mit useEffect + Timeout (oder lib).
   - Nur den debounced Wert in die Deps von `loadExercises` packen.
   - Während des Tippens vorherige Liste sichtbar lassen + nur subtilen "sucht..." Hinweis (kein hartes Loading + Listen-Reset).

2. **Einmal laden + reines Client-Side Filtering** (empfohlen wegen kleiner N)
   - Beim Öffnen (oder einmal pro Session) volle Liste ohne `search` laden (`includeCustom: true`).
   - Vollständige Liste in State halten.
   - Sichtbare Liste via `useMemo` ableiten aus `(search, muscleGroupFilter, equipmentFilter)`.
   - Tippen wird instant, null Netzwerk während der Eingabe.
   - Nur bei Custom-Erstellung oder explizitem Refresh neu laden.

3. **Hybrid / geteilter Cache**
   - Exercise-Liste in einen wiederverwendbaren Hook / leichten Context / Ref-Cache auslagern.
   - Modal + andere Consumer lesen daraus und filtern client-seitig.
   - Invalidation nur bei neu erstelltem Custom oder nach Timeout.

4. **Vertragsänderung für Suche**
   - Suche nur bei Blur / Enter / dediziertem Button auslösen.
   - Oder festen kleinen Debounce (300 ms) + In-Flight-Request abbrechen.
   - Loading-State niemals bei reiner Namenseingabe aktivieren.

5. **UI-Stabilisierungen (kombinierbar)**
   - Liste während Name-Suche **nicht** unmounten.
   - Vorherige Ergebnisse sichtbar halten.
   - Scroll-Position erhalten.
   - Unterschiedliche Behandlung von Name-Suche vs. Filter-Buttons.

**Hinweis:** Muscle/Equipment-Filter können weiterhin unmittelbar fetchen. Nur die Freitext-Namenssuche sollte "stabil" sein.

### Betroffene Dateien (Stand Analyse)

- `apps/frontend/components/workout/exercise-selection-modal.tsx` (Hauptproblem)
- `apps/frontend/components/templates/exercises-tab.tsx` (identisches Muster)
- `apps/frontend/lib/api/client.ts` (getExercises)
- `apps/backend/src/exercises/exercises.service.ts` + `dto/filter-exercise.dto.ts`
- Aufrufer: active-workout-screen, exercise-card (Replace), template-editor, cycles/*, analytics

Diese Analyse basiert auf Code-Inspection (Juni 2026) und der User-Beobachtung. Kann als Basis für eine spätere Implementierung (idealerweise mit Debounce +/oder Client-Filter + Loading-Verbesserung) verwendet werden.

**Nächste Schritte bei Umsetzung (später):**
- Analyse mit User bestätigen.
- Kleine N → starke Präferenz für Client-Filter-Ansatz prüfen.
- Ähnliches Verhalten im Exercises-Tab gleich mit beheben.
- Nach Fix: Manuelle Tests auf Mobile (iOS/Android Tastatur + Typing-Feel).
- Dokumentation hier aktualisieren + ggf. in AGENTS.md oder Frontend-README referenzieren.

---

**Gesamt-Status (Juni 2026):** ExerciseSelectionModal ist funktional und wurde kürzlich um scrollbare separate Filter-Zeilen + X-Close-Button erweitert. Die Namenssuch-Instabilität bleibt als dokumentierter offener Punkt bestehen.