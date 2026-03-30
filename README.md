# Workout Tracker

Personal Workout Tracking Application - Mobile-first PWA für flexibles Workout-Tracking mit Zyklen, Analytics und Offline-Support.

## ⚠️ Deployment auf Raspberry Pi mit existierenden Apps

**Wenn dein Pi bereits andere Apps hostet:**

1. **STOP!** Lies zuerst: **[PRE-DEPLOYMENT-CHECKLIST.md](PRE-DEPLOYMENT-CHECKLIST.md)**
2. Führe `pi-inspect.sh` aus um Ressourcen und Ports zu prüfen
3. Teile die Ergebnisse, damit die Konfiguration angepasst werden kann
4. Der Deployment-Plan wird dann auf deine Situation zugeschnitten

**Warum?**
- Vermeidung von Port-Konflikten
- Sichere Integration mit bestehendem Cloudflare Tunnel
- Keine Unterbrechung laufender Services

---

## 🚀 Live Demo

**URL:** [workout.nikobjelic.com](https://workout.nikobjelic.com)  
**Status:** In Development → Ready for Production

## 📦 Tech Stack

- **Frontend:** Next.js 16, TypeScript, Tailwind CSS, PWA
- **Backend:** NestJS, TypeScript, REST API
- **Database:** PostgreSQL 16
- **ORM:** Prisma
- **Deployment:** Docker, Raspberry Pi (ARM64), Cloudflare Tunnel
- **Domain:** IONOS + Cloudflare

## 🏗️ Project Structure

```
/workout-tracker
├── apps/
│   ├── backend/           # NestJS REST API
│   │   ├── src/
│   │   ├── prisma/
│   │   ├── Dockerfile
│   │   └── package.json
│  🛠️ Development

### Prerequisites

- Node.js 20+
- PostgreSQL 16
- Docker (optional, recommended)

### Quick Start with Docker (Recommended)

```bash
# Start PostgreSQL
docker compose -f docker-compose.dev.yml up -d

# Backend
cd apps/backend
cp .env.example .env
npm install
npx prisma migrate dev
npm run start:dev

# Frontend (in new terminal)
cd apps/frontend
npm install
npm run dev
```

### Manual Setup

#### Backend

```bash
cd apps/backend
npm install
npm run start:dev  # Runs on http://localhost:3001
```
📚 Documentation

- [Deployment Plan](DEPLOYMENT-PLAN.md) - Complete production deployment guide
- [Implementation Plan](IMPLEMENTATION-PLAN.md)
- [Business Requirements](Business%20Requirements.txt)
- [Technical Requirements](Technical%20Requirements.txt)
- [Architecture Overview](Architecture%20Overview.txt)
- [Database Schema](DATABASE%20Schema.txt)

## 🏷️ Version

**Current Version:** 1.0.0  
**Last Updated:** März 2026

## 📝
## 🚀 Production Deployment

### Prerequisites on Raspberry Pi

- Docker & Docker Compose
- Cloudflare account
- Git

### Initial Deployment

```bash
# 1. Clone repository on Pi
git clone https://github.com/YOUR_USERNAME/workout-tracker.git
cd workout-tracker

# 2. Create production environment file
cp .env.production.example .env.production
nano .env.production  # Fill in your secrets

# 3. Deploy
chmod +x deploy.sh
./deploy.sh
```

### Updates

```bash
./deploy.sh  # Pulls latest code and rebuilds containers
```

### Backup

```bash
# Manual backup
chmod +x backup.sh
./backup.sh

# Automated backups (cron)
crontab -e
# Add: 0 3 * * * /home/pi/apps/workout-tracker/backup.sh
```

For detailed deployment instructions, see [DEPLOYMENT-PLAN.md](DEPLOYMENT-PLAN.md).bash
cd apps/backend
npm install
npm run start:dev
```

### Frontend

```bash
cd apps/frontend
npm install
npm run dev
```

## Documentation

- [Implementation Plan](IMPLEMENTATION-PLAN.md)
- [Business Requirements](Business%20Requirements.txt)
- [Technical Requirements](Technical%20Requirements.txt)
- [Architecture Overview](Architecture%20Overview.txt)
- [Database Schema](DATABASE%20Schema.txt)

## License

MIT
