# 🚀 Deployment Plan - Workout Tracker auf Raspberry Pi

**Ziel:** Deployment der Workout Tracker Applikation auf Raspberry Pi unter `workout.nikobjelic.com`

**Datum:** 30. März 2026

**Status:** ⚠️ DRAFT - Benötigt Pi Inspection vor Ausführung

---

## ⚠️ WICHTIG: Lies das zuerst!

**Vor dem Deployment:**
1. Führe **[PRE-DEPLOYMENT-CHECKLIST.md](PRE-DEPLOYMENT-CHECKLIST.md)** aus
2. Führe `pi-inspect.sh` auf dem Pi aus
3. Passe diesen Plan basierend auf den Inspection-Ergebnissen an

**Dieser Plan geht davon aus:**
- Ports 3000/3001 sind frei (müssen ggf. angepasst werden)
- Keine Cloudflare Tunnel Config existiert (falls doch: muss erweitert werden, nicht ersetzt!)
- Mindestens 2GB RAM frei
- Mindestens 10GB Disk Space

---

## 📋 Übersicht

### Stack
- **Backend:** NestJS (Node.js) - Port 3001
- **Frontend:** Next.js 16.2 - Port 3000
- **Datenbank:** PostgreSQL 16
- **Reverse Proxy:** Nginx (optional, da Cloudflare Tunnel)
- **Tunnel:** Cloudflare Tunnel
- **Domain:** workout.nikobjelic.com

### Deployment-Strategie
- Docker-basiertes Deployment (Container für Backend, Frontend, DB)
- Cloudflare Tunnel für sicheren externen Zugriff
- Docker Compose für Orchestration
- Automatische Restarts bei Absturz/Reboot

---

## 🔍 Phase 1: Voraussetzungen prüfen

### 1.1 Raspberry Pi Ressourcen Check
```bash
# SSH zum Pi
ssh pi@your-pi-ip

# Ressourcen prüfen
free -h                  # RAM verfügbar
df -h                    # Speicherplatz
cat /proc/cpuinfo        # CPU Info
docker info              # Docker verfügbar?

# Empfohlene Mindestanforderungen:
# - RAM: 2GB+ (idealerweise 4GB+)
# - Speicher: 10GB+ frei
# - CPU: Raspberry Pi 3B+ oder neuer
```

### 1.2 Software Installation auf Pi
```bash
# Docker & Docker Compose installieren (falls nicht vorhanden)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Docker Compose installieren
sudo apt-get update
sudo apt-get install -y docker-compose-plugin

# Git installieren
sudo apt-get install -y git

# Cloudflared installieren (falls nicht vorhanden)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb
```

### 1.3 Ordnerstruktur auf Pi
```bash
# Projektverzeichnis erstellen
mkdir -p ~/apps/workout-tracker
cd ~/apps/workout-tracker
```

---

## 📦 Phase 2: GitHub Repository Setup

### 2.1 .gitignore prüfen/anpassen
Stelle sicher, dass folgende Dateien NICHT ins Repo kommen:
```
# Sensible Daten
.env
.env.production
.env.local

# Dependencies
node_modules/
dist/
.next/

# Logs
*.log
npm-debug.log*

# OS
.DS_Store
Thumbs.db

# Datenbank
*.db
postgres_data/

# IDE
.vscode/
.idea/
```

### 2.2 Git Repository initialisieren (lokal auf Mac)
```bash
cd /Users/n1k0/Projects/Workout-Tracker

# Git initialisieren (falls noch nicht geschehen)
git init

# Remote hinzufügen
git remote add origin https://github.com/YOUR_USERNAME/workout-tracker.git

# Alle Dateien committen
git add .
git commit -m "Initial commit: Workout Tracker v1.0"

# Pushen
git push -u origin main
```

### 2.3 GitHub Secrets einrichten (optional für CI/CD)
Später für automatische Deployments:
- `SSH_PRIVATE_KEY`
- `PI_HOST`
- `PI_USER`

---

## 🐳 Phase 3: Docker Setup für Produktion

