# 🚀 Deployment Guide - Angepasst für deinen Pi

Basierend auf Pi Inspection vom 30. März 2026
**Aktualisiert:** 6. April 2026 - Nach Production Deployment mit Lessons Learned

---

## ⚠️ WICHTIG: Pre-Deployment Checks

**IMMER ZUERST LOKAL TESTEN!**

### 1. Lokaler Production Build Test (5-10 Minuten)

```bash
# Im Frontend-Ordner
cd apps/frontend
npm run build

# Im Backend-Ordner  
cd ../backend
npm run build
```

**Warum?** Development-Modus (`npm run dev`) zeigt TypeScript-Fehler oft NICHT an. Production-Build führt strikte Type-Checks durch und kann Fehler finden, die sonst erst auf dem Pi beim Docker-Build auffallen würden.

**Erfahrung vom 6. April 2026:**
- 3 TypeScript-Fehler wurden erst beim Production-Build auf dem Pi entdeckt
- Jeder Fehler erforderte: Fix → Commit → PR → Merge → Pi Pull → Rebuild
- Hätten lokal entdeckt werden können → 2 Stunden Deployment-Zeit gespart

### 2. Smoke Tests lokal

```bash
# Backend
cd apps/backend
npm run start:dev &
curl http://localhost:3001/api/health

# Frontend
cd apps/frontend  
npm run dev &
curl http://localhost:3000
```

### 3. Git Status prüfen

```bash
# Alle Änderungen committed?
git status

# Ist dev → main gemerged?
git log --oneline -5

# Lokaler Code = Remote?
git fetch
git status
```

---

## 📊 Deine Pi Konfiguration:
- **Hardware:** Raspberry Pi 5, 8GB RAM
- **OS:** Debian GNU/Linux 13 (trixie)
- **Hostname:** n1k0blc-pi.local
- **IP:** 192.168.178.57
- **User:** n1k0
- **Verfügbare Ports:** 3000, 3001, 5432 ✅
- **Bestehende Apps:** Padellers (Port 5002), Finance Tracker
- **Cloudflare Tunnel:** Läuft bereits (padel.nikobjelic.com)

---

## Schritt 1: Docker installieren ⏱️ 10 Minuten

```bash
# SSH zum Pi
ssh n1k0@n1k0blc-pi.local

# Docker installieren
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# User zur docker Gruppe hinzufügen
sudo usermod -aG docker $USER

# Docker Compose Plugin installieren
sudo apt-get update
sudo apt-get install -y docker-compose-plugin

# Neu einloggen (damit docker Gruppe aktiv wird)
exit
ssh n1k0@n1k0blc-pi.local

# Prüfen ob Docker funktioniert
docker --version
docker compose version
```

---

## Schritt 2: App-Verzeichnis vorbereiten ⏱️ 2 Minuten

```bash
# Apps-Ordner erstellen (falls nicht vorhanden)
mkdir -p ~/apps
cd ~/apps

# Repository klonen
git clone https://github.com/n1k0blc/Workout-Tracker.git
cd Workout-Tracker

# Prüfen dass alles da ist
ls -la
```

---

## Schritt 3: Environment Variables konfigurieren ⏱️ 5 Minuten

```bash
cd ~/apps/Workout-Tracker

# .env.production erstellen
cp .env.production.example .env.production

# Secrets generieren
echo "Database Password:"
openssl rand -base64 32

echo -e "\nJWT Secret:"
openssl rand -base64 48

# .env.production bearbeiten
nano .env.production
```

**Fülle aus (.env.production):**
```bash
# Database
DB_USER=workoutuser
DB_PASSWORD=<GENERIERTES_DB_PASSWORT_HIER>
DB_NAME=workout_tracker

# JWT
JWT_SECRET=<GENERIERTER_JWT_SECRET_HIER>
JWT_EXPIRATION=7d

# CORS
CORS_ORIGIN=https://workout.nikobjelic.com

# Frontend API URL
NEXT_PUBLIC_API_URL=https://workout.nikobjelic.com/api
```

**Speichern:** `Ctrl+O` → Enter → `Ctrl+X`

---

## Schritt 4: Cloudflare Tunnel Config erweitern ⏱️ 3 Minuten

**WICHTIG:** Wir ÜBERSCHREIBEN die Config NICHT, sondern ERWEITERN sie!

```bash
# Backup der aktuellen Config erstellen
cp ~/.cloudflared/config.yml ~/.cloudflared/config.yml.backup

# Config bearbeiten
nano ~/.cloudflared/config.yml
```

