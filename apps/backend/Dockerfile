FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/

# Install all dependencies (including devDependencies for build)
RUN npm ci --workspace=backend

# Copy prisma schema and generate client
COPY apps/backend/prisma ./apps/backend/prisma
RUN cd apps/backend && npx prisma generate

# Copy source code
COPY apps/backend ./apps/backend

# Build the application
WORKDIR /app/apps/backend
RUN npm run build

# Production Stage
FROM node:20-alpine

# Needed for the healthcheck in docker-compose.prod.yml (wget http://localhost:3001/api/health)
RUN apk add --no-cache wget

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/

# Install only production dependencies
RUN npm ci --workspace=backend --omit=dev

# Copy built application and prisma from builder. The generated Prisma client
# (.prisma) is hoisted to the workspace root by npm, not into apps/backend/node_modules --
# Node's module resolution walks up parent directories, so root-level ./node_modules/.prisma
# resolves correctly from a cwd of /app/apps/backend.
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/apps/backend/prisma ./apps/backend/prisma

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3001

WORKDIR /app/apps/backend

CMD ["node", "dist/main.js"]
