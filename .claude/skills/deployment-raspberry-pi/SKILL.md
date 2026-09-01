---
name: deployment-raspberry-pi
description: Führt sichere, vollständige Deployments auf dem Raspberry Pi 5 (ARM64) durch – inklusive aller Pre-Deployment Checks, Cloudflare Tunnel, Docker, Prisma-Migrationen (Schema automatisch im Container, Daten-Skripte via SSH-Tunnel), deploy.sh und Lessons Learned.
tags: [deployment, docker, raspberry-pi, cloudflare, production]
---

Du bist der Deployment-Experte für den Workout Tracker auf dem Raspberry Pi 5.

**Hardware & Umgebung (fest):**
- Raspberry Pi 5, 8 GB RAM, Debian 13 (trixie), User `n1k0`, Hostname `n1k0blc-pi.local`
- App-Pfad: `~/apps/Workout-Tracker`
- Ports: 3000 (Frontend), 3001 (Backend), 5432 (DB)
- Cloudflare Tunnel aktiv für `workout.nikobjelic.com`

**IMMER ZUERST FOLGENDE PRE-DEPLOYMENT CHECKS (auf deinem Mac):**
1. `pnpm run backend:build` → muss fehlerfrei laufen (das Repo ist ein pnpm-Workspace, **nicht** npm)
2. `pnpm run frontend:build` → muss fehlerfrei laufen
3. Smoke Tests lokal (dev + health check)
4. `git status`, `git fetch`, `git log --oneline -5` → alles sauber und auf main
5. **NIE** nur mit `pnpm run dev` testen – Production-Build ist entscheidend!

**Den echten Deploy-Range bestimmen (nicht raten!):**
Der Pi hinkt oft mehrere PRs hinterher. Erst auf dem Pi `git log --oneline -1` ausführen,
dann lokal gegen genau diesen Commit diffen – nie gegen den vorherigen `origin/main`:
```bash
PI=<commit-vom-pi>
git log --oneline $PI..origin/main                                    # Umfang
git diff --name-only $PI..origin/main -- apps/backend/prisma/migrations | grep migration.sql   # offene Migrationen
git diff --name-only $PI..origin/main | grep -Ei 'dockerfile|compose|\.env|\.sh$|package\.json|pnpm-lock'  # Infra
git diff $PI..origin/main -- apps/backend apps/frontend | grep -E '^\+.*process\.env\.'        # neue Env-Vars
```
Daraus ergibt sich, ob `.env.production` angefasst werden muss, wie lang der Build dauert
(Dockerfile-Änderungen = kalter Cache = deutlich länger) und wie viele Migrationen anstehen.

**Deployment-Strategie:**

**Option A – Automatisches Deployment (Standard, auch bei reinen Prisma-Schema-Migrationen)**
- Auf dem Pi: `./deploy.sh` ausführen
- Das Script macht: git pull → Docker Build (ARM64) → up -d → Health Checks → Cleanup
- Der Backend-Container wendet Schema-Migrationen beim Start selbst an (siehe unten)

**Option B – Manuelles Deployment (bei Daten-Skripten, Exercise-Updates, komplexen Änderungen)**
1. `git pull origin main`
2. `docker compose -f docker-compose.prod.yml build` (läuft auf dem Pi nativ auf ARM64, `--platform` ist redundant)
3. `docker compose -f docker-compose.prod.yml --env-file .env.production up -d`
4. Health-Checks: `curl http://localhost:3001/api/health` und `docker ps`

**Prisma-Migrationen: zwei klar getrennte Fälle (WICHTIG – nicht verwechseln!)**

*Fall 1 – Schema-Migration (`prisma/migrations/**/migration.sql`): KEIN SSH-Tunnel nötig.*
Der Backend-Container führt beim Start selbst `npx prisma migrate deploy` aus:
```yaml
command: sh -c "npx prisma migrate deploy && node dist/src/main.js"   # docker-compose.prod.yml
```
Das gilt auch, wenn die Migration ein `UPDATE`-Backfill enthält – solange das SQL in der
Migrationsdatei steht, erledigt `deploy.sh` alles. Danach **immer verifizieren**, denn der
Health-Check von `deploy.sh` beweist nur, dass der Prozess läuft, nicht dass migriert wurde:
```bash
docker compose -f docker-compose.prod.yml logs backend | grep -iA8 "migrat"   # "successfully applied"
docker exec workout-tracker-db-prod psql -U workoutuser -d workout_tracker -c '\d "WorkoutSet"'
```
Schlägt die Migration fehl, startet das Backend nicht → Frontend (`depends_on: healthy`)
ebenfalls nicht → sichtbarer Ausfall. Deshalb Backup vorher (siehe unten).

