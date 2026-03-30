# Workout Tracker - Implementierungsplan

**Erstellt am:** 26. März 2026  
**Projekt:** Personal Workout Tracking Application  
**Zielplattform:** Raspberry Pi (ARM-kompatibel)

---

## Überblick

Dieses Dokument definiert den schrittweisen Implementierungsplan für eine mobile-first Workout-Tracking-Anwendung mit flexiblen Trainingszyklen, Offline-Unterstützung und umfangreichen Analytics.

### Kernprinzipien
- ✅ Flexibilität statt Rigidität
- ✅ Mobile-first Design
- ✅ Blueprint vs. Workout Separation
- ✅ Offline-fähig (PWA)
- ✅ ARM-kompatibel (Raspberry Pi)

---

## Tech Stack

### Frontend
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- PWA Support

### Backend
- NestJS
- TypeScript
- REST API
- JWT Authentication

### Database & ORM
- PostgreSQL
- Prisma

### Deployment
- Docker & Docker Compose
- Cloudflare Tunnel
- GitHub Actions CI/CD

---

## Projektstruktur

```
/workout-tracker
├── README.md
├── docker-compose.yml
├── docker-compose.staging.yml
├── .github/
│   └── workflows/
│       ├── deploy-production.yml
│       └── deploy-staging.yml
├── apps/
│   ├── backend/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── nest-cli.json
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── seed.ts
│   │   │   └── migrations/
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       ├── auth/
│   │       ├── users/
│   │       ├── exercises/
│   │       ├── workout-cycles/
│   │       ├── workouts/
│   │       ├── analytics/
│   │       └── common/
│   │           ├── guards/
│   │           ├── decorators/
│   │           └── filters/
│   └── frontend/
│       ├── Dockerfile
│       ├── package.json
│       ├── tsconfig.json
│       ├── next.config.js
│       ├── tailwind.config.js
│       ├── public/
│       │   ├── manifest.json
│       │   └── icons/
│       └── src/
│           ├── app/
│           │   ├── layout.tsx
│           │   ├── page.tsx
│           │   ├── (auth)/
│           │   │   ├── login/
│           │   │   └── register/
│           │   ├── dashboard/
│           │   ├── workout/
│           │   ├── cycles/
│           │   ├── exercises/
│           │   └── analytics/
│           ├── components/
│           ├── lib/
│           ├── hooks/
│           └── types/
└── packages/
    └── shared-types/ (optional)
```

---

## Implementierungsphasen

---

### **PHASE 1: Backend Foundation** (Priorität: KRITISCH)

#### 1.1 Projekt-Setup
- [x] Monorepo-Struktur erstellen
- [x] NestJS-App initialisieren (`apps/backend`)
- [x] TypeScript, ESLint, Prettier konfigurieren
- [x] `.env` und Umgebungsvariablen einrichten
- [x] `.gitignore` anpassen

**Deliverables:**
- Lauffähiges NestJS-Projekt
- Konfigurierte Development-Umgebung

---

#### 1.2 Prisma & Database Setup
- [x] Prisma installieren und initialisieren
- [x] Schema aus `DATABASE Schema.txt` implementieren
- [x] PostgreSQL Docker-Container aufsetzen
- [ ] Erste Migration erstellen
- [x] Seed-Script für globale Exercises erstellen (Template - User fügt Daten hinzu)

**Seed-Daten:**
- Mindestens 30-50 vordefinierte Übungen
- Alle Muskelgruppen abdecken
- Alle Equipment-Typen abdecken

**Deliverables:**
- Vollständiges Prisma-Schema
- Funktionierende Datenbankverbindung (Docker Compose bereit)
- Seed-Daten für Exercise-Library (Template erstellt)

---

#### 1.3 Auth Module
- [x] Auth-Module erstellen (`src/auth/`)
- [x] JWT-Strategy implementieren
- [x] Auth-Controller erstellen:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
- [x] DTOs erstellen (RegisterDto, LoginDto)
- [x] Password-Hashing (bcrypt)
- [x] JWT-Guard implementieren
- [x] Auth-Decorator für User-Extraktion

**Deliverables:**
- Funktionierende Registrierung
- Funktionierende Login-Funktionalität
- JWT-basierte Authentifizierung

---

#### 1.4 Users Module
- [x] Users-Module erstellen (`src/users/`)
- [x] Users-Service mit Prisma
- [x] Users-Controller:
  - `GET /api/users/me`
  - `PATCH /api/users/me`
