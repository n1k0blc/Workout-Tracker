# Production Migration Guide

## Probleme beim ersten Deployment (2. April 2026)

### 1. **Migration Scripts nicht im Docker Container**
**Problem:**
- Das `scripts/` Verzeichnis wurde nicht ins Docker Image kopiert
- Das Dockerfile kopiert nur `src/` und `dist/` für Production
- Migration Scripts waren nur auf dem Host verfügbar

**Workaround:**
```bash
docker cp ~/apps/Workout-Tracker/apps/backend/scripts/migrate-production-exercises.ts \
  workout-tracker-backend-prod:/app/migrate.ts
```

### 2. **CSV Dateien nicht im Container**
**Problem:**
- Die CSV Dateien (`Exercises.csv`, `Exercises_old.csv`) liegen im Root des Projekts
- Dockerfile kopiert sie nicht ins Image
- Migration Script konnte sie nicht finden

**Workaround:**
```bash
docker cp Exercises.csv workout-tracker-backend-prod:/app/
docker cp Exercises_old.csv workout-tracker-backend-prod:/app/
```

### 3. **TypeScript Runtime fehlt in Production**
**Problem:**
- `ts-node` ist nicht in Production Dependencies
- `tsx` ist auch nicht installiert
- Container kann `.ts` Dateien nicht ausführen

**Workaround:**
```bash
# npx installiert tsx temporär
docker exec workout-tracker-backend-prod npx tsx /tmp/migrate.ts
```

### 4. **Falsche Pfade im Migration Script**
**Problem:**
- Script verwendet `__dirname` und relative Pfade
- Im Container sind die Pfade anders als auf dem Dev-System
- `path.join(__dirname, '../../../Exercises.csv')` führt ins Nichts

**Workaround:**
```bash
# Pfade im Script mit sed anpassen
sed -i "s|__dirname, '../../../Exercises|'/app/Exercises|g" migrate.ts
```

### 5. **NODE_PATH für Prisma Client**
**Problem:**
- `@prisma/client` war nicht auffindbar
- Script lief nicht aus dem richtigen Working Directory

**Workaround:**
```bash
docker exec -w /app/apps/backend \
  -e NODE_PATH=/app/apps/backend/node_modules:/app/node_modules \
  workout-tracker-backend-prod npx tsx /tmp/migrate.ts
```

### 6. **Permission Issues im Container**
**Problem:**
- Container läuft als `nodejs` User (nicht root)
- Kein Schreibzugriff auf `/app/` Verzeichnis
- Mussten `/tmp/` für temporäre Dateien nutzen

---

## Bessere Lösungen für zukünftige Migrations

### ✅ Lösung 1: **Migration Scripts ins Docker Image bauen**

**Dockerfile ändern:**
```dockerfile
# In apps/backend/Dockerfile
FROM node:20-alpine as production

# ... existing code ...

# Kopiere Migration Scripts
COPY apps/backend/scripts ./apps/backend/scripts

# Kopiere CSV Dateien wenn benötigt
COPY Exercises*.csv /app/

# Installiere ts-node für Migrations
RUN npm install -g tsx

# ... rest of dockerfile ...
```

**Vorteil:**
- Scripts sind immer im Container verfügbar
- Keine manuelle Kopiererei
- Reproduzierbar

**Nachteil:**
- Image wird größer
- CSV Dateien werden "eingebacken" (nicht ideal für dynamische Daten)

---

### ✅ Lösung 2: **Migrations als npm Scripts definieren**

**package.json:**
```json
{
  "scripts": {
    "migrate:prod": "tsx scripts/migrate-production-exercises.ts",
    "migrate:deploy": "prisma migrate deploy && npm run migrate:prod"
  }
}
```

**Im deploy.sh:**
```bash
# Nach docker-compose up
echo "Running database migrations..."
docker exec workout-tracker-backend-prod npm run migrate:deploy
```

**Vorteil:**
- Standardisierter Prozess
- Einfach zu dokumentieren
- Automatisierbar

---

### ✅ Lösung 3: **Separate Migration Container/Job**

**docker-compose.prod.yml:**
```yaml
services:
  migration:
    image: workout-tracker-backend:latest
    command: npm run migrate:deploy
    environment:
      - DATABASE_URL=${DATABASE_URL}
    volumes:
      - ./Exercises.csv:/app/Exercises.csv
      - ./Exercises_old.csv:/app/Exercises_old.csv
    depends_on:
      - db
    restart: "no"  # Läuft einmal und stoppt
```

**Deployment:**
```bash
docker-compose -f docker-compose.prod.yml up migration
docker-compose -f docker-compose.prod.yml up -d backend frontend
```

**Vorteil:**
- Saubere Trennung
- Migration läuft vor App-Start
- Fehler bei Migration verhindern App-Start

---

### ✅ Lösung 4: **CSV Dateien als Docker Volume mounten**

