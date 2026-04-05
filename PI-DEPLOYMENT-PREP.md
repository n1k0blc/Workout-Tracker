# Pi Deployment Vorbereitung

## Schnell-Anleitung für das nächste Production Deployment

### 1. CSV Dateien vorbereiten

Auf dem Pi (oder lokal vor dem SCP):

```bash
# Auf Pi in Projekt-Verzeichnis
cd ~/apps/Workout-Tracker

# data/ Ordner erstellen
mkdir -p data

# CSV Dateien kopieren
cp Exercises.csv data/
cp Exercises_old.csv data/
```

**Von lokalem Rechner (alternativ):**
```bash
# CSV Dateien zum Pi kopieren
scp Exercises.csv Exercises_old.csv n1k0@n1k0blc-pi.local:~/apps/Workout-Tracker/data/
```

### 2. Git Merge vorbereiten

**Lokal:**
```bash
# PR auf GitHub erstellen: dev → main
# PR mergen
```

**Auf Pi:**
```bash
ssh n1k0@n1k0blc-pi.local
cd ~/apps/Workout-Tracker

# Main branch pullen
git checkout main
git pull origin main

# Prüfen ob CSV Dateien da sind
ls -lh data/
# Sollte zeigen: Exercises.csv, Exercises_old.csv
```

### 3. Deployment ausführen

Folge den Schritten in [NEXT-DEPLOYMENT.md](./NEXT-DEPLOYMENT.md)

**Quick-Steps:**
1. ✅ Backup erstellen (`./backup.sh`)
2. ✅ CSV Dateien in data/ Ordner (siehe oben)
3. ✅ Container stoppen & neu builden
4. ✅ Prisma Migration (`prisma migrate deploy`)
5. ✅ HomeGym Migration (`npm run migrate:home-gyms`)
6. ✅ Exercise Update (`npm run migrate:update-exercises`)
7. ✅ Health Checks & Testing

### 4. Was sind die CSV Dateien?

- **Exercises.csv** - Neue/aktualisierte Übungsnamen mit korrekten Flags
- **Exercises_old.csv** - Alte Übungsnamen für Mapping

Das `update-exercises.ts` Script:
- Mapped alte Namen zu neuen Namen
- Updated isUnilateral und isDoubleWeight Flags
- Für alle non-custom Exercises

### 5. Docker Volume Mount

Die `docker-compose.prod.yml` mounted jetzt automatisch:
```yaml
volumes:
  - ./data/Exercises.csv:/app/Exercises.csv:ro
  - ./data/Exercises_old.csv:/app/Exercises_old.csv:ro
```

Das bedeutet:
- ✅ CSV Dateien müssen in `data/` liegen **VOR** `docker-compose up`
- ✅ Kein `docker cp` nötig
- ✅ Reproduzierbar und sauber
- ✅ Read-only Mount (`:ro`) = Sicher

### 6. Troubleshooting

**CSV Dateien nicht gefunden:**
```bash
# Prüfen ob Dateien da sind
ls -lh ~/apps/Workout-Tracker/data/

# Falls nicht: Kopieren (siehe Schritt 1)
```

**Container startet nicht:**
```bash
# Logs checken
docker logs workout-tracker-backend-prod

# Häufigste Ursache: CSV Dateien fehlen
# → Dateien kopieren, Container neu starten
```

---

**Siehe auch:**
- [NEXT-DEPLOYMENT.md](./NEXT-DEPLOYMENT.md) - Vollständige Deployment-Anleitung
- [PRODUCTION-MIGRATION-GUIDE.md](./PRODUCTION-MIGRATION-GUIDE.md) - Lessons Learned
