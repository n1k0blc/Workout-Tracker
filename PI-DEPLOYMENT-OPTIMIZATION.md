# Raspberry Pi Deployment Optimierungen – Lessons Learned

**Status:** Aktuell (nach Reset auf stabilen State)  
**Ziel:** Leichtere, schnellere und zuverlässigere Deployments auf dem Raspberry Pi (ARM64)

## Einleitung

Das Deployment der Workout-Tracker-Anwendung auf einem Raspberry Pi 5 ist ressourcenintensiv. Die Hauptprobleme sind:

- Sehr lange Docker-Build-Zeiten (teilweise > 30–40 Minuten bei clean Cache)
- Komplexität durch Monorepo (npm Workspaces), Next.js, NestJS und Prisma
- Notwendigkeit von Dev-Tools (Prisma CLI) zur Runtime für `prisma migrate deploy`
- Netzwerk- und ARM-spezifische Verlangsamungen bei `npm ci`

Dieses Dokument dokumentiert, was wir bereits ausprobiert haben und gibt konkrete Empfehlungen für zukünftige Verbesserungen.

## Was wir bereits probiert haben

### 1. Ursprünglicher Ansatz (vor "Modernized Pi Deployment")
- In der Production-Stage wurde direkt `npm ci --workspace=backend --omit=dev` (bzw. frontend) ausgeführt.
- Vorteil: Einfach und funktioniert out-of-the-box.
- Nachteil: Extrem langsame Builds auf dem Pi, da jede Dependency-Auflösung + Netzwerk-Operationen auf der ARM-Hardware stattfinden.
- Ergebnis: Deployments dauerten 30–40+ Minuten.

### 2. "Modernized Pi Deployment" Optimierung (Commit e9e144c)
- **Builder-Stage**: Vollständiges `npm ci --workspace=...` + `npm prune --omit=dev`
- **Production-Stage**: Nur Kopieren der geprunten `node_modules` vom Builder + fertige Artefakte (`dist`, `.next`, etc.)
- Zusätzlich: Flags wie `--no-audit --no-fund --progress=false`
- Ziel: Vermeidung einer zweiten `npm ci` im finalen Image.
- Vorteil: Deutlich schnellere Production-Stage.
- Probleme, die auftraten:
  - Mit npm Workspaces ist die Node-Modules-Struktur (Hoisting) nicht immer deterministisch.
  - Prisma CLI (normalerweise devDependency) war nach `prune` nicht mehr vorhanden → Runtime-Fehler "Cannot find module 'effect'" oder "/app/node_modules/prisma/build/index.js".

### 3. Prisma-spezifische Workarounds und Experimente
Während der Fehlersuche (Prisma CLI nicht auffindbar im Prod-Image) wurden folgende Dinge ausprobiert:

- Verschiebung von `"prisma"` von `devDependencies` nach `dependencies` in `package.json`
- Explizites Backup des prisma-Packages **vor** dem prune:
  ```dockerfile
  RUN mkdir -p /prisma-backup && cp -r /app/node_modules/prisma /prisma-backup/prisma
  ```
- Restore nach dem prune
- Erstellung eines Wrapper-Scripts in der Prod-Stage (anstelle von `.bin`):
  ```dockerfile
  RUN printf '#!/bin/sh\nnode /app/node_modules/prisma/build/index.js "$@"\n' > /app/node_modules/.bin/prisma && \
      chmod +x /app/node_modules/.bin/prisma
  ```
- Explizites Overlay-COPY in der Prod-Stage:
  ```dockerfile
  COPY --from=builder /prisma-backup/prisma /app/node_modules/prisma
  ```
- Änderung des Start-Commands in `docker-compose.prod.yml` von `npx prisma...` zu direktem Pfad
- Verschiedene Positionierungen des Backups (direkt nach `npm ci`, nach `prisma generate`, etc.)
- Explizites `npm ls prisma || npm install prisma` als Guard

**Ergebnis:** Die Workarounds funktionierten teilweise, machten die Dockerfiles aber sehr komplex und fragil. Builds blieben weiterhin lang.

### 4. Cache- und Image-Cleanup-Strategien
- `docker builder prune -f`
- `docker system prune -a --volumes -f`
- `docker image prune -a -f`
- Vollständiges Cleanup vor jedem Deploy

Diese Schritte halfen, Inkonsistenzen und veralteten Cache zu entfernen (teilweise mehrere GB).

### 5. Revert auf stabilen Stand
- Komplettes Zurücksetzen von `main` auf Commit `c063349` ("Mobile UI Improvements") – also vor allen Docker-Experimenten.
- Frischer Deploy mit den ursprünglichen Dockerfiles.
- Ergebnis: Deployment lief erfolgreich durch, allerdings mit den bekannten langen Build-Zeiten (ca. 39 Minuten).