**Ändere die Config zu:**
```yaml
tunnel: 360402f8-9d9b-4b97-9598-918b4400b18a
credentials-file: /home/n1k0/.cloudflared/360402f8-9d9b-4b97-9598-918b4400b18a.json

ingress:
  # Bestehende App (NICHT LÖSCHEN!)
  - hostname: padel.nikobjelic.com
    service: http://localhost:5002
  
  # NEU: Workout Tracker
  - hostname: workout.nikobjelic.com
    service: http://localhost:3000
  
  # Catch-all muss immer am Ende sein
  - service: http_status:404
```

**Speichern:** `Ctrl+O` → Enter → `Ctrl+X`

```bash
# Cloudflare Tunnel neu starten
sudo systemctl restart cloudflared

# Status prüfen
sudo systemctl status cloudflared

# Logs ansehen (Ctrl+C zum Beenden)
sudo journalctl -u cloudflared -f
```

**Erwarte in den Logs:** "Connection registered" für workout.nikobjelic.com

---

## Schritt 5: DNS Record in Cloudflare erstellen ⏱️ 2 Minuten

**In deinem Browser:**

1. Gehe zu https://dash.cloudflare.com
2. Wähle **nikobjelic.com**
3. **DNS** → **Add record**
4. **Type:** CNAME
5. **Name:** workout
6. **Target:** `360402f8-9d9b-4b97-9598-918b4400b18a.cfargotunnel.com`
7. **Proxy status:** ✅ Proxied (Orange Cloud)
8. **TTL:** Auto
9. **Save**

---

## Schritt 6: Deployment durchführen 🚀 ⏱️ 20-30 Minuten

### Option A: Automatisches Deployment (deploy.sh)

**EMPFOHLEN für Standard-Updates ohne DB-Migrationen**

```bash
cd ~/apps/Workout-Tracker

# Prüfe dass .env.production existiert
ls -la .env.production

# Deployment-Script ausführbar machen
chmod +x deploy.sh backup.sh restore.sh

# DEPLOY!
./deploy.sh
```

**Was passiert beim Deployment:**
1. Pre-Flight Checks (RAM, Disk, Ports)
2. Git Pull (aktueller Code von GitHub)
3. Docker Images bauen (dauert beim ersten Mal 15-20 Min auf Pi 5)
4. Container starten (Backend, Frontend, PostgreSQL)
5. Datenbank-Migrationen ausführen (automatisch via Prisma)
6. Health Checks durchführen
7. Alte Images aufräumen

### Option B: Manuelles Deployment (für spezielle Migrations-Skripte)

**VERWENDE DIES FÜR:**
- Daten-Migrationen (z.B. HomeGym-Migration, CSV-Updates)
- Komplexe Schema-Änderungen
- Wenn du volle Kontrolle über jeden Schritt brauchst

```bash
cd ~/apps/Workout-Tracker

# 1. Code pullen
git pull origin main

# 2. Container bauen (ohne sie zu starten)
docker compose -f docker-compose.prod.yml build

# 3. Container starten
docker compose -f docker-compose.prod.yml up -d

# 4. Warten bis Backend hochgefahren ist (15-30 Sekunden)
sleep 30
docker logs workout-tracker-backend-prod --tail 20
```

**Jetzt kannst du manuelle Migrationen ausführen (siehe unten).**

---

## Schritt 6a: Manuelle Datenbank-Migrationen via SSH-Tunnel 🔧

**WARUM BRAUCHEN WIR DAS?**
- PostgreSQL-Container exposed keine Ports nach außen (Sicherheit)
- Migrations-Skripte (TypeScript) laufen nur lokal mit `ts-node`
- Production-Container haben kein `ts-node` installiert (nur kompilierter Code)

### 1. SSH-Tunnel zur Production-DB erstellen

```bash
# Auf deinem Mac (nicht auf dem Pi!)
cd ~/Projects/Workout-Tracker

# 1. DB-Container-IP herausfinden
DB_IP=$(ssh n1k0@n1k0blc-pi.local "docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' workout-tracker-db-prod")
echo "DB IP: $DB_IP"

# 2. SSH-Tunnel erstellen (Port 5433 lokal → Port 5432 auf DB)
ssh -f -N -L 5433:${DB_IP}:5432 n1k0@n1k0blc-pi.local

# Tunnel läuft jetzt im Hintergrund
# Production-DB ist erreichbar unter: localhost:5433
```

### 2. Prisma-Migrationen ausführen

