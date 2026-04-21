# Multi-Filter Analytics Implementation Plan

## 📋 Überblick

Implementierung eines Multi-Select-Filter-Systems für die Analytics-Page, das es ermöglicht, mehrere Filter gleichzeitig zu aktivieren und die Ergebnisse in einem kombinierten Chart darzustellen.

## 🎯 Anforderungen

### Hauptziel
Mehrere Auswertungen in einem Graphen anzeigen können.

**Beispiel:**
- Volumen & Wiederholungen für Muskelgruppe Brust und Equipment "Alle" in einem Chart mit entsprechender Legende

### Verfügbarkeit
- ✅ Zeit-Modus (nicht-Zyklus)
- ✅ Zyklus-Modus

## 🔢 Filter-Limits

### Grundregel
- Jeder Filter kann **maximal 3** Auswahlen haben
- **Absolute Obergrenze: 6 Linien** im Chart (Produkt aller Filter ≤ 6)

### Dynamische Limits-Berechnung
```javascript
maxAllowed(Filter) = Math.min(3, Math.floor(6 / (otherFilter1.count × otherFilter2.count)))
```

## 📊 Filter-Szenarien

### Szenario 1: Start bei Ansicht
```
Ansicht: 3 gewählt (z.B. Volumen, Reps, Sets)
  → Berechnung: 3 × ? × ? ≤ 6
  → Muskel: max 2 erlaubt (3×2=6)
  → Equipment: nur "Alle" (count=1) möglich
  
Verhalten:
  - Bei 2. Muskel-Auswahl: Andere Muskel-Buttons werden ausgegraut
  - Equipment-Buttons außer "Alle": ausgegraut
```

### Szenario 2: Start bei Muskelgruppe
```
Muskel: 3 gewählt (z.B. Brust, Rücken, Schultern)
  → Berechnung: ? × 3 × ? ≤ 6
  → Ansicht: max 2 erlaubt (2×3=6)
  → Equipment: nur "Alle" (count=1) möglich
  
Verhalten:
  - Bei 2. Ansicht-Auswahl: Andere Ansicht-Buttons werden ausgegraut
  - Equipment-Buttons außer "Alle": ausgegraut
```

### Szenario 3: Start bei Equipment
```
Equipment: 3 gewählt (z.B. Hantel, Kabel, Maschine)
  → Berechnung: ? × ? × 3 ≤ 6
  → Muskel: max 2 erlaubt (2×3=6)
  → Ansicht: nur 1 erlaubt (1×2×3=6)
  
Verhalten:
  - Bei 2. Muskel-Auswahl: Andere Muskel-Buttons werden ausgegraut
  - Ansicht: RADIO-BUTTON VERHALTEN
    - Klick auf neuen Filter deselektiert automatisch den vorherigen
    - KEIN Ausgrauen (da kein "Alle" Modus vorhanden)
```

## 🏷️ Chart-Benennung

### Format
```
{Ansicht} - {Muskelgruppe} - {Equipment}
```

### Logik
- Equipment nur anzeigen wenn NICHT "Alle"
- Muskelgruppe nur anzeigen wenn NICHT "Alle"

### Beispiele

**Beispiel 1:**
```
Filter:
  Ansicht: Volumen, ORM%, Sätze
  Muskel: Brust, Rücken
  Equipment: Alle

Linien (6):
  - Volumen - Brust
  - Volumen - Rücken
  - ORM% - Brust
  - ORM% - Rücken
  - Sätze - Brust
  - Sätze - Rücken
```

**Beispiel 2:**
```
Filter:
  Ansicht: Volumen
  Muskel: Alle
  Equipment: Hantel, Kabel, Maschine

Linien (3):
  - Volumen - Hantel
  - Volumen - Kabel
  - Volumen - Maschine
```

**Beispiel 3:**
```
Filter:
  Ansicht: Volumen, Reps
  Muskel: Brust
  Equipment: Hantel, Kabel

Linien (4):
  - Volumen - Brust - Hantel
  - Volumen - Brust - Kabel
  - Reps - Brust - Hantel
  - Reps - Brust - Kabel
```

