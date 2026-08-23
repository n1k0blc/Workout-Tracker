FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable

# Copy workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/

# Install all dependencies (including devDependencies for build)
RUN pnpm install --filter=backend --frozen-lockfile

# Copy prisma schema and generate client
COPY apps/backend/prisma ./apps/backend/prisma
RUN cd apps/backend && pnpm exec prisma generate

# Copy source code
COPY apps/backend ./apps/backend

# Build the application
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

# Copy built application and prisma from builder. The generated Prisma client
# is emitted to apps/backend/generated/prisma (see the `output` path in
# schema.prisma) rather than node_modules/.prisma, so this copy doesn't rely
# on hoisting the client to the workspace root.
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/generated ./apps/backend/generated
COPY --from=builder /app/apps/backend/prisma ./apps/backend/prisma

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3001

WORKDIR /app/apps/backend

CMD ["node", "dist/main.js"]
