# Next Production Deployment - Multi-HomeGym System & Exercise Flags

**Datum:** 5. April 2026  
**Änderungen:** 
- **BREAKING CHANGE**: Multi-HomeGym System (ersetzt GymLocation enum)
- Erweiterte User-Profile (Vorname, Nachname, Geburtsdatum, Größe, Gewicht)
- Bugfixes für Timer, grüne Übungsmarkierung, Exercise Flags

⚠️ **ACHTUNG: Dieses Deployment enthält Breaking Changes und erfordert Datenmigration!**

---

## 📝 Was wurde geändert

### 🔥 BREAKING CHANGES: Multi-HomeGym System

#### Datenbank-Änderungen
- **ENTFERNT**: `Workout.gymLocation` Spalte (enum HOME/OTHER)
- **ENTFERNT**: `GymLocation` enum komplett
- **NEU**: `HomeGym` Tabelle mit User-Relation
- **NEU**: `Workout.homeGymId` (nullable FK zu HomeGym)
- **NEU**: `WorkoutDay.plannedHomeGymId` (nullable FK zu HomeGym)
- **NEU**: User-Profil Felder (firstName, lastName, dateOfBirth, height, weight)

#### Backend API Änderungen
- **Registration**: Erfordert jetzt Profil-Daten + mindestens 1 HomeGym
- **Workout Start**: `gymLocation` → `homeGymId` (optional)
- **Analytics/PRs**: Nur noch Home-Gym-Workouts (`homeGymId !== null`)
- **NEU**: HomeGym CRUD Endpoints (`/users/home-gyms`)
  - `GET /users/home-gyms` - Liste aller HomeGyms
  - `POST /users/home-gyms` - Neues Gym erstellen
  - `PUT /users/home-gyms/:id` - Gym umbenennen
  - `DELETE /users/home-gyms/:id` - Gym löschen (geschützt)

#### Migration erforderlich!
⚠️ **Alle existierenden User und Workouts müssen migriert werden:**
1. Standard-HomeGym "Mein Home Gym" für alle User erstellen
2. Alle existierenden Workouts → `homeGymId` auf User's erstes HomeGym setzen
3. Alle WorkoutDays → `plannedHomeGymId` auf Cycle-Owner's erstes HomeGym

---

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

### ⚠️ WICHTIG: Vorbereitung

**Dieses Deployment enthält Breaking Changes! Bitte genau diese Schritte befolgen:**

1. ✅ Maintenance-Fenster einplanen (~15-30 Minuten Downtime)
2. ✅ Alle aktiven User informieren
3. ✅ Production Backup erstellen (siehe unten)
4. ✅ Migration lokal testen (auf Staging/Dev)

---

### Schritt 0: Pre-Deployment Testing (auf Dev-System)

```bash
# Lokal: Migration Script testen
cd apps/backend
npx tsx migrate-home-gyms.ts

# Erwartetes Output prüfen (siehe unten)
```

---

### Schritt 1: Backup erstellen (KRITISCH!)

```bash
# SSH auf Pi
ssh n1k0@n1k0blc-pi.local

# DOPPELTES Backup zur Sicherheit
cd ~/apps/Workout-Tracker

# Backup 1: Automatisches Backup Script
./backup.sh

# Backup 2: Manuelles PostgreSQL Dump
docker exec workout-tracker-db-prod pg_dump -U workoutuser workout_tracker | gzip > ~/backup_pre_homegym_$(date +%Y%m%d_%H%M%S).sql.gz

# Backups verifizieren
ls -lh ~/*.sql.gz
# Sollte mindestens 2 aktuelle Backups zeigen
```

---

### Schritt 2: Git Deployment

```bash
# Lokal committen und pushen
git add -A
git commit -m "feat: Multi-HomeGym System, erweiterte User-Profile, Exercise Flags"
git push origin dev

# PR erstellen dev → main und mergen auf GitHub
# WARTEN bis CI erfolgreich (wenn vorhanden)
```

---

