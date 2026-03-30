FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/frontend/package*.json ./apps/frontend/

# Install dependencies
RUN npm ci --workspace=frontend

# Copy source code
COPY apps/frontend ./apps/frontend

# Build the application
WORKDIR /app/apps/frontend
RUN npm run build

# Production Stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/frontend/package*.json ./apps/frontend/

# Install only production dependencies
RUN npm ci --workspace=frontend --omit=dev

# Copy built application from builder
COPY --from=builder /app/apps/frontend/.next ./apps/frontend/.next
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public
COPY apps/frontend/next.config.ts ./apps/frontend/
COPY apps/frontend/package.json ./apps/frontend/

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

WORKDIR /app/apps/frontend

CMD ["npm", "start"]