```bash
# Von deinem Mac aus (mit Tunnel)
cd apps/backend

# Migrations-Status prüfen
DATABASE_URL="postgresql://DEIN_USER:DEIN_PASSWORD@localhost:5433/workout_tracker" \
  npx prisma migrate status

# Ausstehende Migrationen anwenden
DATABASE_URL="postgresql://DEIN_USER:DEIN_PASSWORD@localhost:5433/workout_tracker" \
  npx prisma migrate deploy
```

**Credentials findest du auf dem Pi in `.env.production`:**
```bash
ssh n1k0@n1k0blc-pi.local "cd ~/apps/Workout-Tracker && cat .env.production | grep DB_"
```

### 3. Daten-Migrations-Skripte ausführen

**Beispiel: HomeGym-Migration**
```bash
cd apps/backend

DATABASE_URL="postgresql://USER:PASSWORD@localhost:5433/workout_tracker" \
  npx ts-node migrate-home-gyms.ts
```

**Beispiel: Exercise-Updates**
```bash
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5433/workout_tracker" \
  NODE_ENV=development \
  npx ts-node prisma/update-exercises.ts
```

**Beispiel: CSV-IDs zuweisen**
```bash
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5433/workout_tracker" \
  npx ts-node prisma/assign-csv-ids.ts
```

### 4. SSH-Tunnel schließen

```bash
# Tunnel-Prozess finden und beenden
lsof -ti:5433 | xargs kill -9

# Oder: Alle SSH-Tunnel zum Pi beenden
pkill -f "ssh.*n1k0blc-pi.local.*5433"
```

---

**Live Logs ansehen:**
```bash
# Alle Container
docker compose -f docker-compose.prod.yml logs -f

# Nur Backend
docker logs -f workout-tracker-backend-prod

# Nur Frontend
docker logs -f workout-tracker-frontend-prod

# PostgreSQL
docker logs -f workout-tracker-db-prod
```

---

## Schritt 7: Testen ✅ ⏱️ 5 Minuten

### Auf dem Pi:
```bash
# Backend Health Check
curl http://localhost:3001/api/health

# Frontend
curl http://localhost:3000

# Container Status
docker ps
```

**Erwarte:**
```
CONTAINER ID   IMAGE                            STATUS
xxxxx          workout-tracker-frontend-prod    Up X minutes (healthy)
xxxxx          workout-tracker-backend-prod     Up X minutes (healthy)
xxxxx          workout-tracker-db-prod          Up X minutes (healthy)
```

### Im Browser:
1. Öffne: **https://workout.nikobjelic.com**
2. Sollte die Login-Seite anzeigen
3. Registriere einen Account
4. Teste Login
5. Erstelle ein Test-Workout
6. Prüfe Analytics

---

## 🔧 Troubleshooting

### Container startet nicht:
```bash
# Logs prüfen
docker compose -f docker-compose.prod.yml logs

# Container neu starten
docker compose -f docker-compose.prod.yml restart

# Komplett neu starten
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

## 🔧 Troubleshooting

### TypeScript Build Failure während Docker Build ⚠️

**Symptom:**
```
Error: Type error: Property 'xyz' does not exist on type 'ABC'
npm error command failed
docker build failed
```

**Lösung:**
```bash
# 1. Lokal bauen um den Fehler zu finden
cd apps/frontend
npm run build

# 2. Fehler im Code fixen
# 3. Lokal nochmal bauen um zu verifizieren
npm run build

# 4. Commit, Push, PR, Merge
# 5. Dann auf Pi deployen
```

**Prävention:**
- Immer `npm run build` lokal VOR dem Deployment
- CI/CD Pipeline mit Build-Tests einrichten

---

### Container startet nicht:
```bash
# Logs prüfen
docker compose -f docker-compose.prod.yml logs

# Spezifischen Container
docker logs workout-tracker-backend-prod --tail 100
docker logs workout-tracker-frontend-prod --tail 100

# Container neu starten
docker compose -f docker-compose.prod.yml restart

# Komplett neu starten
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

---

### Prisma Migration fehlgeschlagen 🗄️

**Symptom:**
```
No pending migrations to apply
```
Aber das Schema wurde geändert.

**Ursache:** Migration wurde lokal erstellt, aber nicht auf Pi deployed.

