# Deployment: Granulare Muskelgruppen-Verteilung

## Übersicht

Dieses Deployment fügt eine granulare Muskelgruppen-Verteilung mit 12 Muskelgruppen hinzu. Jede Übung hat nun eine prozentuale Verteilung über alle beteiligten Muskelgruppen (Summe muss 100% ergeben).

### Neue Muskelgruppen (12)
1. **Bauch** (ABDOMEN)
2. **Latissimus** (LATISSIMUS)
3. **Trapez** (TRAPEZIUS)
4. **Unterer Rücken** (LOWER_BACK)
5. **Beinbeuger** (HAMSTRINGS)
6. **Glutes** (GLUTES)
7. **Schultern** (SHOULDERS)
8. **Bizeps** (BICEPS)
9. **Brust** (CHEST)
10. **Quadrizeps** (QUADRICEPS)
11. **Waden** (CALVES)
12. **Trizeps** (TRICEPS)

### Legacy Muskelgruppen (7) - Bleiben für Kompatibilität
- CHEST, BACK, BICEPS, TRICEPS, ABS, SHOULDERS, LEGS

---

## Änderungen im Überblick

### Backend
✅ **Prisma Schema**
- 12 neue Spalten: `abdomenPercent`, `latissimusPercent`, etc. (alle INT mit Default 0)
- Erweitert: `MuscleGroup` Enum mit 8 neuen Werten

✅ **Seed Script** (`apps/backend/prisma/seed.ts`)
- Liest `Exercises_premium.csv` mit Semikolon-Separator
- Parst deutsche Muskelgruppen-Namen und Prozente ("45%" → 45)
- Validiert: Summe = 100%
- Migriert bestehende Custom Exercises: 100% auf Hauptmuskelgruppe

✅ **DTOs**
- `CreateExerciseDto`: 12 optionale Prozent-Felder (`@IsInt @Min(0) @Max(100)`)
- `UpdateExerciseDto`: 12 optionale Prozent-Felder
- `ExerciseDto`: 12 erforderliche Prozent-Felder

✅ **Exercise Service**
- `validateAndNormalizeMusclePercentages()`: Validiert Summe = 100%, setzt Default 100% auf Hauptmuskelgruppe
- `create/update`: Speichert alle 12 Prozent-Felder
- `findAll/findById`: Lädt alle 12 Prozent-Felder

✅ **Analytics Service**
- `distributeVolumeByMuscleGroups()`: Verteilt Volumen nach Prozent
- **Volumen**: `totalVolume * (percent / 100)` für jede Muskelgruppe
- **ORM%, RIR, RestTime, Reps, Sets**: NICHT mit Prozent multipliziert (direkte Werte)
- **Filter**: Übungen erscheinen NUR in Hauptmuskelgruppe, nicht in sekundären

### Frontend
✅ **Types** (`apps/frontend/types/index.ts`)
- Erweitert: `MuscleGroup` Enum (15 Werte total)
- Erweitert: `Exercise` Interface (12 Prozent-Felder required)
- Erweitert: `UpdateExerciseDto` (12 Prozent-Felder optional)

✅ **Helper Utilities** (`apps/frontend/lib/exercise-utils.ts`)
- `MUSCLE_GROUP_LABELS`: Deutsche Labels für alle 12 Muskelgruppen
- `getSecondaryMuscleGroups()`: Gibt sekundäre Muskeln mit >0% zurück
- `formatSecondaryMuscleGroups()`: Formatiert als "Trizeps 25%, Schultern 15%"
- `validateMusclePercentages()`: Prüft ob Summe = 100%
- `createIsolationPreset()`: Erstellt 100% auf einer Muskelgruppe

✅ **Create Exercise Modal** (`apps/frontend/components/exercises/create-exercise-modal.tsx`)
- Dropdown mit 12 neuen Muskelgruppen
- 12 Slider + Number Inputs für Prozent-Verteilung
- Preset-Buttons: "Isolation (100%)" + "Gleichmäßig"
- Live-Validierung: Progress Bar (Grün bei 100%, Rot/Orange sonst)
- Submit blockiert wenn Summe ≠ 100%

✅ **Edit Exercise Modal** (`apps/frontend/components/exercises/edit-exercise-modal.tsx`)
- Gleiche UI wie Create Modal
- Vorausgefüllt mit bestehenden Prozent-Werten

✅ **Analytics Filter** (`apps/frontend/app/analytics/page.tsx`)
- Filter-Dropdown zeigt 12 neue Muskelgruppen
- `translateMuscleGroup()` Funktion aktualisiert mit deutschen Labels

---

## Deployment-Schritte

### ⚠️ WICHTIG: Deployment nachts durchführen (minimale User-Aktivität)

### 1. Lokale Vorbereitung