## 🎨 UI/UX Design

### Button-States
1. **Aktiv (ausgewählt):** `bg-blue-600 text-white`
2. **Inaktiv:** `bg-white text-gray-700 border border-gray-300 hover:bg-gray-50`
3. **Disabled:** `opacity-50 cursor-not-allowed` (ausgegraut, nicht klickbar)

### Multi-Select Verhalten
- Mehrere Buttons können gleichzeitig blau sein
- Kein "Clear All" Button erforderlich
- Buttons zeigen durch blaue Farbe aktiven Zustand

### Spezial-Verhalten: Ansicht bei Limit 1
Wenn nur 1 Ansicht erlaubt ist:
- **Kein Ausgrauen** der anderen Buttons
- **Radio-Button Logik:** Klick auf neuen Filter deselektiert automatisch den alten
- Immer genau 1 Ansicht aktiv

## ⚠️ Bestehende Restriktionen (bleiben erhalten)

### 1. Dauer-Filter
```
Regel: Dauer-Ansicht erfordert Muskel=Alle UND Equipment=Alle

Grund: Workout-Dauer bezieht sich immer auf das gesamte Workout
```

**Verhalten:**
- Bei Auswahl von "Dauer" → Automatisch Muskel="Alle" UND Equipment="Alle" setzen
- Oder: Fehlermeldung anzeigen wenn andere Filter aktiv

### 2. RIR-Chart
```
Regel: RIR bleibt Balkendiagramm (BarChart)

Grund: Bestehende Darstellung soll beibehalten werden
```

**Verhalten:**
- RIR nutzt weiterhin BarChart statt LineChart
- Auch bei Multi-Filter

## 🔧 Backend-Implementierung

### API-Änderungen

#### Vor (Single-Select)
```typescript
GET /analytics/volume?muscleGroup=CHEST&equipment=DUMBBELL
```

#### Nach (Multi-Select)
```typescript
GET /analytics/volume?muscleGroup=CHEST&muscleGroup=BACK&equipment=DUMBBELL
```

### Controller-Änderungen

```typescript
// Vor
@Query('muscleGroup') muscleGroup?: string

// Nach
@Query('muscleGroup') muscleGroup?: string | string[]
```

### Service-Änderungen

```typescript
// Parameter normalisieren
const muscleGroups = Array.isArray(muscleGroup) ? muscleGroup : muscleGroup ? [muscleGroup] : [];
const equipments = Array.isArray(equipment) ? equipment : equipment ? [equipment] : [];

// Für jeden Filter separate Query ausführen
// ODER: WHERE ... IN (muscleGroups)
```

### Betroffene Endpoints

Alle Analytics-Endpoints müssen angepasst werden:
- ✅ `/analytics/volume`
- ✅ `/analytics/reps`
- ✅ `/analytics/sets`
- ✅ `/analytics/duration`
- ✅ `/analytics/rest-time`
- ✅ `/analytics/rir`
- ✅ `/analytics/orm-by-cycle/:cycleId` (nur Zyklus-Modus)
- ✅ `/analytics/reps-by-cycle/:cycleId`
- ✅ `/analytics/sets-by-cycle/:cycleId`
- ✅ `/analytics/duration-by-cycle/:cycleId`
- ✅ `/analytics/rest-time-by-cycle/:cycleId`
- ✅ `/analytics/rir-by-cycle/:cycleId`

## 💻 Frontend-Implementierung

### State-Änderungen

#### Vor (Single-Select)
```typescript
const [viewMode, setViewMode] = useState<string>('volume');
const [muscleFilter, setMuscleFilter] = useState<MuscleGroup | undefined>();
const [equipmentFilter, setEquipmentFilter] = useState<Equipment | undefined>();
```

#### Nach (Multi-Select)
```typescript
const [selectedViews, setSelectedViews] = useState<string[]>(['volume']);
const [selectedMuscles, setSelectedMuscles] = useState<(MuscleGroup | 'ALL')[]>(['ALL']);
const [selectedEquipment, setSelectedEquipment] = useState<(Equipment | 'ALL')[]>(['ALL']);
```