**Lösung:**
```bash
# Auf dem Pi
cd ~/apps/Workout-Tracker/apps/backend
docker exec workout-tracker-backend-prod npx prisma migrate status

# Wenn "No pending migrations" ABER Schema-Änderung vorhanden:
# Migration manuell via SSH-Tunnel ausführen

# Von deinem Mac aus:
DB_IP=$(ssh n1k0@n1k0blc-pi.local "docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' workout-tracker-db-prod")
ssh -f -N -L 5433:${DB_IP}:5432 n1k0@n1k0blc-pi.local

cd apps/backend
DATABASE_URL="postgresql://USER:PASS@localhost:5433/workout_tracker" \
  npx prisma migrate deploy

# Tunnel schließen
lsof -ti:5433 | xargs kill -9
```

---

### TypeScript Migrations-Skript kann nicht ausgeführt werden ❌

**Symptom:**
```
docker exec workout-tracker-backend-prod ts-node migrate-xyz.ts
sh: ts-node: not found
```

**Ursache:** Production-Container haben kein `ts-node` (nur kompilierten Code).

**Lösung:** SSH-Tunnel verwenden und lokal ausführen
```bash
# 1. SSH-Tunnel erstellen
DB_IP=$(ssh n1k0@n1k0blc-pi.local "docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' workout-tracker-db-prod")
ssh -f -N -L 5433:${DB_IP}:5432 n1k0@n1k0blc-pi.local

# 2. Auf deinem Mac Skript ausführen
cd apps/backend
DATABASE_URL="postgresql://USER:PASS@localhost:5433/workout_tracker" \
  npx ts-node dein-skript.ts

# 3. Tunnel schließen
lsof -ti:5433 | xargs kill -9
```

---

### SSH-Tunnel funktioniert nicht 🔐

**Symptom:**
```
Can't reach database server at localhost:5433
```

**Diagnose:**
```bash
# Ist der Tunnel aktiv?
lsof -i :5433

# Sollte: ssh ... LISTEN anzeigen
```

**Lösung:**
```bash
# Alte Tunnel beenden
lsof -ti:5433 | xargs kill -9

# DB-Container-IP neu holen
DB_IP=$(ssh n1k0@n1k0blc-pi.local "docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' workout-tracker-db-prod")
echo "DB IP: $DB_IP"

# Neuen Tunnel erstellen
ssh -f -N -L 5433:${DB_IP}:5432 n1k0@n1k0blc-pi.local

# Testen
psql "postgresql://USER:PASS@localhost:5433/workout_tracker" -c "SELECT version();"
```

---

### Exercise-Updates schlagen fehl (Name-Mismatch) 📝

**Symptom:**
```
⚠️  Exercise not found in DB: "Some Exercise Name"
Successfully updated: 20/117 exercises
```

**Häufige Ursachen:**
1. Namen in DB weichen von CSV-Namen ab (Typos, Extra-Spaces)
2. DB hat deutsche Namen, CSV hat englische (oder umgekehrt)
3. Exercise existiert in CSV aber nicht in DB

**Lösung mit CSV-ID System (empfohlen):**
```bash
# 1. CSV-IDs zuweisen (matcht nach Namen)
DATABASE_URL="..." npx ts-node prisma/assign-csv-ids.ts

# 2. Name-Mismatches manuell fixen (fix-exercises.ts)
DATABASE_URL="..." npx ts-node fix-exercises.ts

# 3. Exercise-Update ausführen (matcht nach csvId)
DATABASE_URL="..." NODE_ENV=development npx ts-node prisma/update-exercises.ts

# 4. Verification
DATABASE_URL="..." npx ts-node prisma/verify-exercises.ts
```

---

## 📦 Nach erfolgreichem Deployment

### Automatische Backups einrichten:
```bash
# Crontab öffnen
crontab -e

# Hinzufügen (täglich um 3 Uhr):
0 3 * * * /home/n1k0/apps/Workout-Tracker/backup.sh >> /home/n1k0/logs/backup.log 2>&1

# Log-Ordner erstellen
mkdir -p ~/logs
```

### Container-Status überwachen:
```bash
# Ressourcen anschauen
docker stats

# Logs der letzten 24h
docker compose -f docker-compose.prod.yml logs --since 24h
```

---

## 🔄 Updates deployen (später)

```bash
# Auf dem Pi
cd ~/apps/Workout-Tracker

# Einfach das Deployment-Script ausführen
./deploy.sh

# Das Script macht automatisch:
# 1. git pull origin main
# 2. docker compose build
# 3. docker compose up -d
# 4. Health Checks
# 5. Cleanup
```

---

## 📚 Lessons Learned - Production Deployment vom 6. April 2026