### Schritt 3: Pi Deployment & Docker Build

```bash
# SSH auf Pi (falls nicht schon verbunden)
ssh n1k0@n1k0blc-pi.local

# Ins Projekt-Verzeichnis
cd ~/apps/Workout-Tracker

# Aktuellen Stand sichern
git stash

# Main branch pullen
git checkout main
git pull origin main

# Docker Container stoppen (Downtime beginnt hier!)
docker-compose -f docker-compose.prod.yml down

# Container neu builden (dauert ~2-5 Minuten)
docker-compose -f docker-compose.prod.yml build --no-cache

# Container starten OHNE -d (um Logs zu sehen)
docker-compose -f docker-compose.prod.yml up
```

**In neuem Terminal-Fenster weiter (Pi offen lassen für Logs):**

---

### Schritt 4: ⚠️ KRITISCH - Prisma Migrations ausführen

```bash
# Neues SSH Terminal
ssh n1k0@n1k0blc-pi.local

# Prüfe ob Container läuft
docker ps | grep workout-tracker-backend-prod

# Prisma Migration Status prüfen
docker exec workout-tracker-backend-prod npx prisma migrate status

# Migration ausführen (20260405195941_add_user_profile_and_home_gyms)
docker exec workout-tracker-backend-prod npx prisma migrate deploy
```

**Erwartetes Output:**
```
The following migration(s) have been applied:

migrations/
  └─ 20260405195941_add_user_profile_and_home_gyms/
    └─ migration.sql

All migrations have been successfully applied.
```

❌ **Falls Fehler:** SOFORT zu Schritt 9 (Rollback) springen!

---

### Schritt 5: ⚠️ KRITISCH - Daten-Migration ausführen

```bash
# Migration über npm script (empfohlen)
docker exec -w /app/apps/backend workout-tracker-backend-prod npm run migrate:home-gyms

# Alternative: Direkt mit ts-node
# docker exec -w /app/apps/backend workout-tracker-backend-prod npx ts-node migrate-home-gyms.ts
```

**Erwartetes Output:**
```
🔄 Starting HomeGym Migration...

📍 Step 1: Creating default HomeGyms for users...
   Found X users without HomeGyms
   ✅ Created default gym for user@example.com
   ✓ Created X default HomeGyms

📍 Step 2: Migrating workouts to HomeGym system...
   Found Y workouts to migrate
   ✓ Migrated Y workouts to user's home gym
   ✓ 0 workouts kept as "other gym" (homeGymId=null)

📍 Step 3: Migrating workout days to planned gyms...
   Found Z workout days to migrate
   ✓ Migrated Z workout days to planned gym

📊 Verification:
   Users: X/X have HomeGyms
   Workouts: Y/Y assigned to HomeGym
   Workout Days: Z/Z have planned gym

✅ Migration completed successfully!
```

❌ **Falls Fehler oder Warnings:** SOFORT zu Schritt 9 (Rollback) springen!

---

### Schritt 6: Exercise Flags Update Script ausführen

```bash
# Exercise Flags über npm script (empfohlen)
docker exec -w /app/apps/backend workout-tracker-backend-prod npm run migrate:exercise-flags

# Alternative: Direkt mit ts-node
# docker exec -w /app/apps/backend workout-tracker-backend-prod npx ts-node update-exercise-flags.ts
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

---

### Schritt 7: Verification & Health Check

```bash
# Container Status prüfen
docker ps

# Backend Logs prüfen (auf Fehler achten!)
docker logs workout-tracker-backend-prod --tail 50

# Database Connection Check
docker exec workout-tracker-backend-prod npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM \"User\";"

# Health Check via API
curl http://localhost:4000/health
# Sollte: {"status":"ok"} zurückgeben
```

**Manuelle Tests (Browser):**
1. ✅ App öffnet ohne Fehler
2. ✅ Login funktioniert
3. ✅ Dashboard lädt
4. ✅ Workouts anzeigen funktioniert
5. ✅ Analytics/PRs werden angezeigt

---

### Schritt 8: Container im Hintergrund laufen lassen

```bash
# Falls alles OK: Ersten Terminal mit Logs stoppen (Ctrl+C)
# Container im Detached Mode neu starten
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d