### 3.1 Dockerfile für Backend erstellen
**`apps/backend/Dockerfile`**
```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Dependencies installieren
COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/
RUN npm ci --workspace=backend

# Prisma generieren
COPY apps/backend/prisma ./apps/backend/prisma
RUN cd apps/backend && npx prisma generate

# Source Code kopieren und builden
COPY apps/backend ./apps/backend
RUN npm run backend:build

# Production Stage
FROM node:20-alpine

WORKDIR /app

# Nur Production Dependencies
COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/
RUN npm ci --workspace=backend --production

# Prisma Client kopieren
COPY --from=builder /app/apps/backend/node_modules/.prisma ./apps/backend/node_modules/.prisma
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY apps/backend/prisma ./apps/backend/prisma

EXPOSE 3001

CMD ["node", "apps/backend/dist/main.js"]
```

### 3.2 Dockerfile für Frontend erstellen
**`apps/frontend/Dockerfile`**
```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Dependencies installieren
COPY package*.json ./
COPY apps/frontend/package*.json ./apps/frontend/
RUN npm ci --workspace=frontend

# Build
COPY apps/frontend ./apps/frontend
RUN npm run frontend:build

# Production Stage
FROM node:20-alpine

WORKDIR /app

# Nur Production Dependencies
COPY package*.json ./
COPY apps/frontend/package*.json ./apps/frontend/
COPY --from=builder /app/apps/frontend/.next ./apps/frontend/.next
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public
COPY apps/frontend/next.config.ts ./apps/frontend/

RUN npm ci --workspace=frontend --production

EXPOSE 3000

CMD ["npm", "run", "start", "--workspace=frontend"]
```

### 3.3 docker-compose.prod.yml erstellen
**`docker-compose.prod.yml`**
```yaml
version: '3.8'

services:
  # PostgreSQL Database (Production)
  postgres:
    image: postgres:16-alpine
    container_name: workout-tracker-db-prod
    restart: always
    environment:
      POSTGRES_USER: ${DB_USER:-workoutuser}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME:-workout_tracker}
    volumes:
      - postgres_data_prod:/var/lib/postgresql/data
    networks:
      - workout-network
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${DB_USER:-workoutuser}']
      interval: 10s
      timeout: 5s
      retries: 5

  # Backend API
  backend:
    build:
      context: .
      dockerfile: apps/backend/Dockerfile
    container_name: workout-tracker-backend-prod
    restart: always
    environment:
      NODE_ENV: production
      PORT: 3001
      DATABASE_URL: postgresql://${DB_USER:-workoutuser}:${DB_PASSWORD}@postgres:5432/${DB_NAME:-workout_tracker}?schema=public
      JWT_SECRET: ${JWT_SECRET}
      JWT_EXPIRATION: ${JWT_EXPIRATION:-7d}
      CORS_ORIGIN: https://workout.nikobjelic.com
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - workout-network
    command: sh -c "cd apps/backend && npx prisma migrate deploy && node dist/main.js"

  # Frontend
  frontend:
    build:
      context: .
      dockerfile: apps/frontend/Dockerfile
    container_name: workout-tracker-frontend-prod
    restart: always
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_API_URL: http://backend:3001
    depends_on:
      - backend
    networks:
      - workout-network

  # Nginx Reverse Proxy (optional, wenn kein Cloudflare Tunnel)
  nginx:
    image: nginx:alpine
    container_name: workout-tracker-nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - frontend
      - backend
    networks:
      - workout-network

networks:
  workout-network:
    driver: bridge

volumes:
  postgres_data_prod:
    driver: local
```

### 3.4 .dockerignore erstellen
**`.dockerignore`**
```
node_modules
npm-debug.log
.env
.env.*
.git
.gitignore
README.md
.next
dist
```

---

## 🔐 Phase 4: Environment Variables & Secrets

### 4.1 .env.production erstellen (auf Pi, NICHT ins Git!)
**`~/apps/workout-tracker/.env.production`**
```bash
# Database
DB_USER=workoutuser
DB_PASSWORD=SUPER_SECURE_PASSWORD_HIER_EINFÜGEN
DB_NAME=workout_tracker

# JWT
JWT_SECRET=SUPER_SECURE_JWT_SECRET_MINDESTENS_32_ZEICHEN_RANDOM
JWT_EXPIRATION=7d

# URLs
NEXT_PUBLIC_API_URL=https://workout.nikobjelic.com/api
```

### 4.2 Secrets generieren
```bash
# Starkes Passwort für DB
openssl rand -base64 32

# JWT Secret
openssl rand -base64 48
```

---

## 🌐 Phase 5: Cloudflare Tunnel Setup