### Limit-Berechnung

```typescript
const calculateMaxAllowed = (
  filterType: 'view' | 'muscle' | 'equipment'
): number => {
  const viewCount = selectedViews.length || 1;
  const muscleCount = selectedMuscles.length || 1;
  const equipmentCount = selectedEquipment.length || 1;
  
  let max;
  switch (filterType) {
    case 'view':
      max = Math.floor(6 / (muscleCount * equipmentCount));
      break;
    case 'muscle':
      max = Math.floor(6 / (viewCount * equipmentCount));
      break;
    case 'equipment':
      max = Math.floor(6 / (viewCount * muscleCount));
      break;
  }
  
  return Math.min(3, max);
};
```

### Button-Logik

```typescript
const handleViewClick = (view: string) => {
  const maxAllowed = calculateMaxAllowed('view');
  
  if (selectedViews.includes(view)) {
    // Deselektieren
    setSelectedViews(selectedViews.filter(v => v !== view));
  } else {
    // Selektieren
    if (maxAllowed === 1) {
      // Radio-Button Verhalten
      setSelectedViews([view]);
    } else if (selectedViews.length < maxAllowed) {
      setSelectedViews([...selectedViews, view]);
    }
    // Sonst: Button ist disabled, Click hat keine Wirkung
  }
};

const isViewDisabled = (view: string) => {
  if (selectedViews.includes(view)) return false; // Aktive immer enabled
  const maxAllowed = calculateMaxAllowed('view');
  return selectedViews.length >= maxAllowed;
};
```

### Data Fetching

```typescript
const loadAnalyticsData = async () => {
  const promises = [];
  
  // Für jede Kombination von Filtern ein API-Call
  for (const view of selectedViews) {
    for (const muscle of selectedMuscles) {
      for (const equipment of selectedEquipment) {
        promises.push(
          apiClient.getAnalytics(view, {
            muscleGroup: muscle === 'ALL' ? undefined : muscle,
            equipment: equipment === 'ALL' ? undefined : equipment,
            // ... andere Parameter
          })
        );
      }
    }
  }
  
  const results = await Promise.all(promises);
  
  // Ergebnisse kombinieren für Chart
  const combinedData = combineAnalyticsData(results);
  setChartData(combinedData);
};
```

### Chart-Rendering

```typescript
interface ChartLine {
  dataKey: string; // z.B. "volume-chest-dumbbell"
  name: string;    // z.B. "Volumen - Brust - Hantel"
  color: string;   // z.B. "#3b82f6"
  data: DataPoint[];
}

const renderMultiLineChart = (lines: ChartLine[]) => {
  return (
    <LineChart data={mergedDataPoints}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="date" />
      <YAxis />
      <Tooltip />
      <Legend />
      {lines.map(line => (
        <Line
          key={line.dataKey}
          dataKey={line.dataKey}
          name={line.name}
          stroke={line.color}
          strokeWidth={2}
        />
      ))}
    </LineChart>
  );
};
```

### Farb-Schema

```typescript
const CHART_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#6366f1', // indigo
];

// Farbe basierend auf Index zuweisen
const getLineColor = (index: number) => {
  return CHART_COLORS[index % CHART_COLORS.length];
};
```

## 📝 Implementierungs-Reihenfolge

### Phase 1: Backend (Analytics Service & Controller)
1. [ ] Controller: Query-Parameter von `string` auf `string | string[]` ändern
2. [ ] Service: Array-Normalisierung implementieren
3. [ ] Service: Multi-Filter-Logik in WHERE-Clauses
4. [ ] Alle betroffenen Endpoints anpassen (volume, reps, sets, duration, restTime, rir)
5. [ ] Cycle-Mode Endpoints anpassen

### Phase 2: Frontend State & Logik
1. [ ] State auf Arrays umstellen (`selectedViews`, `selectedMuscles`, `selectedEquipment`)
2. [ ] `calculateMaxAllowed()` Funktion implementieren
3. [ ] Button-Handler für Multi-Select implementieren
4. [ ] `isDisabled()` Logik implementieren
5. [ ] Radio-Button Verhalten für Ansicht bei Limit=1

