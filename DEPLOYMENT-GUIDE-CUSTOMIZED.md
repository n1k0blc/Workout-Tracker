# 🚀 Deployment Guide - Angepasst für deinen Pi

Basierend auf Pi Inspection vom 30. März 2026

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
5. Datenbank-Migrationen ausführen
6. Health Checks durchführen
7. Alte Images aufräumen

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

### Build-Fehler:
```bash
# Neu bauen ohne Cache
docker compose -f docker-compose.prod.yml build --no-cache
```

### Datenbank-Fehler:
```bash
# Datenbank Logs
docker logs workout-tracker-db-prod

# In Datenbank-Container gehen
docker exec -it workout-tracker-db-prod bash
psql -U workoutuser -d workout_tracker
\dt  # Tabellen anzeigen
\q   # Beenden
```

### Cloudflare Tunnel funktioniert nicht:
```bash
# Tunnel Status
sudo systemctl status cloudflared

# Tunnel neu starten
sudo systemctl restart cloudflared

# Logs live ansehen
sudo journalctl -u cloudflared -f

# Config prüfen
cat ~/.cloudflared/config.yml
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

## ✅ Checkliste

- [ ] SSH-Verbindung zum Pi funktioniert
- [ ] Docker installiert
- [ ] Repository geklont
- [ ] .env.production erstellt mit Secrets
- [ ] Cloudflare Tunnel Config erweitert
- [ ] DNS Record in Cloudflare erstellt
- [ ] Deployment ausgeführt
- [ ] Alle 3 Container laufen (healthy)
- [ ] Website erreichbar unter workout.nikobjelic.com
- [ ] Account erstellt und getestet
- [ ] Automatische Backups eingerichtet

---

**Zeit gesamt:** ~45-60 Minuten (hauptsächlich Docker Build beim ersten Mal)

**Bei Problemen:** Logs prüfen, bestehende Apps sollten weiterhin funktionieren!