# Final Status Check
docker ps
docker logs workout-tracker-backend-prod --tail 20
```

✅ **Deployment erfolgreich! Downtime beendet.**

---

### Schritt 9: 🆘 ROLLBACK (nur bei Fehlern!)

```bash
# Container stoppen
docker-compose -f docker-compose.prod.yml down

# Database Restore
docker-compose -f docker-compose.prod.yml up -d db
docker exec -i workout-tracker-db-prod psql -U workoutuser workout_tracker < ~/backup_pre_homegym_YYYYMMDD_HHMMSS.sql.gz

# Alten Code wiederherstellen
git checkout <previous-commit-hash>
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# User informieren über Rollback
```

---

## 🧪 Post-Deployment Testing

### Backend API Tests (via curl oder Postman)

```bash
# 1. Health Check
curl http://n1k0blc-pi.local:4000/health

# 2. User Profile Check (nach Login)
curl -H "Authorization: Bearer YOUR_TOKEN" http://n1k0blc-pi.local:4000/users/me

# 3. HomeGyms abrufen
curl -H "Authorization: Bearer YOUR_TOKEN" http://n1k0blc-pi.local:4000/users/home-gyms

# 4. Workout History (sollte homeGymId haben)
curl -H "Authorization: Bearer YOUR_TOKEN" http://n1k0blc-pi.local:4000/workouts
```

### Frontend Tests (manuell im Browser)

1. **Browser-Cache leeren** (wichtig!)
   - Cmd+Shift+Delete (Chrome/Safari)
   - Alle Daten löschen

2. **Login testen**
   - Login sollte funktionieren
   - User-Profil sollte laden (auch wenn Felder leer sind)

3. **Dashboard prüfen**
   - Workouts werden angezeigt
   - PRs werden korrekt angezeigt
   - Bei unilateralen Übungen: "20 Wdh. (10x2)" Format

4. **Workout History**
   - Alte Workouts haben Badge mit "Mein Home Gym" (violet)
   - Korrekte Gym-Zuordnung sichtbar

5. **Exercise Flags testen**
   - **Kurzhantel Bankdrücken** hinzufügen → sollte `Gewicht (kg) (2x)` Label zeigen
   - **Unilateral Kabel Latzug** hinzufügen → sollte `Wdh (2x)` Label zeigen

6. **Timer testen**
   - Ersten Satz loggen → Timer startet
   - Zweiten Satz loggen → Timer wird neu gestartet (alter Timer stoppt)

---

## 📋 Geänderte Dateien

### Backend (Apps/backend)
**Datenbank:**
- `prisma/schema.prisma` - User, HomeGym, Workout, WorkoutDay erweitert
- `prisma/migrations/20260405195941_add_user_profile_and_home_gyms/` - BREAKING Prisma Migration
- `migrate-home-gyms.ts` - **NEU**: Datenmigration Script

**DTOs:**
- `src/auth/dto/register.dto.ts` - Profil-Felder + homeGyms required
- `src/users/dto/user.dto.ts` - UserDto erweitert, HomeGymDto hinzugefügt
- `src/users/dto/update-user.dto.ts` - Profil-Update DTOs
- `src/users/dto/create-home-gym.dto.ts` - **NEU**
- `src/users/dto/update-home-gym.dto.ts` - **NEU**
- `src/workouts/dto/start-workout.dto.ts` - gymLocation → homeGymId
- `src/workouts/dto/workout-response.dto.ts` - GymLocation enum entfernt, HomeGymDto hinzugefügt
- `src/workout-cycles/dto/create-cycle.dto.ts` - plannedHomeGymId Support
- `src/workout-cycles/dto/cycle-response.dto.ts` - HomeGymDto hinzugefügt

**Services:**
- `src/auth/auth.service.ts` - User-Erstellung mit Profil + HomeGyms
- `src/users/users.service.ts` - Vollständiges HomeGym CRUD
- `src/workouts/workouts.service.ts` - homeGymId statt gymLocation
- `src/analytics/analytics.service.ts` - PRs nur für Home-Gym-Workouts
- `src/workout-cycles/workout-cycles.service.ts` - plannedHomeGymId Support

**Controller:**
- `src/users/users.controller.ts` - HomeGym CRUD Endpoints

**Scripts:**
- `src/analytics/dto/personal-records.dto.ts` - Exercise Flags
- `src/analytics/analytics.service.ts` - Exercise Flags
- `update-exercise-flags.ts` - Exercise Flags Update Script

### Frontend (Apps/frontend) - NOCH NICHT IMPLEMENTIERT
_Folgende Änderungen sind für nächstes Update geplant:_
- Navigation hiding auf /login & /register
- Zwei-Schritt Registration (Profil + HomeGyms)
- Profil-Seite mit UserCircleIcon
- Workout-Start Gym-Auswahl (Buttons statt Radio)
- History Gym-Badges

---

## 🔧 Troubleshooting

### Problem: Prisma Migration schlägt fehl

**Symptom:** `Error: Migration already applied` oder SQL Fehler

**Lösung:**
```bash
# Migration Status prüfen
docker exec workout-tracker-backend-prod npx prisma migrate status

