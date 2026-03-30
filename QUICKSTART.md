# 🚀 Quick Start Guide - Workout Tracker to GitHub & Raspberry Pi

## ⚠️ STOP! Read This First

**Dieser Guide ist für NEUE Deployments auf einem LEEREN Pi gedacht.**

**Wenn dein Pi bereits andere Apps hostet:**
1. **NICHT** diesem Guide blind folgen!
2. Lies stattdessen **[PRE-DEPLOYMENT-CHECKLIST.md](PRE-DEPLOYMENT-CHECKLIST.md)**
3. Führe `pi-inspect.sh` aus
4. Passe die Konfiguration basierend auf den Ergebnissen an

**Warum?**
- Deine bestehenden Apps könnten dieselben Ports nutzen
- Dein Cloudflare Tunnel ist bereits konfiguriert
- Wir müssen sicherstellen, dass nichts kaputt geht

---

- GitHub Account
- Raspberry Pi mit SSH-Zugang
- Docker auf Pi installiert
- Cloudflare Account

---

## 1️⃣ GitHub Repository erstellen

### Auf GitHub.com:
1. Gehe zu https://github.com/new
2. **Repository Name:** `workout-tracker`
3. **Visibility:** Private (empfohlen) oder Public
4. **NICHT initialisieren** mit README, .gitignore oder License (haben wir schon!)
5. Klicke **"Create repository"**

### Lokal auf deinem Mac:
```bash
cd /Users/n1k0/Projects/Workout-Tracker

# Git initialisieren (falls noch nicht geschehen)
git init
git add .
git commit -m "Initial commit: Workout Tracker v1.0 - Production ready"

# Remote hinzufügen (ersetze YOUR_USERNAME mit deinem GitHub Username)
git remote add origin https://github.com/YOUR_USERNAME/workout-tracker.git

# Branch umbenennen zu main (falls nötig)
git branch -M main

# Pushen!
git push -u origin main
```

**✅ Check:** Dein Code ist jetzt auf GitHub!

---

## 2️⃣ Raspberry Pi vorbereiten

### SSH zum Pi:
```bash
ssh pi@your-pi-ip
```

### Software installieren:
```bash
# System updaten
sudo apt update && sudo apt upgrade -y

# Docker installieren (falls nicht vorhanden)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Docker Compose Plugin
sudo apt install -y docker-compose-plugin

# Git installieren
sudo apt install -y git

# Cloudflared installieren (für ARM64)
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
sudo dpkg -i cloudflared-linux-arm64.deb

# Neu einloggen um Docker ohne sudo zu nutzen
exit
ssh pi@your-pi-ip
```

### Ressourcen prüfen:
```bash
# RAM (Empfohlung: min. 2GB)
free -h

# Speicher (Empfehlung: min. 10GB frei)
df -h

# CPU Info
cat /proc/cpuinfo | grep "Model"

# Docker läuft?
docker --version
docker compose version
```

**✅ Check:** Pi ist bereit mit Docker!

---

## 3️⃣ Cloudflare Tunnel einrichten

### Tunnel erstellen:
```bash
# Login (öffnet Browser)
cloudflared tunnel login

# Tunnel erstellen
cloudflared tunnel create workout-tracker

# Notiere dir die Tunnel-ID aus der Ausgabe!
# z.B.: Created tunnel workout-tracker with id: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### Config erstellen:
```bash
# Config-Datei erstellen
nano ~/.cloudflared/config.yml
```

**Füge ein (ersetze <TUNNEL-ID>):**
```yaml
tunnel: <TUNNEL-ID>
credentials-file: /home/pi/.cloudflared/<TUNNEL-ID>.json

ingress:
  - hostname: workout.nikobjelic.com
    service: http://localhost:3000
  
  - service: http_status:404
```

**Speichern:** `Ctrl+O` → Enter → `Ctrl+X`

### Tunnel als Service starten:
```bash
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared

# Status prüfen
sudo systemctl status cloudflared
```

### DNS in Cloudflare konfigurieren:
1. Gehe zu https://dash.cloudflare.com
2. Wähle deine Domain: **nikobjelic.com**
3. **DNS** → **Add record**
4. **Type:** CNAME
5. **Name:** workout
6. **Target:** `<TUNNEL-ID>.cfargotunnel.com`
7. **Proxy status:** Proxied (Orange Cloud ✅)
8. **Save**

**✅ Check:** `workout.nikobjelic.com` wird zu deinem Tunnel weitergeleitet!

---

## 4️⃣ Applikation deployen

### Repository klonen (auf Pi):
```bash
cd ~
mkdir -p apps
cd apps
git clone https://github.com/YOUR_USERNAME/workout-tracker.git
cd workout-tracker
```

### Environment Variables einrichten:
```bash
# .env.production erstellen
cp .env.production.example .env.production
nano .env.production
```

**Fülle aus:**
```bash
# Starke Passwörter generieren mit:
# DB Password: openssl rand -base64 32
# JWT Secret: openssl rand -base64 48

DB_USER=workoutuser
DB_PASSWORD=<GENERIERTES_PASSWORT_HIER>
DB_NAME=workout_tracker

JWT_SECRET=<GENERIERTER_JWT_SECRET_HIER>
JWT_EXPIRATION=7d

CORS_ORIGIN=https://workout.nikobjelic.com
NEXT_PUBLIC_API_URL=https://workout.nikobjelic.com/api
```

**Speichern:** `Ctrl+O` → Enter → `Ctrl+X`

### Skripte ausführbar machen:
```bash
chmod +x deploy.sh backup.sh restore.sh
```

### 🚀 DEPLOY!
```bash
./deploy.sh
```

**Das Skript:**
1. Pulled latest code von GitHub
2. Baut Docker images (dauert 5-10 Min beim ersten Mal)
3. Startet alle Container
4. Führt DB-Migrationen aus
5. Prüft Health Checks
6. Räumt alte Images auf

### Deployment überwachen:
```bash
# Logs live anschauen
docker compose -f docker-compose.prod.yml logs -f