*Fall 2 – Daten-Skript (`ts-node`, z. B. HomeGyms, Exercise-Updates): SSH-Tunnel Pflicht.*
- Niemals direkt auf dem Production-Container mit `ts-node` ausführen
- **SSH-Tunnel** vom Mac zur DB-Container-IP verwenden (Port 5433)
- Dann lokal: `npx ts-node migrate-xxx.ts`
- Nach Migration: Tunnel schließen (`lsof -ti:5433 | xargs kill -9`)

**Backup vor jeder Migration (Schema wie Daten):**
`deploy.sh` macht **kein** Backup. Bei allem, was Zeilen anfasst, vorher:
```bash
./backup.sh          # muss mit "✅ Backup complete!" und plausibler Dateigröße enden
```
Erst danach `./deploy.sh`. Rollback-Ziel = der Commit, der vorher auf dem Pi lief.

**Cloudflare Tunnel:**
- Config immer erweitern, nie überschreiben
- Ingress-Eintrag für `workout.nikobjelic.com` → `http://localhost:3000`
- Tunnel neu starten: `sudo systemctl restart cloudflared`

**Wichtige Lessons Learned (6. April 2026) – strikt einhalten:**
- TypeScript-Fehler tauchen fast nur beim Production-Build auf → immer lokal Production-Build machen
- Exercise-Updates immer mit `csvId` (nicht nur Namen) matchen
- Daten-Migrationen (HomeGym, Exercise-Updates etc.) nur via SSH-Tunnel
- deploy.sh nur bei reinen Code-Updates ohne Daten-Skripte verwenden
- Nach Deployment immer: Login testen, Test-Workout, Analytics prüfen

**Lessons Learned (31. August 2026, Deployment PR #107 / per-side WorkoutSet-Spalten):**
- **Schema-Migrationen brauchen KEINEN SSH-Tunnel** – der Container macht `migrate deploy`
  selbst. Die alte Regel „Migration ⇒ manuell + Tunnel“ war zu grob und hat den Plan
  anfangs in die falsche Richtung geschickt. Tunnel gilt nur für `ts-node`-Daten-Skripte.
- **Nie gegen den vorherigen `origin/main` diffen.** Der Pi lag auf PR #95, angenommen war
  PR #93 → falscher Range, falsche Einschätzung der Build-Dauer. Immer erst
  `git log --oneline -1` auf dem Pi abfragen.
- **Ein dirty working tree auf dem Pi ist meist harmlos.** `git diff --stat` zeigte
  `0 insertions(+), 0 deletions(-)` – es waren reine Datei-Modes (`100644 → 100755`, also
  ein früheres `chmod +x`). Vor dem Verwerfen immer prüfen, ob es echte Inhalte sind:
  `git diff --stat <files>`. **Nicht** blind `git checkout --` machen – das nimmt
  `deploy.sh` das Ausführungsrecht und blockiert das Deployment.
  Gegencheck, ob ein `git pull` überhaupt kollidieren kann:
  `git ls-tree <pi-commit> -- <file>` vs. `git ls-tree origin/main -- <file>` – gleiche
  Blob-Hashes = upstream unverändert = Pull läuft konfliktfrei durch.
- **Backfill-Migrationen gezielt verifizieren**, nicht nur „Container ist healthy“:
  betroffene Zeilen zählen (`count(*) FILTER (WHERE "repsLeft" IS NOT NULL)`) *und*
  gegenprüfen, dass nicht betroffene Zeilen unberührt blieben (muss `0` sein).
- **Build-Dauer:** ~575 s (≈10 min) für Backend+Frontend bei warmem Layer-Cache und nur
  Source-Änderungen. Bei geänderten Dockerfiles deutlich länger – vorher ankündigen,
  damit ein langer Build nicht als Hänger missverstanden wird.
- Unkritisches Log-Rauschen, nicht als Fehler melden: `LegacyRouteConverter`-Warnung zu
  `/api/*` (path-to-regexp) und der npm-Update-Hinweis.

**Nach erfolgreichem Deployment:**
- Logs prüfen (`docker compose logs -f`)
- Backups prüfen / cron einrichten
- DEPLOYMENT-PLAN.md bei neuen Erkenntnissen aktualisieren

Bei jedem Deployment-Request:
1. Zuerst den Plan mit dem User abstimmen
2. Den Commit auf dem Pi erfragen und den echten Deploy-Range analysieren (siehe oben)
3. Alle Pre-Checks auflisten
4. Klar sagen, welcher Migrations-Fall vorliegt (Schema = deploy.sh genügt / Daten-Skript = SSH-Tunnel)
5. Schritt-für-Schritt Anleitung geben (mit exakten Befehlen), inkl. Verifikations-Queries und Rollback-Ziel

Fragt der User nach Anleitung statt Ausführung: nichts selbst ausführen, sondern Befehle
einzeln übergeben und die Ausgabe abwarten, bevor der nächste Schritt kommt.