# Falls "Migration already applied":
# → Normal, einfach weitermachen

# Falls andere Fehler:
# → Rollback zu Schritt 9!
```

---

### Problem: Datenmigration schlägt fehl

**Symptom:** Script bricht mit Fehler ab oder zeigt Warnings

**Kritische Fehler (ROLLBACK!):**
- `Migration failed:` mit Stack Trace
- `Users: X/Y have HomeGyms` (X < Y)
- `Workouts: X/Y assigned to HomeGym` mit großer Differenz

**Unkritische Warnungen (OK):**
- `User X has no HomeGym - skipping workout Y` (sollte nicht vorkommen nach Step 1)
- `Migration completed with warnings` (nur wenn wenige Warnings)

**Lösung bei Fehler:**
```bash
# Schritt 9 Rollback ausführen!
```

---

### Problem: Script findet @prisma/client nicht

**Symptom:** `Cannot find module '@prisma/client'`

**Lösung:**
```bash
# Prisma Client regenerieren
docker exec -w /app/apps/backend workout-tracker-backend-prod npx prisma generate

# Migration Script erneut ausführen (mit npm script)
docker exec -w /app/apps/backend workout-tracker-backend-prod npm run migrate:home-gyms
```

---

### Problem: Container startet nicht

**Symptom:** `docker ps` zeigt Container nicht

**Lösung:**
```bash
# Logs anschauen
docker logs workout-tracker-backend-prod

# Häufige Ursachen:
# 1. Port bereits belegt → andere Container stoppen
# 2. Database nicht erreichbar → DB Container prüfen
# 3. Environment Variables fehlen → .env prüfen

# DB Container Status
docker logs workout-tracker-db-prod

# Falls DB Problem: Container neu starten
docker-compose -f docker-compose.prod.yml up -d db
# Warten 10 Sekunden
docker-compose -f docker-compose.prod.yml up -d backend
```

---

### Problem: Badges werden nicht angezeigt

**Symptom:** Exercise Flags fehlen im UI

**Lösung:**
1. Browser-Cache komplett leeren (Cmd+Shift+Delete)
2. Hard Reload (Cmd+Shift+R)
3. Prüfen ob update-exercise-flags.ts erfolgreich lief
4. API Response prüfen (Browser DevTools → Network → exercise endpoint)

---

### Problem: Alte Satzpause läuft weiter

**Symptom:** Timer zeigt alte Zeit

**Lösung:**
1. localStorage manuell löschen: Browser DevTools → Application → Local Storage → alle Einträge löschen
2. Seite neu laden
3. Neues Workout starten

---

### Problem: User kann sich nicht einloggen nach Migration

**Symptom:** Login funktioniert nicht mehr

**Ursache:** Sehr unwahrscheinlich - User-Tabelle wurde nicht verändert, nur erweitert

**Lösung:**
```bash
# Prüfe ob User existiert
docker exec workout-tracker-backend-prod npx prisma studio