# Nur Backend
docker logs -f workout-tracker-backend-prod

# Nur Frontend  
docker logs -f workout-tracker-frontend-prod

# Container Status
docker ps

# Stoppen mit Ctrl+C
```

**✅ Check:** Alle 3 Container laufen (postgres, backend, frontend)!

---

## 5️⃣ Testen

### Health Checks:
```bash
# Backend Health
curl http://localhost:3001/api/health

# Frontend
curl http://localhost:3000

# Von außen (von deinem Mac):
curl https://workout.nikobjelic.com
```

### Im Browser:
Öffne: **https://workout.nikobjelic.com**

1. **Registrieren:** Einen Account erstellen
2. **Login:** Einloggen
3. **Workout starten:** Ein Workout testen
4. **Daten speichern:** Sätze loggen
5. **Analytics ansehen:** PRs & Volumen prüfen
6. **History ansehen:** Verlauf mit Filtern testen

**✅ Check:** Alles funktioniert!

---

## 6️⃣ Automatisierung einrichten

### Automatische Backups:
```bash
# Crontab öffnen
crontab -e

# Füge hinzu (täglich um 3 Uhr morgens):
0 3 * * * /home/pi/apps/workout-tracker/backup.sh >> /home/pi/logs/backup.log 2>&1

# Log-Ordner erstellen
mkdir -p ~/logs
```

### Container Auto-Restart:
Die Container starten automatisch nach Reboot (wegen `restart: always` in docker-compose.yml)

**Test:**
```bash
sudo reboot
# Nach Neustart:
ssh pi@your-pi-ip
docker ps  # Alle Container sollten laufen!
```

**✅ Check:** Backups laufen, Auto-Restart funktioniert!

---

## 7️⃣ Wartung & Updates

### Update von GitHub deployen:
```bash
cd ~/apps/workout-tracker
./deploy.sh
```

### Manuelles Backup:
```bash
./backup.sh
```

### Backup wiederherstellen:
```bash
ls ~/backups/workout-tracker/  # Verfügbare Backups ansehen
./restore.sh ~/backups/workout-tracker/db_backup_20260330_030000.sql.gz
```

### Logs ansehen:
```bash
# Live Logs
docker compose -f docker-compose.prod.yml logs -f

# Letzte 100 Zeilen vom Backend
docker logs --tail 100 workout-tracker-backend-prod

# Cloudflare Tunnel Logs
sudo journalctl -u cloudflared -f
```

### Container neu starten:
```bash
docker compose -f docker-compose.prod.yml restart

# Nur Backend
docker restart workout-tracker-backend-prod
```

### Ressourcen überwachen:
```bash
# Docker Stats
docker stats

# Disk Space
df -h

# RAM
free -h

# CPU Temperature (Pi spezifisch)
vcgencmd measure_temp
```

---

## 🚨 Troubleshooting

### Problem: Container startet nicht
```bash
docker logs workout-tracker-backend-prod
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

### Problem: Website nicht erreichbar
```bash
# Cloudflare Tunnel Status
sudo systemctl status cloudflared

# Neu starten
sudo systemctl restart cloudflared

# Tunnel Logs
sudo journalctl -u cloudflared --no-pager | tail -50
```

### Problem: Database Connection Error
```bash
# DB läuft?
docker logs workout-tracker-db-prod

# Backend env prüfen
docker exec workout-tracker-backend-prod env | grep DATABASE

# DB neu starten
docker restart workout-tracker-db-prod
```

### Problem: Zu wenig Speicher
```bash
# Alte Docker Images löschen
docker system prune -a

# Logs rotieren
sudo journalctl --vacuum-time=7d

# Alte Backups löschen
find ~/backups/workout-tracker -name "*.sql.gz" -mtime +30 -delete
```

---

## 📊 Monitoring Dashboard (Optional)

### Portainer installieren (Docker GUI):
```bash
docker run -d \
  -p 9000:9000 \
  --name portainer \
  --restart=always \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v portainer_data:/data \
  portainer/portainer-ce:latest
```

Zugriff via: `http://pi-ip:9000`

---

## ✅ Checkliste

- [ ] GitHub Repository erstellt
- [ ] Code gepusht
- [ ] Raspberry Pi vorbereitet (Docker installiert)
- [ ] Cloudflare Tunnel erstellt
- [ ] DNS CNAME Record gesetzt
- [ ] Repository auf Pi geklont
- [ ] .env.production konfiguriert
- [ ] Deployment ausgeführt (./deploy.sh)
- [ ] Website erreichbar unter workout.nikobjelic.com
- [ ] Account erstellt und getestet
- [ ] Automatische Backups eingerichtet
- [ ] Auto-Restart nach Reboot getestet

---

## 🎉 Fertig!

Deine Workout Tracker App läuft jetzt produktiv auf deinem Raspberry Pi!

**URLs:**
- **Website:** https://workout.nikobjelic.com
- **Backend API:** https://workout.nikobjelic.com/api/health
- **Portainer:** http://pi-ip:9000 (optional)

**Nächste Schritte:**
- Erste Workouts loggen
- Einen Zyklus erstellen
- Custom Exercises hinzufügen
- Analytics ansehen

Bei Problemen: Siehe [DEPLOYMENT-PLAN.md](DEPLOYMENT-PLAN.md) für Details.

**Viel Erfolg beim Training! 💪**