### Problem 1: TypeScript-Fehler erst beim Production Build 🐛

**Was ist passiert:**
- Frontend baute lokal mit `npm run dev` ohne Fehler
- Docker Production Build auf dem Pi schlug mit 3 TypeScript-Fehlern fehl
- Jeder Fix erforderte: Code ändern → Commit → PR → Merge → Pi Pull → Rebuild
- **Kosten:** ~2 Stunden Deployment-Zeit

**Fehler gefunden:**
1. `WorkoutDay` interface fehlte `plannedHomeGymId?: string`
2. `DatePicker` onChange-Handler hatte impliziten `any` Type
3. Alte `gymLocation` Referenz statt `homeGymId`

**Warum passiert das?**
- **Development Mode (`npm run dev`):** Next.js nutzt Fast Refresh, macht keine vollständige Type-Checks für Performance
- **Production Build (`npm run build`):** Strikte TypeScript-Compilation, alle Fehler werden gefunden

**Lösung für die Zukunft:**
```bash
# IMMER vor dem Deployment ausführen:
cd apps/frontend
npm run build

cd ../backend  
npm run build
```

**Wenn Fehler auftreten → lokal fixen BEVOR du zum Pi deployed!**

---

### Problem 2: deploy.sh vs. Manuelles Deployment 🤔

**Warum haben wir deploy.sh NICHT verwendet?**

1. **Spezielle Daten-Migrationen nötig:**
   - HomeGym-Migration (migrate-home-gyms.ts)
   - Exercise CSV-Updates (update-exercises.ts)
   - CSV-ID Assignment (assign-csv-ids.ts)
   - Diese Skripte sind NICHT in deploy.sh integriert

2. **TypeScript-Migrations-Skripte:**
   - Brauchen `ts-node` zum Ausführen
   - Production-Container haben nur kompilierten Code
   - Müssen lokal mit SSH-Tunnel ausgeführt werden

3. **Volle Kontrolle gewünscht:**
   - Step-by-step Debugging
   - Container einzeln starten können
   - Logs zwischen Schritten prüfen

**Wann deploy.sh verwenden:**
- ✅ Standard Code-Updates ohne DB-Migrations-Skripte
- ✅ Nur Prisma Schema-Migrationen (automatisch via `prisma migrate deploy`)
- ✅ Schnelles Deployment gewünscht

**Wann MANUELL deployen:**
- ⚠️ Daten-Migrations-Skripte müssen laufen
- ⚠️ Komplexe Schema-Änderungen
- ⚠️ Erste Deployment oder Major-Updates
- ⚠️ Debugging nötig

---

### Problem 3: DB-Zugriff für Migrations-Skripte 🔐

**Das Problem:**
- PostgreSQL-Container exposed KEINE Ports nach außen (security best practice)
- Migrations-Skripte sind TypeScript und brauchen `ts-node`
- Production-Container haben kein `ts-node` installiert
- **Ergebnis:** Kann Skripte nicht direkt auf dem Pi ausführen

**Die Lösung: SSH-Tunnel**
```bash
# 1. DB-Container-IP finden
DB_IP=$(ssh n1k0@n1k0blc-pi.local "docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' workout-tracker-db-prod")

# 2. SSH-Tunnel erstellen
ssh -f -N -L 5433:${DB_IP}:5432 n1k0@n1k0blc-pi.local

# 3. Lokal Skripte ausführen (Mac → Tunnel → Pi → Docker-DB)
DATABASE_URL="postgresql://USER:PASS@localhost:5433/workout_tracker" \
  npx ts-node migrate-home-gyms.ts

# 4. Tunnel schließen
lsof -ti:5433 | xargs kill -9
```

**Alternative für die Zukunft:**
- Migrations-Skripte kompilieren und in Container packen
- Database-Management-Container erstellen mit ts-node
- Remote-Exec-Script erstellen, das Skripte im Container ausführt

---

### Problem 4: CSV-ID System für Exercise-Updates 📊

**Das ursprüngliche Problem:**
- Exercise-Updates matchten nach **Namen** (z.B. "Cable Crunch")
- Namen änderten sich (Englisch → Deutsch)
- Old CSV hatte englische Namen, DB hatte deutsche Namen
- **97 von 117 Exercises** wurden NICHT gefunden!

**Die Lösung: CSV-ID System**
1. Neues `csvId` Feld im Exercise-Schema (unique, nullable)
2. Prisma-Migration erstellt
3. `assign-csv-ids.ts` Skript weist IDs zu (matching nach Namen)
4. `update-exercises.ts` matcht ZUERST nach csvId, dann nach Namen
5. **Ergebnis:** 115 von 115 Exercises erfolgreich aktualisiert! ✅