**docker-compose.prod.yml:**
```yaml
services:
  backend:
    volumes:
      - ./data/Exercises.csv:/app/data/Exercises.csv:ro
      - ./data/Exercises_old.csv:/app/data/Exercises_old.csv:ro
```

**Migration Script:**
```typescript
// Nutze feste Pfade die im Volume gemountet sind
const oldCsvPath = '/app/data/Exercises_old.csv';
const newCsvPath = '/app/data/Exercises.csv';
```

**Vorteil:**
- CSV Dateien können aktualisiert werden ohne Rebuild
- Kein docker cp nötig
- Klare Trennung zwischen Code und Daten

---

### ✅ Lösung 5: **Migration via API Endpoint (fortgeschritten)**

**Backend Controller:**
```typescript
@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  @Post('migrate/exercises')
  async migrateExercises() {
    // Lese CSV aus S3/Storage
    // Führe Migration aus
    // Return Status
  }
}
```

**Vorteil:**
- Kann remote getriggert werden
- Logging und Status-Tracking möglich
- Keine Shell-Zugriff auf Server nötig

**Nachteil:**
- Komplexer zu implementieren
- Benötigt Auth/Admin Guards
- Gefährlich wenn falsch implementiert

---

## Empfohlener Workflow für nächste Migration

### Vorbereitung (auf Dev):
1. Migration Script schreiben und lokal testen
2. CSV Dateien vorbereiten
3. Im Script **absolute Container-Pfade** nutzen:
   ```typescript
   const csvPath = process.env.CSV_PATH || '/app/data/exercises.csv';
   ```

### Deployment:
1. **Backup erstellen:**
   ```bash
   ./backup.sh
   ```

2. **Code und Daten vorbereiten:**
   ```bash
   # CSV Dateien nach data/ Ordner
   mkdir -p data
   cp Exercises*.csv data/
   ```

3. **Docker Image neu bauen:**
   ```bash
   ./deploy.sh
   ```

4. **Migration ausführen:**
   ```bash
   # Option A: Im deploy.sh integriert
   # Option B: Manuell
   docker exec workout-tracker-backend-prod npm run migrate:prod
   ```

5. **Validierung:**
   ```bash
   # Prüfe Logs
   docker logs workout-tracker-backend-prod --tail 100
   
   # Prüfe DB
   docker exec workout-tracker-backend-prod npx prisma studio
   ```

6. **Rollback Plan:**
   ```bash
   # Falls etwas schief geht
   ./restore.sh db_backup_YYYYMMDD_HHMMSS.sql.gz
   
   # Oder: Alte Container Version
   docker-compose down
   docker-compose up -d --build --force-recreate
   ```

---

## Checkliste für Production Migration

- [ ] Lokales Backup der Production DB erstellt
- [ ] Migration Script lokal getestet
- [ ] CSV Dateien/Daten vorbereitet
- [ ] Dockerfile inkludiert alle benötigten Dateien
- [ ] Migration Script nutzt Container-Pfade (nicht __dirname)
- [ ] npm Scripts für Migration definiert
- [ ] deploy.sh inkludiert Migration Step
- [ ] Rollback Plan dokumentiert
- [ ] Downtime kommuniziert (falls nötig)
- [ ] Post-Migration Validierung vorbereitet

---

## Tools & Commands

### Nützliche Docker Commands:
```bash
# Script in Container kopieren
docker cp ./script.ts container:/tmp/

# Script im Container ausführen
docker exec container npx tsx /tmp/script.ts

# Logs anschauen
docker logs -f container

# In Container Shell einsteigen
docker exec -it container sh

# Dateien aus Container kopieren (für Debugging)
docker cp container:/app/output.log ./
```

### Nützliche Prisma Commands:
```bash
# Migration Status prüfen
docker exec container npx prisma migrate status

# Migration im Container
docker exec container npx prisma migrate deploy

# Prisma Client regenerieren
docker exec container npx prisma generate
```

---

## Lessons Learned

1. **Docker Images sollten self-contained sein**: Alle benötigten Scripts und Daten sollten im Image sein oder als Volumes gemountet werden

2. **Keine manuellen docker cp Commands in Production**: Nicht reproduzierbar, fehleranfällig

3. **Migrations sollten Teil des Deployment Prozesses sein**: Automatisch, nicht manuell

4. **Immer Backups vor Migrations**: Kein Deploy ohne Backup!

5. **Testing ist wichtig**: Migration erst lokal testen, dann auf einem Staging Environment, dann Production

6. **Idempotenz**: Migration Scripts sollten mehrmals ausführbar sein ohne Schaden anzurichten

7. **Logging**: Ausführliche Logs helfen bei Debugging (`console.log`, `✓`, `❌`)

---

## Datum dieser Doku
Erstellt: 2. April 2026
Letztes Update: 2. April 2026
Version: 1.0