## Erkenntnisse

- Der "Copy pruned node_modules"-Ansatz ist theoretisch richtig für Pi-Deployments, wird aber durch Workspaces + Prisma extrem kompliziert.
- `npm prune` entfernt Dinge, die zur Runtime noch gebraucht werden (Prisma CLI).
- Builds direkt auf dem Pi sind grundsätzlich langsam (begrenzte CPU, RAM, I/O, Netzwerk).
- Komplexe Workarounds im Dockerfile erhöhen die Fehleranfälligkeit massiv.
- Ein sauberer, simpler Dockerfile ist oft wartbarer als ein "optimiertes" mit vielen Hacks.

## Empfehlungen für die Zukunft

### 1. Build außerhalb des Pis (stärkste Empfehlung)
- Nutze GitHub Actions (oder einen stärkeren Builder-Server) zum Bauen der Images.
- Baue für `linux/arm64` (mit `docker buildx` oder GitHub ARM-Runnern).
- Push die fertigen Images in eine Registry (z. B. GitHub Container Registry).
- Auf dem Pi nur noch: `docker compose pull && docker compose up -d`
- Vorteile: Deutlich schnellere Deploys, keine CPU-Last auf dem Pi während des Builds, besseres Caching möglich.

### 2. Saubere Multi-Stage Dockerfiles
- Trenne strikt zwischen Build- und Runtime-Dependencies.
- Verwende Docker BuildKit Cache-Mounts für npm:
  ```dockerfile
  RUN --mount=type=cache,target=/root/.npm \
      npm ci --workspace=backend --no-audit --no-fund
  ```
- Kopiere zuerst nur `package*.json`, dann erst den Source-Code (besseres Layer-Caching).
- Für Prisma:
  - Entweder `prisma` dauerhaft in `dependencies` lassen (etwas größeres Image akzeptieren), **oder**
  - Migrationen in einem separaten Init-Container oder vor dem eigentlichen Start ausführen.

### 3. Vermeidung von .bin / Symlink-Problemen
- Statt auf `node_modules/.bin/prisma` zu vertrauen: Direkten Node-Aufruf verwenden.
- Oder explizit den Binary-Pfad im Dockerfile anlegen und sicherstellen.

### 4. Deployment-Prozess optimieren
- Füge regelmäßiges Pruning als separaten Job hinzu (nicht nur manuell).
- Nutze `docker buildx bake` mit Caching-Optionen.
- Erwäge Pre-Builds in CI/CD mit Layer-Caching zwischen Builds.
- Vermeide `--no-cache` bei jedem Deploy (nur bei Bedarf).

### 5. Alternative Tools und Patterns
- Erwäge den Wechsel zu **pnpm** oder **Yarn Berry** (besseres Caching, kleinere node_modules).
- Nutze `npm ci --production` konsequenter.
- Für das Frontend: Next.js Standalone-Output bereits gut genutzt – weiter ausbauen.
- Erwäge kleinere Base-Images (z. B. `node:20-alpine-slim` oder Distroless, wo möglich).

### 6. Ressourcen-Management auf dem Pi
- Setze explizite Memory- und CPU-Limits in `docker-compose.prod.yml`.
- Überwache regelmäßig mit dem `pi-inspect.sh` Script.
- Vermeide vollständige Swap-Nutzung.
- Entferne unnötige Hintergrundprozesse (z. B. Playwright-Instanzen, wenn nicht aktiv).

### 7. Langfristige Strategie
- Definiere einen "Golden Path" für Dockerfiles (einfach + wartbar).
- Dokumentiere klare Build- vs. Runtime-Anforderungen (besonders bei Tools wie Prisma).
- Teste Deployments regelmäßig mit clean Cache.
- Erwäge später einen selbst-gehosteten ARM-Builder, falls GitHub Actions nicht ausreicht.

## Nächste Schritte (Vorschlag)

1. Aktuellen (stabilen) Stand dokumentieren und als Baseline behalten.
2. Einen sauberen, optimierten Dockerfile-Entwurf mit BuildKit-Cache und korrektem Prisma-Handling erstellen.
3. Build-Prozess schrittweise in GitHub Actions auslagern (zuerst nur für Backend, dann Frontend).
4. `DEPLOYMENT-PLAN.md` und dieses Dokument synchron halten.
5. Nach erfolgreicher Implementierung: Performance-Messungen (Build-Zeit, Image-Größe, Start-Zeit).

---

Dieses Dokument dient als Referenz für zukünftige Optimierungsarbeiten am Deployment-Prozess.