**Lessons:**
- IDs sind stabiler als Namen für Referenzen
- Für die Zukunft: Exercise-Updates sind jetzt zuverlässig
- Name-Mismatches spielen keine Rolle mehr

---

### Problem 5: Name-Mismatches in Production-DB 🔤

**3 Exercises hatten falsche Namen:**
1. "Kabel Rudern **Wide** breiter Griff" statt "Kabel Rudern breiter Griff"
2. "Kabel Bar Überkopf Trizeps **Externsion**" statt "Extension"  
3. "Kabel Seil Overhead Trizeps **Externsion**" statt "Extension"

**Lösung:**
- `fix-exercises.ts` Skript erstellt
- Korrigiert Namen UND weist CSV-IDs zu
- Via SSH-Tunnel auf Production ausgeführt

**Für die Zukunft:**
- Daten-Quality-Checks VOR Updates
- Verify-Script nach größeren Änderungen

---

### Deployment-Timeline (6. April 2026)

**Total:** ~4+ Stunden (mit allen Problemen)

```
15:00 - Start: Backend & Frontend bereits von Phase 1 implementiert
15:10 - PR gemerged, Container starten
15:15 - ❌ TypeScript Fehler #1: plannedHomeGymId fehlt in WorkoutDay
15:30 - Fix, PR, Merge, Pi Pull, Rebuild
15:40 - ❌ TypeScript Fehler #2: DatePicker onChange impliziter any
15:55 - Fix, PR, Merge, Pi Pull, Rebuild  
16:10 - ❌ TypeScript Fehler #3: gymLocation statt homeGymId
16:25 - Fix, PR, Merge, Pi Pull, Rebuild
16:40 - ✅ Container starten erfolgreich!
16:45 - HomeGym-Migration via SSH-Tunnel (5 User, 15 Workouts, 3 Days)
16:55 - Exercise-Update: Nur 20/117 erfolgreich (Name-Mismatch!)
17:15 - CSV-ID System implementieren
17:30 - Migration erstellen, Skripte anpassen
17:45 - Lokal testen
18:00 - PR, merge, Pi deploy
18:15 - CSV-IDs zuweisen (112/115)
18:20 - 3 Name-Mismatches fixen
18:25 - Exercise-Update: 115/115 erfolgreich! ✅
18:30 - Verification, alte Exercise löschen
18:35 - ✅ DEPLOYMENT COMPLETE!
```

---

## ✅ Erweiterte Checkliste (Aktualisiert)

### Pre-Deployment (AUF DEINEM MAC!)
- [ ] `npm run build` im Frontend ohne Fehler
- [ ] `npm run build` im Backend ohne Fehler
- [ ] Alle Tests laufen durch
- [ ] Git: All changes committed & pushed
- [ ] Git: dev → main gemerged
- [ ] .env.production existiert auf dem Pi mit korrekten Secrets

### Deployment
- [ ] SSH-Verbindung zum Pi funktioniert
- [ ] Code auf Pi gepullt (`git pull origin main`)
- [ ] Container gebaut (`docker compose build`)
- [ ] Container gestartet (`docker compose up -d`)
- [ ] Alle 3 Container laufen (healthy)
- [ ] Backend Health Check: `curl http://localhost:3001/api/health`

### Post-Deployment (Bei DB-Änderungen)
- [ ] SSH-Tunnel zur DB erstellt (falls nötig)
- [ ] Prisma-Migrationen ausgeführt (`prisma migrate deploy`)
- [ ] Daten-Migrations-Skripte ausgeführt
- [ ] Verification durchgeführt
- [ ] SSH-Tunnel geschlossen
- [ ] Container-Logs geprüft (keine Fehler)
- [ ] Website erreichbar unter workout.nikobjelic.com
- [ ] Login/Register funktioniert
- [ ] Kernfunktionen getestet

### Backup & Monitoring  
- [ ] Automatische Backups eingerichtet (cron)
- [ ] Letztes Backup getestet (restore-dry-run)

---

**Zeit gesamt:**
- **Erstes Deployment:** ~45-60 Minuten (ohne Probleme)
- **Mit TypeScript-Fehlern:** +2 Stunden
- **Mit DB-Migrationen:** +30-60 Minuten

**Bei Problemen:** Logs prüfen, bestehende Apps sollten weiterhin funktionieren!