- [x] DTOs (UpdateUserDto)

**Deliverables:**
- User-Profil abrufbar
- User-Profil aktualisierbar

---

### **PHASE 2: Core Backend Modules** (Priorität: HOCH)

#### 2.1 Exercises Module
- [x] Exercises-Module erstellen (`src/exercises/`)
- [x] Exercises-Service
- [x] Exercises-Controller:
  - `GET /api/exercises` (mit Filter: muscleGroup, equipment, search)
  - `POST /api/exercises` (Custom-Übung erstellen)
  - `GET /api/exercises/:id`
  - `DELETE /api/exercises/:id`
- [x] DTOs (CreateExerciseDto, FilterExerciseDto)
- [x] Filterlogik: Global + User-spezifisch

**Deliverables:**
- Exercise-Library durchsuchbar
- Custom Exercises erstellbar
- Filter nach Muskelgruppe/Equipment

---

#### 2.2 Workout Cycles Module
- [x] Workout-Cycles-Module (`src/workout-cycles/`)
- [x] Service-Layer mit kompletter CRUD-Logik
- [x] Controller:
  - `GET /api/cycles`
  - `POST /api/cycles`
  - `GET /api/cycles/:id`
  - `PATCH /api/cycles/:id`
  - `DELETE /api/cycles/:id`
  - `PATCH /api/cycles/:cycleId/workout-days/:workoutDayId/blueprint`
- [x] DTOs (CreateCycleDto, UpdateCycleDto, UpdateBlueprintDto)
- [x] Nested Entities: WorkoutDay + WorkoutBlueprint
- [x] Blueprint-Exercise-Relations

**Besondere Anforderungen:**
- Cycle-Setup-Flow unterstützen
- WorkoutDays für ausgewählte Weekdays erstellen
- Blueprints pro WorkoutDay verwalten

**Deliverables:**
- Cycles erstellbar mit vollständiger Struktur
- Blueprints bearbeitbar
- Nested Relations funktionieren

---

#### 2.3 Workouts Module
- [x] Workouts-Module (`src/workouts/`)
- [x] Service-Layer
- [x] Controller:
  - `GET /api/workouts` (Historie)
  - `POST /api/workouts/start`
  - `GET /api/workouts/:id`
  - `POST /api/workouts/:id/exercises` (Add exercise)
  - `DELETE /api/workouts/:id/exercises/:exerciseLogId` (Remove exercise)
  - `POST /api/workouts/:id/exercises/:exerciseLogId/sets` (Log set)
  - `DELETE /api/workouts/:id/sets/:setLogId` (Delete set)
  - `POST /api/workouts/:id/complete`
  - `POST /api/workouts/:id/discard`
- [x] DTOs (StartWorkoutDto, LogSetDto, CompleteWorkoutDto, etc.)
- [x] ExerciseLog & SetLog Relations

**Besondere Anforderungen:**
- Workout Status: IN_PROGRESS, COMPLETED, DISCARDED
- Free Workouts unterstützen (isFreeWorkout=true)
- Blueprint-Updates nach Workout-Completion (TODO)

**Deliverables:**
- Workout starten
- Übungen und Sets loggen
- Workout abschließen oder verwerfen
- Blueprint-Update-Logik (basis implementiert)

---

#### 2.4 Workout Engine (Business Logic)
- [x] Service für "Suggested Workout" implementieren
- [x] Logik: Welches Workout wird heute vorgeschlagen?
  - Aktueller Cycle
  - Heute = Weekday
  - Zugehöriger WorkoutDay
  - Blueprint laden
  - Werte aus letztem Workout prefill
- [x] Free Workout vs. Cycle Workout unterscheiden
- [x] Optionale Cycle/Day-Verknüpfung bei Workouts

**Deliverables:**
- GET `/api/workouts/suggested` Endpoint
- Frontend erhält Workout-Vorschlag basierend auf Cycle

---

### **PHASE 3: Analytics Module** (Priorität: MITTEL)

#### 3.1 Analytics Service
- [x] Analytics-Module (`src/analytics/`)
- [x] Service-Layer für Berechnungen:
  - **Volume:** sets × reps × weight
  - **1RM (Epley):** weight × (1 + reps / 30)
  - **PR Detection:** Max weight/reps pro Exercise
