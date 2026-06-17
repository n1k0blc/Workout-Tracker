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

# Remove devDependencies so the production image only contains runtime deps.
# This makes the final image smaller while still avoiding a network npm ci
# in the production stage (we just copy the pruned result).
RUN npm prune --omit=dev --workspace=backend

# Production Stage
FROM node:20-alpine

# Needed for the healthcheck in docker-compose.prod.yml (wget http://localhost:3001/api/health)
RUN apk add --no-cache wget

WORKDIR /app

# We copy the (pruned) node_modules from the builder stage instead of
# running another npm ci. This avoids slow network installs on the Pi
# and makes builds more reliable.
# The builder already performed the full install + prisma generate + build.

# Copy built application and prisma + node_modules from builder
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=builder /app/apps/backend/prisma ./apps/backend/prisma

# We still copy the package manifests (some tools / health scripts may read them)
COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3001

WORKDIR /app/apps/backend

CMD ["node", "dist/main.js"]
