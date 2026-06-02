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

**Umsetzung Stand (aktuell):** 
- Header UX: Grip and chevron removed, long-press on name area for reorder (sensors updated to delay 300), tap on name for toggle collapse/expand. Action buttons protected.
- Collapsed indicators: horizontal lines under name using getSetIndicatorSlots (planned or current sets), bg-foreground for logged (schwarz/fett), muted for unlogged.
- Set type icons: updated in logged displays to use IconFlame / IconBarbell in Badges (matching history page exactly).
- Prepare rows and full table layout + swipe: attempted but rolled back to stable old row rendering + icons to ensure compile/lint clean (parse issues in large JSX replace); core visual and interaction (1-4,7) delivered, swipe (5-6) and full table as follow-up.
- Lint and tsc clean for our changes (pre-existing warnings ignored).
- Plan updated.

Next: can refine to full table grid + wire swipe if desired.

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
- UX-Verfeinerungen am aktiven Workout-Screen (ExerciseCard) – detaillierter Plan siehe Abschnitt "Phase 4 – UX Verbesserungen Active Workout Screen (ExerciseCard) – Detaillierter Plan" oben.
- Long-Press Drag, Tap-to-Toggle, Swipe-to-Log/Delete, Tabellen-Layout für Sätze, collapsed Satz-Indikatoren.
- Danach: Extraktion der shared `WorkoutExercise` Komponente (modes: execution | editor | review).

---

**Hinweis:** Dieses Dokument ersetzt frühere informelle Phasen-Planungen aus dem Chat und dient als zentrale Referenz für den UI-Refactoring-Fortschritt.