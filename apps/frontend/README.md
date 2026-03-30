# Workout Tracker Frontend

Next.js-basiertes Frontend für den Workout Tracker.

## Technologie-Stack

- **Next.js 16.2.1** (App Router)
- **React** mit TypeScript
- **Tailwind CSS** für Styling
- **Fetch API** für Backend-Kommunikation

## Struktur

```
app/
  (auth)/          # Authentication Route Group
    login/         # Login-Seite
    register/      # Registrierungsseite
  dashboard/       # Dashboard (geschützt)
  workout/         # Workout-Modus (geschützt)
  cycles/          # Zyklen-Verwaltung (geschützt)
  exercises/       # Übungsbibliothek (geschützt)
  analytics/       # Analytics-Dashboard (geschützt)
components/        # React-Komponenten
  protected-route.tsx  # Wrapper für geschützte Routen
lib/
  api/             # API-Client
    client.ts      # Backend-API-Client mit JWT-Interceptor
  auth-context.tsx # Auth Context Provider
types/             # TypeScript-Typdefinitionen
```

## Features

### Authentifizierung
- JWT-basierte Authentifizierung
- Login/Registrierung
- Token-Management mit localStorage
- Automatische Weiterleitung bei 401-Fehler

### API-Client
- Zentrale API-Client-Klasse
- Automatischer JWT-Header-Injection
- Fehlerbehandlung
- TypeScript-Typen für alle Requests/Responses

### Geschützte Routen
- `ProtectedRoute`-Komponente für authentifizierte Bereiche
- Automatische Weiterleitung zu `/login` wenn nicht authentifiziert

## Entwicklung

```bash
# Dependencies installieren
npm install

# Development Server starten (Port 3000)
npm run dev

# Build für Produktion
npm run build

# Production Server starten
npm start
```

## Umgebungsvariablen

Erstelle eine `.env.local` Datei:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## Backend-Integration

Der API-Client kommuniziert mit dem NestJS-Backend auf Port 3001. Stelle sicher, dass das Backend läuft:

```bash
cd ../backend
npm run start:dev
```

## Nächste Schritte

**Phase 5: Workout Mode UI** (KRITISCH)
- Workout-Start-Screen
- Übungsauswahl-Interface
- Set-Logger mit Timer
- Workout-Completion-Screen

**Phase 6: Dashboard & Analytics UI**
- Volume-Charts
- 1RM-Tracking
- PR-Anzeige
- Muskelverteilung

**Phase 7: Cycle Setup Flow**
- Cycle-Erstellung
- Blueprint-Editor
- Workout-Day-Verwaltung