# In Prisma Studio: User Tabelle öffnen
# passwordHash sollte unverändert sein
```

**Falls User fehlt: ROLLBACK!** (Schritt 9)

---

## ✅ Deployment Checkliste

### Pre-Deployment
- [ ] Migration lokal getestet (auf Dev-System)
- [ ] Alle Tests erfolgreich (Backend compile ohne Fehler)
- [ ] Code committed und auf main branch gepusht
- [ ] Maintenance-Fenster angekündigt
- [ ] Rollback-Plan verstanden

### Während Deployment
- [ ] **2x Backup erstellt** (automatisch + manuell)
- [ ] Backups verifiziert (Dateigrößen geprüft)
- [ ] Git gepullt (main branch)
- [ ] Docker Container gestoppt (**Downtime beginnt**)
- [ ] Docker Container neu gebaut (--no-cache)
- [ ] Container gestartet (Logs beobachten)
- [ ] `npx prisma migrate deploy` ausgeführt ✅
- [ ] Migration erfolgreich (Output geprüft)
- [ ] `migrate-home-gyms.ts` ausgeführt ✅
- [ ] Datenmigration erfolgreich (Verification geprüft)
- [ ] `update-exercise-flags.ts` ausgeführt ✅
- [ ] Exercise Flags aktualisiert

### Health Checks
- [ ] Container laufen (docker ps)
- [ ] Keine Fehler in Logs
- [ ] Health Endpoint erreichbar (curl /health)
- [ ] Database Connection OK
- [ ] Backend Logs sauber (keine Errors)

### Functional Testing
- [ ] Browser-Cache geleert
- [ ] Login funktioniert ✅
- [ ] Dashboard lädt ✅
- [ ] User hat "Mein Home Gym" (GET /users/home-gyms)
- [ ] Workouts haben homeGymId (GET /workouts)
- [ ] Kurzhantel Bankdrücken zeigt `Gewicht (kg) (2x)` ✅
- [ ] Unilateral Kabel Latzug zeigt `Wdh (2x)` ✅
- [ ] Timer startet neu bei jedem Satz ✅
- [ ] Freie Workouts werden grün bei Completion ✅
- [ ] PRs zeigen korrekte Wiederholungen (z.B. "20 Wdh. (10x2)") ✅

### Post-Deployment
- [ ] Container im detached mode (`-d`)
- [ ] Services erreichbar (Frontend + Backend)
- [ ] **Downtime beendet** - User informieren
- [ ] Monitoring prüfen (falls vorhanden)
- [ ] Diese Datei als deployed markieren (Datum + Commit Hash)

### Cleanup
- [ ] Alte Docker Images entfernen (`docker image prune`)
- [ ] Alte Backups archivieren (> 30 Tage löschen)
- [ ] NEXT-DEPLOYMENT.md archivieren oder löschen

---

## 📌 Hinweise & Best Practices

### Datenbank-Migration
- ✅ **Prisma Migration ist idempotent** - kann mehrfach ausgeführt werden
- ✅ **Datenmigration-Script ist idempotent** - kann sicher wiederholt werden
- ⚠️ **BREAKING CHANGE**: gymLocation-Spalte wird komplett entfernt
- ⚠️ **Kein Zurück**: Nach Migration kann nicht mehr zu alter Version gewechselt werden (ohne Backup-Restore)

### Script-Ausführung
- **Migration Scripts sind im Git Repo** - werden automatisch mit git pull aktualisiert
- **Kein docker cp nötig** - Scripts liegen bereits im Container nach Build
- **tsx ist verfügbar** - über npx, keine globale Installation nötig
- **Working Directory wichtig** - `-w /app/apps/backend` für korrekte Pfade

### Datenmigration Details
1. **Alle User bekommen "Mein Home Gym"** - auch wenn sie noch keine Workouts haben
2. **Alle alten Workouts → HomeGym** - weil gymLocation=HOME war Default
3. **NULL homeGymId = "Anderes Gym"** - für zukünftige Workouts
4. **WorkoutDays bekommen geplantes Gym** - für Cycle-Planung

### Rollback-Strategie
- **NUR via Backup möglich** - keine automatische Migration rückwärts
- **Backup VOR Migration KRITISCH** - ohne Backup kein Rollback
- **Database + Code zusammen** - bei DB-Rollback auch Code-Rollback nötig

### Frontend Kompatibilität (aktueller Stand)
- ⚠️ **Frontend kennt noch kein homeGym-System** - wird in nächstem Update implementiert
- ✅ **Backend ist abwärtskompatibel** - alte API Calls funktionieren weiterhin
- ✅ **Workouts funktionieren** - auch ohne Frontend-Update
- 🔜 **Nächstes Update**: Navigation hiding, Profil-Seite, Gym-Auswahl

### Performance
- **Migration dauert**: ~1-5 Sekunden pro 1000 User/Workouts
- **Downtime einplanen**: ~15-30 Minuten für gesamtes Deployment
- **Backup dauert**: ~10-30 Sekunden je nach DB-Größe

### Sicherheit
- **Keine Passwörter betroffen** - User.passwordHash bleibt unverändert
- **Keine Datenverluste** - nur neue Spalten + Datenmigrationen
- **Ownership verified** - User können nur eigene HomeGyms verwalten
- **Deletion protected** - HomeGyms mit Workouts können nicht gelöscht werden

---

## 📊 Erwartete Datenmigration-Statistiken

Bei **3 Usern** mit **~30 Workouts** und **2 aktiven Cycles**:

```
📍 Step 1: Creating default HomeGyms
   Found 3 users without HomeGyms
   ✓ Created 3 default HomeGyms