- [x] Aggregationen:
  - Pro Workout
  - Pro Woche
  - Pro Muskelgruppe

#### 3.2 Analytics Endpoints
- [x] Controller:
  - `GET /api/analytics/volume?period=week&startDate=&endDate=`
  - `GET /api/analytics/1rm/:exerciseId`
  - `GET /api/analytics/prs`
  - `GET /api/analytics/muscle-distribution?period=week`
  - `GET /api/analytics/time-tracking?period=week`

**Optimierung:**
- Queries optimiert für Performance
- Berechnungen in Service-Layer
- Caching-ready (für zukünftige Erweiterung)

**Deliverables:**
- Volume-Berechnungen (total, per workout, by muscle group)
- 1RM-Tracking mit Historie
- PR-Detektion (Weight, Reps, Volume, 1RM)
- Muscle-Group-Distribution mit Percentages
- Time-Tracking (total, average, per workout)

---

### **PHASE 4: Frontend Foundation** (Priorität: HOCH) ✅

#### 4.1 Next.js Setup ✅
- [x] Next.js-App initialisieren (`apps/frontend`)
- [x] Tailwind CSS konfigurieren
- [x] TypeScript einrichten
- [x] App Router-Struktur aufbauen
- [x] Shared Layout erstellen
- [ ] Theme-Provider (Light/Dark Mode)

#### 4.2 Authentication Pages ✅
- [x] `/login` Page
- [x] `/register` Page
- [x] API-Client für Auth-Requests
- [x] JWT-Token in LocalStorage/Cookie speichern
- [x] Protected Route Middleware
- [x] Auth Context/Provider

**Deliverables:**
- ✅ Login-Formular funktioniert
- ✅ Registrierung funktioniert
- ✅ Geschützte Routes

---

#### 4.3 API Client & State Management ✅
- [x] Fetch/Axios-Wrapper mit JWT-Interceptor
- [x] React Context oder Zustand für globalen State
- [x] User-State verwalten
- [x] Error-Handling (Toast/Notifications)

---

### **PHASE 5: Workout Mode UI** (Priorität: KRITISCH) ✅

#### 5.1 Workout Mode Foundation ✅
- [x] `/workout` Route erstellen
- [x] Workout-Start-Screen:
  - Suggested Workout anzeigen
  - Alternative Workouts aus Cycle
  - Free Workout-Option
- [x] Workout-Kontext (Timer, Exercises, Sets)

#### 5.2 Exercise List & Set Logging ✅
- [x] Exercise-Cards-Komponente
- [x] Set-Logger-Komponente:
  - Reps-Input
  - Weight-Input
  - RIR-Input
- [x] Set hinzufügen/entfernen
- [ ] Exercise-Reihenfolge anpassbar (Drag & Drop, optional)

#### 5.3 Timer System ✅
- [x] Workout-Timer (Total Duration)
- [x] Set-Rest-Timer
- [x] Exercise-Rest-Timer
- [x] Timer survives Re-Renders (useRef oder Context)
- [x] Timer-Controls (Start, Pause, Reset)

#### 5.4 Dynamic Exercise Modification ✅
- [x] Exercise hinzufügen (Modal mit Exercise-Search)
- [x] Exercise ersetzen
- [x] Exercise löschen
- [x] Bestätigungsdialoge

#### 5.5 Workout Completion Flow ✅
- [x] "Workout beenden"-Button
- [x] Modal: "Speichern oder Verwerfen?"
- [x] Modal: "Blueprint aktualisieren?" (wenn nicht Free Workout)
- [x] API-Calls für Complete/Discard
- [x] Weiterleitung zum Dashboard

**Deliverables:**
- ✅ Vollständiger Workout Mode
- ✅ Set-Logging funktioniert
- ✅ Timer funktionieren
- ✅ Dynamische Anpassungen möglich
- ✅ Blueprint-Update-Flow

---

### **PHASE 6: Dashboard & Analytics UI** (Priorität: MITTEL) ✅

#### 6.1 Dashboard Overview ✅
- [x] Dashboard-Route (`/dashboard`)
- [x] Cycle-Overview-Komponente:
  - Aktueller Cycle
  - Woche X von Y
  - Verbleibende Wochen
- [x] Quick Stats:
  - Gesamte Workouts
  - Gesamtes Volumen
  - Durchschnittliche Workout-Dauer
- [x] Recent Workouts Liste
- [x] Personal Records Preview

