import { config } from 'dotenv';
import * as path from 'path';
import { defineConfig, env } from 'prisma/config';

// Mirrors the app's own env precedence (see app.module.ts's ConfigModule envFilePath).
config({ path: path.join(__dirname, '.env') });
config({ path: path.join(__dirname, '.env.local'), override: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
