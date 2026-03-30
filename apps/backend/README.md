# Workout Tracker Backend

NestJS REST API für die Workout Tracker Anwendung.

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Start PostgreSQL Database

Stelle sicher, dass Docker installiert ist, und starte die Datenbank:

```bash
# Im Root-Verzeichnis
docker compose -f docker-compose.dev.yml up -d
```

Oder verwende eine lokal installierte PostgreSQL-Instanz und passe die `DATABASE_URL` in `.env` an.

### 3. Run Migrations

```bash
npm run prisma:generate
npm run prisma:migrate
```

### 4. Seed Database (Optional)

Nachdem du die Übungsliste in `prisma/seed.ts` hinzugefügt hast:

```bash
npm run prisma:seed
```

### 5. Start Development Server

```bash
npm run start:dev
```

Backend läuft auf: `http://localhost:3001/api`

## Environment Variables

Kopiere `.env.example` zu `.env` und passe die Werte an:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/workout_tracker?schema=public"
JWT_SECRET=your-secret-key
PORT=3001
```

## Available Scripts

- `npm run start:dev` - Start in development mode with hot reload
- `npm run build` - Build for production
- `npm run start:prod` - Start production build
- `npm run lint` - Lint code
- `npm run format` - Format code with Prettier
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio (Database GUI)
- `npm run prisma:seed` - Seed database with initial data

## Project Structure

```
src/
├── main.ts                 # Application entry point
├── app.module.ts           # Root module
├── prisma/                 # Prisma service (global)
├── auth/                   # Authentication module
├── users/                  # Users module
├── exercises/              # Exercises module
├── workout-cycles/         # Workout Cycles module
├── workouts/               # Workouts module
├── analytics/              # Analytics module
└── common/                 # Shared utilities
    ├── guards/             # Auth guards
    ├── decorators/         # Custom decorators
    └── filters/            # Exception filters
```

## API Documentation

Once the server is running, API endpoints are available at `/api`:

- **Auth**: `/api/auth/register`, `/api/auth/login`
- **Users**: `/api/users/me`
- **Exercises**: `/api/exercises`
- **Workout Cycles**: `/api/cycles`
- **Workouts**: `/api/workouts`
- **Analytics**: `/api/analytics`

## Database

Das Projekt verwendet PostgreSQL mit Prisma ORM.

### Prisma Commands

- `npx prisma studio` - Open database GUI
- `npx prisma migrate dev` - Create and apply migration
- `npx prisma migrate deploy` - Apply migrations (production)
- `npx prisma db push` - Push schema changes without migration
- `npx prisma db seed` - Run seed script

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## License

MIT
