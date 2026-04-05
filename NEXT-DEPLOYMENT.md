# Next Production Deployment - Exercise Flags Update

**Datum:** 5. April 2026  
**Änderungen:** Bugfixes für Timer, grüne Übungsmarkierung, Exercise Flags Backend/Frontend

---

## 📝 Was wurde geändert

### 1. **Satzpausen-Bug Fix**
- Timer wird jetzt beim Loggen eines neuen Satzes korrekt neu gestartet
- localStorage wird mit neuem Timestamp überschrieben
- Alte Pause wird automatisch gestoppt

### 2. **Grüne Markierung für freie Workouts**
- Übungen in freien Workouts werden grün markiert wenn alle Sätze geloggt sind
- Logik funktioniert jetzt für geplante UND freie Workouts

### 3. **Exercise Flags (isUnilateral, isDoubleWeight)**
- Backend DTO erweitert: PersonalRecord enthält jetzt `isUnilateral` und `isDoubleWeight`
- Frontend zeigt PRs korrekt an: "20 Wdh. (10x2)" für unilaterale Übungen
- UI-Badges bereits implementiert: `Gewicht (kg) (2x)` und `Wdh (2x)`

### 4. **Datenbank-Update erforderlich**
⚠️ Zwei Übungen haben in der Production-DB falsche Flag-Werte:
- **Unilateral Kabel Latzug**: `isUnilateral` muss `true` sein (aktuell `false`)
- **Kurzhantel Bankdrücken**: `isDoubleWeight` muss `true` sein (aktuell `false`)

---

## 🚀 Deployment-Schritte

### Schritt 1: Git Deployment (Standard)
```bash
# Lokal committen und pushen
git add -A
git commit -m "fix: Satzpausen-Bug, freie Workout Markierung, Exercise Flags für PRs"
git push origin dev

# PR erstellen dev → main und mergen
```

### Schritt 2: Pi Deployment
```bash
# SSH auf Pi
ssh n1k0@n1k0blc-pi.local

# Ins Projekt-Verzeichnis
cd ~/apps/Workout-Tracker

# Backup erstellen
docker exec workout-tracker-db-prod pg_dump -U workoutuser workout_tracker | gzip > ~/backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Git pullen
git stash
git pull origin main

# Docker Container neu builden
chmod +x *.sh
./deploy.sh
```

### Schritt 3: ⚠️ WICHTIG - Exercise Flags Update Script ausführen

**Das Script muss NACH dem Deploy ausgeführt werden:**

```bash
# Auf dem Pi: Script in Container kopieren
docker cp ~/apps/Workout-Tracker/apps/backend/update-exercise-flags.ts workout-tracker-backend-prod:/app/apps/backend/

# Script im Container ausführen
docker exec -it workout-tracker-backend-prod sh -c "cd /app/apps/backend && npx tsx update-exercise-flags.ts"
```

**Erwartetes Output:**
```
🔄 Updating exercise flags...

✅ Updated Kurzhantel Bankdrücken: 1 records
✅ Updated Unilateral Kabel Latzug: 1 records

📊 Verification:
  - Unilateral Kabel Latzug: unilateral=true, doubleWeight=false
  - Kurzhantel Bankdrücken: unilateral=false, doubleWeight=true

✅ Done!
```

### Schritt 4: Verification

1. **Browser-Cache leeren** (wichtig!)
2. **Freies Workout starten**
3. **Übungen testen:**
   - **Kurzhantel Bankdrücken** hinzufügen → sollte `Gewicht (kg) (2x)` Label zeigen
   - **Unilateral Kabel Latzug** hinzufügen → sollte `Wdh (2x)` Label zeigen
4. **Sätze loggen und Timer prüfen:**
   - Ersten Satz loggen → Timer startet
   - Zweiten Satz loggen → Timer wird neu gestartet (alter Timer stoppt)
5. **PRs prüfen:**
   - Dashboard → Persönliche Rekorde Sektion
   - Bei unilateralen Übungen sollte stehen: "20 Wdh. (10x2)"

---

## 📋 Geänderte Dateien

### Backend
- `apps/backend/src/analytics/dto/personal-records.dto.ts`
- `apps/backend/src/analytics/analytics.service.ts`
- `apps/backend/update-exercise-flags.ts` (NEU)

### Frontend
- `apps/frontend/lib/workout-context.tsx`
- `apps/frontend/components/workout/exercise-card.tsx`
- `apps/frontend/types/index.ts`
- `apps/frontend/app/dashboard/page.tsx`

---

## 🔧 Troubleshooting

### Problem: Script findet @prisma/client nicht
```bash
# PATH korrigieren
docker exec -it workout-tracker-backend-prod sh -c "cd /app/apps/backend && NODE_PATH=/app/node_modules npx tsx update-exercise-flags.ts"
```

### Problem: Badges werden nicht angezeigt
1. Browser-Cache komplett leeren (Cmd+Shift+Delete)
2. Hard Reload (Cmd+Shift+R)
3. Prüfen ob Script erfolgreich lief (siehe Output oben)

### Problem: Alte Satzpause läuft weiter
1. localStorage manuell löschen: Browser DevTools → Application → Local Storage → alle Einträge löschen
2. Seite neu laden
3. Neues Workout starten

---

## ✅ Checkliste nach Deployment

- [ ] Backup erstellt
- [ ] Git gepullt (main branch)
- [ ] Docker Container neu gebaut
- [ ] Update-Script ausgeführt (siehe Output)
- [ ] Script-Datei aus Container entfernt: `docker exec workout-tracker-backend-prod rm /app/apps/backend/update-exercise-flags.ts`
- [ ] Browser-Cache geleert
- [ ] Kurzhantel Bankdrücken zeigt `Gewicht (kg) (2x)` ✅
- [ ] Unilateral Kabel Latzug zeigt `Wdh (2x)` ✅
- [ ] Timer startet neu bei jedem Satz ✅
- [ ] Freie Workouts werden grün bei Completion ✅
- [ ] PRs zeigen korrekte Wiederholungen (10x2) ✅

---

## 📌 Hinweise

- **Keine Prisma-Migration nötig** - nur Datenwerte werden aktualisiert
- **Keine Schema-Änderungen** - `isUnilateral` und `isDoubleWeight` Spalten existieren bereits
- **Script ist idempotent** - kann mehrfach ausgeführt werden ohne Schaden
- **Nur non-custom Übungen** werden aktualisiert (User-Custom-Exercises bleiben unberührt)

---

**Nach erfolgreichem Deployment diese Datei löschen oder archivieren.**