```bash
# Wechsel zu dev Branch
cd ~/Projects/Workout-Tracker
git checkout dev

# Prüfe dass alle Änderungen committed sind
git status
git log --oneline -5

# Erstelle PR dev → main
# (GitHub UI oder: gh pr create --base main --head dev --title "Feature: Granulare Muskelgruppen-Verteilung")
```

### 2. Code-Review & Merge

- PR auf GitHub reviewen
- Tests überprüfen (falls vorhanden)
- **Nach Approval**: Merge PR in `main`

### 3. Lokale Tests (Optional aber empfohlen)

```bash
# Lokale Docker Container starten
docker-compose up -d

# Prisma Migration durchführen (lokal)
cd apps/backend
npx prisma migrate dev --name add_muscle_group_percentages

# Seed Script ausführen (importiert Exercises_premium.csv)
npm run seed

# Frontend testen
# → Custom Exercise erstellen und Prozent-Verteilung testen
# → Analytics prüfen: Volumen-Verteilung
# → Filter prüfen: 12 neue Muskelgruppen sichtbar

# Container stoppen
docker-compose down
```

### 4. Deployment auf Raspberry Pi (über Tailscale VPN)

```bash
# SSH zu Raspberry Pi über Tailscale
ssh n1k0@100.126.189.87

# Zum Projekt-Verzeichnis
cd ~/apps/Workout-Tracker

# Pullen von main Branch
git fetch origin
git checkout main
git pull origin main

# Prüfe dass die neuen Files vorhanden sind
ls -la Exercises_premium.csv
cat apps/backend/prisma/schema.prisma | grep "abdomenPercent"

# Backend Container stoppen
docker stop workout-tracker-backend-prod

# Prisma Migration durchführen
cd apps/backend
docker run --rm \
  -v $(pwd)/prisma:/app/prisma \
  --network workout-tracker-network \
  -e DATABASE_URL="postgresql://workout_user:workout_pass@postgres-prod:5432/workout_tracker" \
  workout-tracker-backend:latest \
  npx prisma migrate deploy

# Seed Script ausführen (importiert Premium Exercises)
docker run --rm \
  -v $(pwd)/prisma:/app/prisma \
  -v $(pwd)/../../Exercises_premium.csv:/app/Exercises_premium.csv \
  --network workout-tracker-network \
  -e DATABASE_URL="postgresql://workout_user:workout_pass@postgres-prod:5432/workout_tracker" \
  workout-tracker-backend:latest \
  npm run seed

# Rebuild & Restart alle Container
cd ~/apps/Workout-Tracker
./deploy.sh

# Logs prüfen
docker logs -f workout-tracker-backend-prod
# → Suche nach "Migration successful" oder Errors
```

### 5. Post-Deployment Tests

```bash
# Öffne Frontend im Browser
# http://100.126.189.87:3000 (über Tailscale)

# Tests:
# ✅ Custom Exercise Modal: 12 Muskelgruppen sichtbar
# ✅ Prozent-Verteilung UI funktioniert (Slider + Input)
# ✅ Validation: Submit nur wenn Summe = 100%
# ✅ Analytics: Filter zeigt 12 neue Muskelgruppen
# ✅ Analytics: Volumen-Verteilung korrekt (Check DB)

# Backend Logs bei Fehlern
docker logs workout-tracker-backend-prod --tail 100

# DB-Inspektion (falls nötig)
docker exec -it postgres-prod psql -U workout_user -d workout_tracker
# SELECT name, "muscleGroup", "abdomenPercent", "chestPercent" FROM "Exercise" LIMIT 5;
# \q
```

### 6. Rollback (Falls Probleme)

```bash
# SSH zu Pi
ssh n1k0@100.126.189.87
cd ~/apps/Workout-Tracker

# Git Rollback zu vorherigem Commit
git log --oneline -5
git reset --hard <previous-commit-hash>

# Prisma Migration Rollback (VORSICHT: Datenverlust!)
cd apps/backend
npx prisma migrate resolve --rolled-back <migration-name>

# Container neu builden
cd ~/apps/Workout-Tracker
./deploy.sh

# Logs prüfen
docker logs -f workout-tracker-backend-prod
```

---

## Datenbank-Migration Details

### Migration Name
```
add_muscle_group_percentages
```

