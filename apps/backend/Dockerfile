FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/

# Install all dependencies (including devDependencies for build)
# Flags help on slow/ARM networks during Pi deploys
RUN npm ci --workspace=backend --no-audit --no-fund --progress=false

# Copy prisma schema and generate client
COPY apps/backend/prisma ./apps/backend/prisma
RUN cd apps/backend && npx prisma generate

# Copy source code
COPY apps/backend ./apps/backend

# Build the application
WORKDIR /app/apps/backend
RUN npm run build

# Go back to root for pruning
WORKDIR /app

# Backup the complete 'prisma' package (including build/ for the CLI) to a safe location
# before pruning. Prune + workspace hoisting often leaves the CLI incomplete.
RUN mkdir -p /prisma-backup && \
    cp -r /app/node_modules/prisma /prisma-backup/ 2>/dev/null || true

# Prune dev dependencies (keeps most of the app slim)
RUN npm prune --omit=dev --workspace=backend

# The pruned node_modules will be copied below.
# We will overlay the full prisma package in the prod stage.

# Production Stage
FROM node:20-alpine

# Needed for the healthcheck in docker-compose.prod.yml (wget http://localhost:3001/api/health)
RUN apk add --no-cache wget

WORKDIR /app

# Ensure tools like prisma (from root node_modules) are in PATH
ENV PATH="/app/node_modules/.bin:${PATH}"

# We copy the (pruned) node_modules from the builder stage (hoisted at root).
COPY --from=builder /app/node_modules ./node_modules

# Overlay the complete prisma package (with build/ CLI) from the pre-prune backup.
# This ensures /app/node_modules/prisma/build/index.js exists for the wrapper.
COPY --from=builder /prisma-backup/prisma /app/node_modules/prisma

# Copy built application, prisma schema
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/prisma ./apps/backend/prisma

# Package manifests for reference
COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/

# Create a reliable wrapper for prisma CLI (bypasses .bin symlink issues after prune + COPY in workspaces)
RUN mkdir -p /app/node_modules/.bin && \
    printf '#!/bin/sh\nnode /app/node_modules/prisma/build/index.js "$@"\n' > /app/node_modules/.bin/prisma && \
    chmod +x /app/node_modules/.bin/prisma

# Create non-root user and fix ownership (important for copied files)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3001

WORKDIR /app/apps/backend

CMD ["node", "dist/main.js"]