### Phase 3: Data Fetching
1. [ ] API-Client: Methoden für Array-Parameter anpassen
2. [ ] Parallel Fetching für alle Filter-Kombinationen
3. [ ] Daten-Kombination/Merge-Logik
4. [ ] Label-Generierung für Linien

### Phase 4: Chart Rendering
1. [ ] Multi-Line Chart-Komponente
2. [ ] Dynamische Farb-Zuweisung
3. [ ] Legende mit allen aktiven Filtern
4. [ ] RIR-Sonderfall (Balkendiagramm)
5. [ ] Dauer-Validierung (nur mit Alle/Alle)

### Phase 5: Testing & Refinement
1. [ ] Alle Szenarien testen (Start bei Ansicht/Muskel/Equipment)
2. [ ] Limit-Berechnung validieren
3. [ ] Radio-Button Verhalten testen
4. [ ] Chart-Lesbarkeit mit 6 Linien prüfen
5. [ ] Error-Handling & Edge-Cases

## 🧪 Test-Szenarien

### Test 1: Maximale Auslastung
```
Ansicht: 3 (Volumen, Reps, Sets)
Muskel: 2 (Brust, Rücken)
Equipment: Alle
→ Erwartet: 6 Linien im Chart
```

### Test 2: Equipment-First
```
Equipment: 3 (Hantel, Kabel, Maschine)
Muskel: 2 (Brust, Schultern)
→ Ansicht-Buttons außer aktiver ausgegraut? NEIN, Radio-Verhalten!
→ Erwartet: 6 Linien
```

### Test 3: Dynamisches Limit
```
1. Ansicht: 1 (Volumen)
2. Muskel: 1 (Brust)
   → Equipment: max 3 verfügbar? JA (1×1×3=3 ≤ 6)
3. Equipment: 3 auswählen (Hantel, Kabel, Maschine)
4. Versuch 2. Muskel zu wählen
   → Sollte möglich sein? JA (1×2×3=6)
5. Nach 2. Muskel-Auswahl
   → Andere Muskel-Buttons disabled? JA
```

### Test 4: Dauer-Validierung
```
Ansicht: Dauer
→ Muskel und Equipment automatisch auf "Alle"? Oder Error?
```

### Test 5: Radio-Button Szenario
```
Equipment: 3 (Hantel, Kabel, Maschine)
Muskel: 2 (Brust, Rücken)
Ansicht: Volumen ausgewählt
→ Klick auf "Reps"
→ Erwartet: Volumen deselektiert, Reps selektiert
→ Keine Ausgegraut-Buttons bei Ansicht
```

## 📚 Offene Fragen

- [ ] Soll "Alle" als separate Option klickbar sein oder ist es der Default-State?
  - **Antwort:** "Alle" ist klickbar wie jeder andere Filter
  
- [ ] Was passiert wenn User alle Filter deselektiert?
  - **Antwort:** Mindestens 1 Filter muss aktiv sein (Default: Volumen, Alle, Alle)
  
- [ ] Sollen wir einen Toast/Warning zeigen wenn Limit erreicht ist?
  - **Antwort:** Nein, disabled Buttons sind ausreichend

## 🎯 Erfolgs-Kriterien

- ✅ Maximal 6 Linien im Chart gleichzeitig
- ✅ Dynamische Limits basierend auf Auswahl
- ✅ Buttons werden korrekt disabled/enabled
- ✅ Radio-Button Verhalten bei Ansicht wenn Limit=1
- ✅ Klare, lesbare Legende mit allen Filter-Kombinationen
- ✅ Funktioniert in Zeit-Modus und Zyklus-Modus
- ✅ Backend akzeptiert Array-Parameter
- ✅ Performance: Parallele API-Calls statt sequentiell

---

**Erstellt:** 21. April 2026  
**Status:** In Planung  
**Nächster Schritt:** Phase 1 - Backend Implementation