### Schema Changes
```prisma
model Exercise {
  // ... existing fields
  
  // New percentage fields
  abdomenPercent    Int @default(0)
  latissimusPercent Int @default(0)
  trapeziusPercent  Int @default(0)
  lowerBackPercent  Int @default(0)
  hamstringsPercent Int @default(0)
  glutesPercent     Int @default(0)
  shouldersPercent  Int @default(0)
  bicepsPercent     Int @default(0)
  chestPercent      Int @default(0)
  quadricepsPercent Int @default(0)
  calvesPercent     Int @default(0)
  tricepsPercent    Int @default(0)
}

enum MuscleGroup {
  // Legacy (kept for compatibility)
  CHEST
  BACK
  BICEPS
  TRICEPS
  ABS
  SHOULDERS
  LEGS
  
  // New granular groups
  ABDOMEN
  LATISSIMUS
  TRAPEZIUS
  LOWER_BACK
  HAMSTRINGS
  GLUTES
  QUADRICEPS
  CALVES
}
```

### Seed Script Behavior
1. **Premium Exercises** (aus `Exercises_premium.csv`):
   - Importiert mit exakten Prozent-Werten aus CSV
   - Validiert: Summe = 100%
   - Warnung bei Abweichung

2. **Custom Exercises** (bestehende user-created):
   - Setzt 100% auf `muscleGroup` (Hauptmuskelgruppe)
   - Alle anderen Prozente = 0%
   - Logs: "Migrated X custom exercises"

---

## Monitoring & Logging

### Was zu beobachten ist

**Backend Logs:**
```bash
docker logs -f workout-tracker-backend-prod
```
- ✅ "Migration successful"
- ✅ "Seeded X exercises from CSV"
- ✅ "Migrated X custom exercises"
- ❌ "Percentage sum is not 100%" (sollte nicht vorkommen)

**Database:**
```sql
-- Prüfe dass alle Exercises Prozente haben
SELECT COUNT(*) FROM "Exercise" WHERE 
  "abdomenPercent" + "latissimusPercent" + "trapeziusPercent" + 
  "lowerBackPercent" + "hamstringsPercent" + "glutesPercent" +
  "shouldersPercent" + "bicepsPercent" + "chestPercent" +
  "quadricepsPercent" + "calvesPercent" + "tricepsPercent" = 100;

-- Sollte = Total Exercise Count sein
```

**Frontend:**
- Custom Exercise Modal lädt ohne Fehler
- Validation funktioniert (Submit disabled bei ≠ 100%)
- Analytics Filter zeigt 12 Muskelgruppen
- Keine Console Errors im Browser DevTools

---

## Bekannte Einschränkungen

1. **Historische Daten**: Bestehende Workout-Logs behalten ihre alte `muscleGroup` Zuordnung. Nur **neue** Logs verwenden die granulare Verteilung.

2. **Legacy Enum Values**: Die alten 7 Muskelgruppen (CHEST, BACK, etc.) bleiben im Enum für Backwards-Compatibility. Sie sollten aber nicht mehr für neue Exercises verwendet werden.

3. **CSV Format**: `Exercises_premium.csv` muss exakt das Format haben:
   - Semikolon-Separator (`;`)
   - Spalten: `Name;Muskelgruppe;Equipment;Bauch;Latissimus;...` (alle 12 Muskeln)
   - Prozente als String mit `%`: `"45%"` (nicht `45`)

4. **Validation**: Backend validiert Summe = 100%, aber Frontend sollte das vor Submit bereits sicherstellen.

---

## Support & Troubleshooting

### Problem: Migration schlägt fehl
**Lösung:**
```bash
# Check Prisma Schema Syntax
cd apps/backend
npx prisma validate

# Check DB Connection
npx prisma db execute --stdin <<< "SELECT 1;"

# Manual Migration (falls nötig)
npx prisma db push --skip-generate
```

### Problem: Seed Script Fehler "CSV not found"
**Lösung:**
```bash
# Prüfe dass CSV im Root liegt
ls -la /Users/n1k0/Projects/Workout-Tracker/Exercises_premium.csv

# Check CSV Encoding (muss UTF-8 sein)
file -I Exercises_premium.csv

# Check erste Zeile
head -1 Exercises_premium.csv
```

### Problem: Frontend zeigt alte Muskelgruppen
**Lösung:**
```bash
# Hard Refresh Browser (Cmd+Shift+R)
# Clear Browser Cache
# Check dass Frontend neu gebaut wurde:
docker logs workout-tracker-frontend-prod | grep "compiled"
```

### Problem: Validation Error "Percentages must sum to 100%"
**Lösung:**
- Prüfe dass alle 12 Felder im Request vorhanden sind
- Prüfe dass Summe exakt 100 ist (nicht 99.99 oder 100.01)
- Check Backend Logs für Details

---

## Kontakt

Bei Problemen:
1. Check Docker Logs: `docker logs workout-tracker-backend-prod`
2. Check DB: `docker exec -it postgres-prod psql ...`
3. Check GitHub Issues für ähnliche Probleme
4. Rollback falls nötig (siehe oben)

**Geschätzte Deployment-Dauer:** 15-20 Minuten (inkl. Tests)
**Downtime:** ~2-3 Minuten (während Container Restart)