#### 6.2 Calendar View
- [ ] Kalender-Komponente (aktuelle Woche)
- [ ] Workout-Tage highlighten
- [ ] Rest-Tage anzeigen
- [ ] Vergangene Workouts anklickbar (zu Workout-Details)

#### 6.3 Analytics Charts ✅
- [x] Volume-Progression-Diagramm (Line Chart)
- [x] Muscle-Distribution (Pie Chart)
- [x] Date Range Filter (7d/30d/90d)
- [x] PR-Liste mit Details
- [x] Analytics Page (`/analytics`)

#### 6.4 Exercise Library ✅
- [x] Exercise-Liste mit Filtern
- [x] Search-Funktion
- [x] Muscle Group Filter
- [x] Equipment Filter
- [x] Custom Exercise Anzeige

#### 6.5 Cycles Overview ✅
- [x] Cycles-Liste (`/cycles`)
- [x] Active Cycle Indicator
- [x] Workout Days Anzeige
- [x] Placeholder für Cycle Creation (Phase 7)

**Chart-Library:**
- ✅ Recharts

**Deliverables:**
- ✅ Dashboard mit Quick Stats und Recent Workouts
- ✅ Analytics mit Volume & Muscle Distribution Charts
- ✅ Exercise Library mit Filtern
- ✅ Cycles Overview
- ⏭️ Calendar-View (optional, später)

---

### **PHASE 7: Cycle Setup Flow** (Priorität: HOCH)

#### 7.1 Cycle Creation Wizard
- [ ] Multi-Step-Form:
  1. Cycle-Name & Dauer
  2. Workout-Tage auswählen (Weekdays)
  3. Start-Tag auswählen
  4. Workouts definieren (pro Tag)
  5. Übungen hinzufügen (pro Workout)
  6. Sets/Reps/Weight/RIR/Rest definieren
- [ ] Validierung
- [ ] Submit zu `/api/cycles`

#### 7.2 Cycle Management
- [ ] Cycle-Liste anzeigen (`/cycles`)
- [ ] Cycle bearbeiten
- [ ] Cycle löschen
- [ ] Cycle kopieren

**Deliverables:**
- Vollständiger Cycle-Setup-Flow
- Cycle-Verwaltung

---

### **PHASE 8: Exercise Library UI** (Priorität: NIEDRIG)

#### 8.1 Exercise Browser
- [ ] `/exercises` Route
- [ ] Exercise-Liste mit Filter:
  - Search
  - Muscle Group
  - Equipment
- [ ] Custom Exercise erstellen

**Deliverables:**
- Exercise-Library durchsuchbar
- Custom Exercises erstellbar

---

### **PHASE 9: PWA Support** (Priorität: MITTEL)

#### 9.1 Service Worker
- [ ] Service Worker registrieren
- [ ] Assets cachen (Static Files, API-Responses)
- [ ] Offline-Fallback-Page

#### 9.2 Offline Workout Logging
- [ ] Local Storage für aktives Workout
- [ ] Sync-Logik beim Wiederherstellen der Verbindung
- [ ] IndexedDB für größere Datenmengen (optional)

#### 9.3 Manifest & Icons
- [ ] `manifest.json` erstellen
- [ ] Icons generieren (verschiedene Größen)
- [ ] Install-Prompt

**Deliverables:**
- App installierbar als PWA
- Offline-Unterstützung (Basic)

---

### **PHASE 10: Docker & Deployment** (Priorität: HOCH)

#### 10.1 Dockerfiles
- [ ] Backend Dockerfile (ARM-kompatibel)
- [ ] Frontend Dockerfile (ARM-kompatibel)
- [ ] Multi-Stage-Builds für kleinere Images

#### 10.2 Docker Compose
- [ ] `docker-compose.yml` (Production)
- [ ] `docker-compose.staging.yml` (Staging)
- [ ] Services:
  - frontend
  - backend
  - database (PostgreSQL)
- [ ] Environment-Files (`.env.production`, `.env.staging`)
- [ ] Volumes für Datenbank-Persistenz

#### 10.3 CI/CD Pipeline
- [ ] GitHub Actions Workflow:
  - `deploy-production.yml` (main branch)
  - `deploy-staging.yml` (develop branch)
- [ ] Schritte:
  1. Checkout Code
  2. Build Docker Images
  3. SSH zu Raspberry Pi
  4. Pull Images
  5. Restart Containers
  6. Run Migrations