📍 Step 2: Migrating workouts
   Found 30 workouts to migrate
   ✓ Migrated 30 workouts to user's home gym

📍 Step 3: Migrating workout days
   Found 14 workout days to migrate
   ✓ Migrated 14 workout days to planned gym

📊 Verification:
   Users: 3/3 have HomeGyms ✅
   Workouts: 30/30 assigned to HomeGym ✅
   Workout Days: 14/14 have planned gym ✅
```

**Execution Time:** ~2-5 Sekunden
**Database operations:** ~50-100 queries

---

## 🎯 Nach erfolgreichem Deployment

1. **Dokumentation aktualisieren**
   - Dieses File archivieren mit Datum + Commit Hash
   - README.md aktualisieren mit neuer API Dokumentation

2. **User informieren**
   - Downtime beendet
   - Neue Features (noch nicht sichtbar, kommen im nächsten Update)
   - Was sich geändert hat (für User: nichts sichtbar, alles funktioniert wie vorher)

3. **Monitoring**
   - Logs beobachten (erste Stunden)
   - Performance prüfen
   - User Feedback sammeln

4. **Nächste Schritte**
   - Frontend Implementation planen
   - Multi-HomeGym UI implementieren
   - User-Profile Seite bauen
   - Neue Registration Flow

---

## 📅 Deployment History

**Deployed on:** _[DATUM EINTRAGEN]_  
**Deployed by:** n1k0  
**Git Commit:** _[COMMIT HASH EINTRAGEN]_  
**Migration Duration:** _[DAUER EINTRAGEN]_  
**Downtime:** _[DOWNTIME EINTRAGEN]_  
**Issues:** _[PROBLEME EINTRAGEN oder "None"]_  

---

**Status:** 🟡 Ready for Deployment  
**Nach erfolgreichem Deployment:** Diese Datei als DEPLOYED-YYYYMMDD.md archivieren


