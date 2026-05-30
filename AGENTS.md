# AGENTS.md – Workout Tracker

## Projekt-Philosophie
Dies ist eine **persönliche, mobile-first PWA** für echtes, flexibles Krafttraining.  
**Kernprinzip**: Flexibilität über Rigidität.  
Geplante Workouts sind **Vorschläge**, keine Zwänge. Der User kann skippen, umsortieren, Exercises austauschen oder komplett freie Sessions machen – das System muss trotzdem exakte Progress-Tracking (Volume, 1RM, PRs, Muscle Distribution, Rest Times) ermöglichen.

Historische Daten sind **immutable**. Änderungen am Blueprint wirken **nur forward** auf zukünftige Workouts.

## Tech Stack & Versions (aktuell)
- **Frontend**: Next.js 16 (App Router), TypeScript (strict), Tailwind CSS, PWA
- **Backend**: NestJS (TypeScript), REST API
- **Database**: PostgreSQL 16 + Prisma ORM
- **Monorepo**: Yarn/PNPM Workspaces mit `apps/backend/` und `apps/frontend/`
- **Deployment**: Docker (ARM64 auf Raspberry Pi), Cloudflare Tunnel
- **Auth**: JWT (email/password)
- **Testing**: Vitest + React Testing Library (Frontend), Jest/NestJS Testing (Backend)

## Monorepo-Struktur (wichtig!)
- `apps/backend/` → NestJS mit Domain-Modulen (auth, users, workout-cycles, workouts, exercises, workout-templates, analytics, orm, health…)
- `apps/frontend/` → Next.js mit Route-Groups (auth, cycles, workout, history, analytics, templates, profile)
- Shared Configs und Scripts im Root

## Architecture & Design-Prinzipien
- **Clean Architecture / Feature-Sliced Design** im Backend
- **Domain-Driven Design**: WorkoutEngineService, AnalyticsService, ORMService als zentrale Services
- Blueprint = Source of Truth für geplante Workouts
- Workout = tatsächliche ausgeführte Session (kann von Blueprint abweichen)
- Alle historischen Logs (ExerciseLog, SetLog) sind unveränderlich
- Muscle-Group-Distribution: Jede Exercise hat %-Aufteilung (sum = 100 %)
- Epley-Formel für 1RM-Schätzung und Benchmarking

## Coding Standards
- **TypeScript strict mode** überall
- ESLint + Prettier (keine Warnings erlaubt)
- Keine `any`, keine `// @ts-ignore`
- Descriptive Naming (z. B. `workoutBlueprintExercise` statt `exercise`)
- Feature-Sliced Ordnerstruktur bevorzugt
- Fehlerbehandlung mit NestJS Exceptions + Zod Validation
- Prisma: Keine Raw-SQL außer bei sehr komplexen Analytics-Queries
- Kommentare nur wo wirklich nötig (Code soll selbsterklärend sein)

## Agent-Rollen & Verhalten

### 1. Feature-Implementer (Default-Rolle)
- Immer **Plan-First**: Erstelle detaillierten Plan bevor Code geschrieben wird
- Implementiere Backend **+** Frontend **+** Tests in einem Zug
- Berücksichtige PWA-Offline-Fähigkeit und mobile UX
- Achte auf flexible Workout-Execution (Add/Remove/Reorder/Replace mid-workout)

### 2. Code Reviewer
- Prüft auf: Domain-Konsistenz, Immutable-History, Flexibilitäts-Regeln, Performance
- Schlägt Verbesserungen vor (kein Auto-Apply)

### 3. Tester
- Schreibt immer **unit + integration tests** (Vitest)
- Testet Edge-Cases: Free Workout, Blueprint-Änderungen, Partial Logs, Offline-Modus

### 4. Refactoring / Analytics Expert
- Besonders vorsichtig bei AnalyticsService, ORMService und Benchmark-Berechnungen

## Wichtige Workflows

**Neues Feature / Bugfix:**
1. Plan (mit User bestätigen)
2. Backend-Änderung (Module + Service + DTO + Prisma wenn nötig)
3. Frontend-Änderung
4. Tests (mind. 1 Test pro neuen Flow)
5. Update von DEPLOYMENT-PLAN.md oder IMPLEMENTATION-PLAN.md falls relevant

**Database-Änderung:**
- Immer Prisma Migration + Seed-Update bei neuen Default-Exercises
- Keine Breaking Changes bei existierenden Tabellen ohne Migration-Plan

**Deployment:**
- Immer ARM64 Docker berücksichtigen
- Secrets nur über .env + Docker Secrets
- Cloudflare Tunnel + Raspberry Pi spezifische Hinweise

## Sonstiges
- Dokumentation: Alle neuen Features in den bestehenden .md-Dateien (Business Requirements, Architecture Overview etc.) mitpflegen
- Performance: Analytics-Queries dürfen nicht bei jedem Workout-Log langsam werden
- Accessibility & Mobile-First immer priorisieren

**Du bist jetzt der ultimative Workout-Tracker-Experte.**  
Nutze diese Regeln bei jedem Prompt.