### 5.1 Cloudflare Tunnel erstellen
```bash
# Auf dem Pi:
cloudflared tunnel login

# Tunnel erstellen
cloudflared tunnel create workout-tracker

# Credentials werden gespeichert unter:
# ~/.cloudflared/
```

### 5.2 Config-Datei erstellen
**`~/.cloudflared/config.yml`**
```yaml
url: http://localhost:80
tunnel: workout-tracker
credentials-file: /home/pi/.cloudflared/<TUNNEL-ID>.json

ingress:
  # Frontend (Next.js)
  - hostname: workout.nikobjelic.com
    service: http://localhost:3000
  
  # Backend API
  - hostname: workout.nikobjelic.com
    path: /api/*
    service: http://localhost:3001
  
  # Catch-all
  - service: http_status:404
```

### 5.3 DNS in Cloudflare konfigurieren
1. In Cloudflare Dashboard einloggen
2. Domain `nikobjelic.com` auswählen
3. DNS → CNAME Record hinzufügen:
   - **Name:** `workout`
   - **Target:** `<TUNNEL-ID>.cfargotunnel.com`
   - **Proxy:** ✅ Aktiviert

### 5.4 Tunnel als Service starten
```bash
# Service installieren
sudo cloudflared service install

# Service starten
sudo systemctl start cloudflared
sudo systemctl enable cloudflared

# Status prüfen
sudo systemctl status cloudflared
```

---

## 🚀 Phase 6: Deployment Prozess

### 6.1 Erstes Deployment auf Pi

```bash
# 1. SSH zum Pi
ssh pi@your-pi-ip

# 2. Repository klonen
cd ~/apps
git clone https://github.com/YOUR_USERNAME/workout-tracker.git
cd workout-tracker

# 3. .env.production erstellen (siehe Phase 4.1)
nano .env.production
# Secrets einfügen und speichern

# 4. Docker Images bauen
docker compose -f docker-compose.prod.yml build

# 5. Container starten
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# 6. Logs prüfen
docker compose -f docker-compose.prod.yml logs -f

# 7. Datenbank migrieren (falls nicht automatisch)
docker exec -it workout-tracker-backend-prod sh
cd apps/backend
npx prisma migrate deploy
exit
```

### 6.2 Nginx Config (falls kein Cloudflare Tunnel)
**`nginx/nginx.conf`**
```nginx
events {
    worker_connections 1024;
}

http {
    upstream frontend {
        server frontend:3000;
    }

    upstream backend {
        server backend:3001;
    }

    server {
        listen 80;
        server_name workout.nikobjelic.com;

        client_max_body_size 10M;

        # Frontend
        location / {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }

        # Backend API
        location /api/ {
            proxy_pass http://backend/;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

### 6.3 Health Checks
```bash
# Container Status
docker ps

# Logs ansehen
docker logs workout-tracker-backend-prod
docker logs workout-tracker-frontend-prod

# Datenbank testen
docker exec -it workout-tracker-db-prod psql -U workoutuser -d workout_tracker -c "\dt"

# HTTP Test
curl http://localhost:3001/health
curl http://localhost:3000
```

---

## 🔄 Phase 7: Updates & Maintenance

### 7.1 Update-Skript erstellen
**`~/apps/workout-tracker/update.sh`**
```bash
#!/bin/bash
set -e

echo "🔄 Updating Workout Tracker..."

# Pull latest code
git pull origin main

# Rebuild containers
docker compose -f docker-compose.prod.yml build

# Restart with zero-downtime (falls möglich)
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# Prune old images
docker image prune -f

echo "✅ Update complete!"
docker compose -f docker-compose.prod.yml ps
```

```bash
chmod +x update.sh
```

### 7.2 Backup-Skript erstellen
**`~/apps/workout-tracker/backup.sh`**
```bash
#!/bin/bash
BACKUP_DIR="$HOME/backups/workout-tracker"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

echo "🗄️ Backing up database..."
docker exec workout-tracker-db-prod pg_dump -U workoutuser workout_tracker | gzip > "$BACKUP_DIR/db_backup_$DATE.sql.gz"

echo "✅ Backup saved to $BACKUP_DIR/db_backup_$DATE.sql.gz"

# Alte Backups löschen (älter als 30 Tage)
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```

```bash
chmod +x backup.sh
```

### 7.3 Cronjob für automatische Backups
```bash
crontab -e

