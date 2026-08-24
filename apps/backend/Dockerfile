FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable

# Copy workspace manifests and source. Source must land before `pnpm install` runs --
# pnpm's node_modules uses symlinks (e.g. node_modules/@types/node), and BuildKit's COPY
# fails with "cannot copy to non-directory" when a later COPY has to merge a directory
# tree into a destination that already holds one of those symlinks.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend ./apps/backend

# Install all dependencies (including devDependencies for build). Cache mount keeps the
# pnpm store warm across builds now that the install layer is no longer cacheable
# independently of source changes.
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --filter=backend --frozen-lockfile

# Generate the Prisma client. prisma.config.ts (not the schema's datasource block) is where
# Prisma 7 reads the connection string and migrations path from; `prisma generate` only
# parses that value, it never connects, so a placeholder is enough to satisfy it during the
# image build.
RUN cd apps/backend && DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" pnpm exec prisma generate

# Build the application. The generated Prisma client (apps/backend/generated/prisma) is
# TypeScript source under Prisma 7's `prisma-client` generator, so it's compiled into
# dist alongside src rather than copied pre-built (see tsconfig.json's widened rootDir).
WORKDIR /app/apps/backend
RUN pnpm run build

# Production Stage
FROM node:22-alpine

# Needed for the healthcheck in docker-compose.prod.yml (wget http://localhost:3001/api/health)
RUN apk add --no-cache wget

WORKDIR /app

RUN corepack enable

# Copy workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/

# Install only production dependencies
RUN pnpm install --filter=backend --frozen-lockfile --prod

# Copy built application from builder. dist/generated/prisma holds the compiled Prisma
# client (Prisma 7's `prisma-client` generator emits TS source that tsc compiles alongside
# src — see tsconfig.json), so no separate copy of the raw generated/ directory is needed
# for the app to run. The prisma/ directory and prisma.config.ts are still needed at
# runtime: docker-compose.prod.yml's container command runs `npx prisma migrate deploy`
# before starting the app.
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=builder /app/apps/backend/prisma.config.ts ./apps/backend/

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3001

WORKDIR /app/apps/backend

CMD ["node", "dist/src/main.js"]