#### 10.4 Cloudflare Tunnel
- [ ] Tunnel konfigurieren: `workout.nikobjelic.com` → Port 3000
- [ ] Tunnel konfigurieren: `staging.workout.nikobjelic.com` → Port 3001

**Deliverables:**
- Dockerized Application
- CI/CD Pipeline funktioniert
- Deployment auf Raspberry Pi

---

## Prioritäten-Matrix

### MUST-HAVE (MVP)
1. Auth Module
2. Users Module
3. Exercises Module (mit Seed-Daten)
4. Workout Cycles Module
5. Workouts Module
6. Workout Mode UI (vollständig)
7. Dashboard (Basic)
8. Docker Setup
9. Deployment

### SHOULD-HAVE (Launch)
1. Analytics Module (vollständig)
2. Analytics UI (Charts)
3. Cycle Setup Wizard
4. Calendar View

### NICE-TO-HAVE (Post-Launch)
1. PWA Offline-Support
2. Exercise Library UI (erweitert)
3. Dark Mode
4. Drag & Drop für Exercise-Reihenfolge
5. Redis Caching
6. Background Workers

---

## Testing-Strategie

### Backend
- Unit Tests für Services (Jest)
- Integration Tests für API-Endpoints (Supertest)
- E2E Tests (optional)

### Frontend
- Component Tests (React Testing Library)
- E2E Tests (Playwright, optional)

---

## Performance-Überlegungen

### Backend
- Prisma-Queries optimieren
- Indexes auf häufig abgefragten Feldern
- Eager Loading vs. Lazy Loading
- Analytics-Precomputation (später)

### Frontend
- Code Splitting (Next.js Auto)
- Image Optimization
- Lazy Loading für Komponenten
- Memoization (React.memo, useMemo)

### Database
- Indexes:
  - `User.email`
  - `Exercise.muscleGroup`
  - `Exercise.equipment`
  - `Workout.userId, Workout.date`
  - `SetLog.exerciseLogId`

---

## Sicherheitsanforderungen

- [ ] Password-Hashing (bcrypt, Saltrounds: 10)
- [ ] JWT mit Secret Key (ausreichend lang)
- [ ] HTTPS über Cloudflare Tunnel
- [ ] Input-Validierung (class-validator)
- [ ] SQL-Injection-Schutz (Prisma)
- [ ] Rate Limiting (später)
- [ ] CORS-Konfiguration

---

## Datenbank-Migrations-Strategie

- Entwicklung: `prisma migrate dev`
- Produktion: `prisma migrate deploy` (im CI/CD)
- Seed-Daten: `prisma db seed`

---

## Monitoring & Logging (Post-Launch)

- [ ] Logging-Framework (Winston oder Pino)
- [ ] Error-Tracking (Sentry, optional)
- [ ] Performance-Monitoring
- [ ] Database-Monitoring

---

## Zeitplan (Geschätzt)

| Phase                  | Aufwand    |
|------------------------|------------|
| Phase 1: Backend       | 1-2 Wochen |
| Phase 2: Core Modules  | 2-3 Wochen |
| Phase 3: Analytics     | 1 Woche    |
| Phase 4: Frontend      | 1 Woche    |
| Phase 5: Workout Mode  | 2-3 Wochen |
| Phase 6: Dashboard     | 1-2 Wochen |
| Phase 7: Cycle Setup   | 1 Woche    |
| Phase 8: Exercise UI   | 3-5 Tage   |
| Phase 9: PWA           | 1 Woche    |
| Phase 10: Deployment   | 3-5 Tage   |
| **Total**              | **10-14 Wochen** |

---

## Nächste Schritte

1. ✅ Dokumentation gelesen
2. ✅ Implementierungsplan erstellt
3. ⏭️ **Phase 1.1 starten: Backend-Projekt-Setup**

---

## Offene Fragen

1. Soll Redis von Anfang an integriert werden?
   - **Empfehlung:** Erst später, nicht für MVP
   
2. Soll die App mehrsprachig sein?
   - **Business Requirements:** Nur Englisch
   
3. Soll es eine Admin-Oberfläche geben?
   - **Aktuell:** Nicht erforderlich (Single-User-App)

4. Sollen Social Features (Teilen, Freunde) implementiert werden?
   - **Aktuell:** Nein, rein persönliche App

---

*Ende des Implementierungsplans*