# Täglich um 3 Uhr morgens
0 3 * * * /home/pi/apps/workout-tracker/backup.sh >> /home/pi/logs/backup.log 2>&1
```

---

## 📊 Phase 8: Monitoring & Logging

### 8.1 Docker Logs anschauen
```bash
# Live Logs
docker compose -f docker-compose.prod.yml logs -f

# Nur Backend
docker logs -f workout-tracker-backend-prod

# Letzte 100 Zeilen
docker logs --tail 100 workout-tracker-backend-prod
```

### 8.2 Ressourcen-Monitoring
```bash
# Docker Stats
docker stats

# Speicherplatz
df -h

# RAM Usage
free -h
```

### 8.3 Automatischer Restart bei Reboot
Die `restart: always` Policy in docker-compose.prod.yml sorgt dafür, dass Container nach einem Neustart automatisch starten.

```bash
# Test
sudo reboot

# Nach Neustart prüfen
docker ps
```

---

## ✅ Phase 9: Checkliste vor Go-Live

### Pre-Deployment
- [ ] GitHub Repository erstellt und Code gepusht
- [ ] .env.production mit starken Secrets erstellt
- [ ] Dockerfiles getestet (lokal bauen)
- [ ] docker-compose.prod.yml konfiguriert
- [ ] Cloudflare Tunnel erstellt
- [ ] DNS CNAME Record gesetzt

### Deployment
- [ ] Code auf Pi geklont
- [ ] Docker Container gestartet
- [ ] Datenbank Migrationen ausgeführt
- [ ] Cloudflare Tunnel läuft
- [ ] Website unter workout.nikobjelic.com erreichbar

### Post-Deployment
- [ ] Login funktioniert
- [ ] Workout erstellen/starten funktioniert
- [ ] Daten werden korrekt gespeichert
- [ ] Backup-Skript getestet
- [ ] Update-Prozess getestet
- [ ] Monitoring eingerichtet

---

## 🚨 Troubleshooting

### Problem: Container startet nicht
```bash
# Logs prüfen
docker logs workout-tracker-backend-prod

# Container neu starten
docker compose -f docker-compose.prod.yml restart backend
```

### Problem: Datenbank Connection Error
```bash
# Prüfen ob DB läuft
docker ps | grep postgres

# DB Logs
docker logs workout-tracker-db-prod

# Connection String prüfen
docker exec workout-tracker-backend-prod env | grep DATABASE_URL
```

### Problem: Frontend zeigt 500 Error
```bash
# Backend erreichbar?
curl http://localhost:3001/health

# CORS Settings prüfen
docker logs workout-tracker-backend-prod | grep CORS
```

### Problem: Cloudflare Tunnel funktioniert nicht
```bash
# Tunnel Status
sudo systemctl status cloudflared

# Tunnel Logs
sudo journalctl -u cloudflared -f

# Tunnel neu starten
sudo systemctl restart cloudflared
```

### Problem: Zu wenig Speicher auf Pi
```bash
# Alte Docker Images/Container löschen
docker system prune -a

# Logs rotieren
sudo journalctl --vacuum-time=7d
```

---

## 📝 Nächste Schritte nach diesem Plan

1. **GitHub Repository erstellen** (`YOUR_USERNAME/workout-tracker`)
2. **Dockerfiles erstellen** (Backend + Frontend)
3. **docker-compose.prod.yml erstellen**
4. **.gitignore prüfen** (keine Secrets committen!)
5. **Code zu GitHub pushen**
6. **Pi vorbereiten** (Docker installieren, Ressourcen prüfen)
7. **Deployment durchführen** (Schritte aus Phase 6)
8. **Cloudflare Tunnel konfigurieren**
9. **Tests durchführen**
10. **Go Live! 🎉**

---

## 💡 Optimierungen für später

- **CI/CD Pipeline** mit GitHub Actions
- **Let's Encrypt SSL** (falls kein Cloudflare Tunnel)
- **Log Aggregation** (z.B. mit Loki)
- **Prometheus Monitoring**
- **Automatische Updates** mit Watchtower
- **Blue-Green Deployment** für Zero-Downtime

---

**Erstellt am:** 30. März 2026  
**Status:** Ready for Implementation  
**Geschätzte Deployment-Zeit:** 2-3 Stunden
