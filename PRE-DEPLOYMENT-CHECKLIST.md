# 🔍 Pre-Deployment Checklist & Pi Inspection

Bevor wir irgendetwas deployen, müssen wir verstehen, was bereits auf deinem Pi läuft.

## 📋 Schritt 1: GitHub Repository vorbereiten

### Auf GitHub.com:
1. Gehe zu https://github.com/new
2. **Repository Name:** `workout-tracker`
3. **Visibility:** Private (empfohlen)
4. **NICHT initialisieren** - wir haben schon alles
5. Klicke **"Create repository"**

### Lokal committen und pushen:
```bash
cd /Users/n1k0/Projects/Workout-Tracker

# Git initialisieren (falls noch nicht geschehen)
git init

# Alle Dateien hinzufügen
git add .

# Commit
git commit -m "Initial commit: Workout Tracker v1.0 - Ready for Pi deployment"

# Remote hinzufügen (ersetze YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/workout-tracker.git

# Branch zu main umbenennen
git branch -M main

# Pushen
git push -u origin main
```

---

## 🔍 Schritt 2: Pi Inspection durchführen

### 1. Inspection Script auf den Pi kopieren

**Option A: Mit scp (vom Mac aus):**
```bash
cd /Users/n1k0/Projects/Workout-Tracker
scp pi-inspect.sh pi@YOUR_PI_IP:~/
```

**Option B: Manuell (auf dem Pi):**
```bash
# SSH zum Pi
ssh pi@YOUR_PI_IP

# Script erstellen
nano ~/pi-inspect.sh
# Inhalt von pi-inspect.sh kopieren und einfügen
# Speichern: Ctrl+O, Enter, Ctrl+X

# Ausführbar machen
chmod +x ~/pi-inspect.sh
```

### 2. Inspection durchführen

```bash
# Auf dem Pi:
./pi-inspect.sh > pi-inspection-report.txt

# Report ansehen
cat pi-inspection-report.txt

# Optional: Report auf den Mac kopieren
# (von Mac aus):
scp pi@YOUR_PI_IP:~/pi-inspection-report.txt ~/Desktop/
```

---

## 📊 Schritt 3: Ergebnisse analysieren

### Wichtige Dinge zu prüfen:

#### A. Ressourcen
- [ ] **RAM Total:** Minimum 2GB empfohlen für 3 Container
- [ ] **RAM Verwendet:** < 60% wäre gut
- [ ] **Disk Space:** Minimum 10GB frei
- [ ] **CPU:** Pi 3B+ oder besser

#### B. Ports (bereits in Verwendung?)
Check diese Ports im Report:
- Port **3000** - Normales Frontend
- Port **3001** - Normales Backend  
- Port **5432** - PostgreSQL

**Wenn belegt:** Notiere alternative Ports (z.B. 3002, 3003)

#### C. Existierende Apps
- [ ] Wo liegen sie? (Häufig: `~/apps/`, `~/projects/`, `/var/www/`)
- [ ] Welche Docker Container laufen bereits?
- [ ] Welche Ports nutzen sie?

#### D. Cloudflare Tunnel
- [ ] Ist bereits ein Tunnel aktiv?
- [ ] Welche Hostnames sind bereits konfiguriert?
- [ ] Wo liegt die Config? (`~/.cloudflared/config.yml`)

---

## 🎯 Schritt 4: Basierend auf Ergebnissen Ports zuweisen

### Szenario 1: Ports 3000/3001 frei ✅
```bash
# Verwende Standard-Ports:
FRONTEND_PORT=3000
BACKEND_PORT=3001
```

### Szenario 2: Ports belegt ⚠️
```bash
# Alternative Ports wählen:
FRONTEND_PORT=3002  # oder 3003, 3010, etc.
BACKEND_PORT=3003   # oder 3004, 3011, etc.
```

**Wichtig:** Diese Ports müssen dann in folgenden Dateien angepasst werden:
- `docker-compose.prod.yml` (ports Sektion)
- `~/.cloudflared/config.yml` (service URLs)

---

## ☁️ Schritt 5: Cloudflare Subdomain anlegen

### A. Subdomain in IONOS vorbereiten (optional)
Cloudflare übernimmt das DNS - du musst nichts bei IONOS ändern.

### B. Subdomain in Cloudflare
1. Gehe zu https://dash.cloudflare.com
2. Wähle **nikobjelic.com**
3. **DNS** → **Add record**
4. **Noch nicht erstellen!** - Wir machen das NACH dem Tunnel-Setup

---

## 🚧 Schritt 6: Angepasster Deployment-Plan

Basierend auf dem Inspection Report erstellen wir einen **maßgeschneiderten** Plan:

### Was wir NICHT tun:
- ❌ Bestehende Cloudflare Tunnel Config überschreiben
- ❌ Ports verwenden, die bereits belegt sind
- ❌ Bestehende Docker Container stören
- ❌ Ohne Backup deployen

### Was wir tun:
- ✅ Bestehende Tunnel Config **erweitern** (neue ingress rules hinzufügen)
- ✅ Freie Ports verwenden
- ✅ Separates Docker Network für Isolation
- ✅ Backup-Plan falls etwas schief geht

---

## 📝 Nächste Schritte - Warten auf Inspection Results

**Bitte führe jetzt aus:**

1. **GitHub Repo erstellen & pushen** (dauert 5 Min)
2. **Pi Inspection Script ausführen** (dauert 2 Min)
3. **Report teilen** - Schick mir die wichtigsten Infos:
   - Wie viel RAM ist noch frei?
   - Welche Ports sind belegt?
   - Wo liegen die anderen Apps?
   - Gibt es bereits eine Cloudflare Tunnel Config?
   - Welche Docker Container laufen?

**Dann kann ich:**
- Docker-Compose File mit den richtigen Ports anpassen
- Cloudflare Tunnel Config so anpassen, dass sie die bestehende **ergänzt**
- Einen sicheren Deployment-Plan mit Rollback-Option erstellen

---

## 💡 Development Workflow (nach Deployment)

```
┌─────────────┐
│   Mac/Dev   │  Lokale Entwicklung mit npm run dev
└──────┬──────┘
       │ git commit & push
       ▼
┌─────────────┐
│   GitHub    │  Code Repository
└──────┬──────┘
       │ git pull (manuell oder automatisch)
       ▼
┌─────────────┐
│ Raspberry Pi│  ./deploy.sh → Docker Rebuild
└─────────────┘
```

**Lokale Entwicklung bleibt unverändert:**
- Backend: `npm run start:dev` (Port 3001)
- Frontend: `npm run dev` (Port 3000)
- Lokale PostgreSQL über Docker

**Production auf Pi:**
- Separate Docker Container
- Eigene Ports (je nach Inspection)
- Eigene Datenbank
- Cloudflare Tunnel für externen Zugriff

---

## 🔒 Sicherheits-Tipps

1. **Backup vor Deployment:**
   ```bash
   # Auf dem Pi, falls bereits Daten vorhanden:
   docker ps  # Laufende Container notieren
   # Configs sichern
   cp ~/.cloudflared/config.yml ~/.cloudflared/config.yml.backup
   ```

2. **Rollback-Plan:**
   Wenn etwas schief geht:
   ```bash
   # Container stoppen
   cd ~/apps/workout-tracker
   docker compose -f docker-compose.prod.yml down
   
   # Alte Tunnel Config wiederherstellen
   cp ~/.cloudflared/config.yml.backup ~/.cloudflared/config.yml
   sudo systemctl restart cloudflared
   ```

3. **Ressourcen-Limits setzen:**
   Falls der Pi wenig RAM hat, können wir in docker-compose.yml Limits setzen.

---

## ✅ Bereit für Inspection!

Führe jetzt **pi-inspect.sh** aus und teile die Ergebnisse. Dann passen wir alles sicher an! 🚀
