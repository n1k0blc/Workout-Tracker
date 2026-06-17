FROM node:20-alpine AS builder

WORKDIR /app

# Build argument for API URL
ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Copy package files
COPY package*.json ./
COPY apps/frontend/package*.json ./apps/frontend/

# Install dependencies (using flags to make it slightly more reliable on slow networks)
RUN npm ci --workspace=frontend --no-audit --no-fund --progress=false

# Copy source code
COPY apps/frontend ./apps/frontend

# Build the application
WORKDIR /app/apps/frontend
RUN npm run build

# Production Stage
# Uses Next.js standalone output (see next.config.ts) so we do NOT need
# to run npm ci here. This avoids long/slow network installs on the Pi
# and makes the final image much smaller and more reliable.
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
# NEXT_PUBLIC_* vars are inlined at build time, but we keep the arg for the image
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Copy the Next.js standalone build output.
# When building inside a workspace subfolder, the standalone folder contains
# the server at apps/frontend/server.js (with its own minimal node_modules).
COPY --from=builder /app/apps/frontend/.next/standalone ./

# Static files (these must be in the correct relative location for the server)
COPY --from=builder /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public

# next.config is rarely needed at runtime with standalone but included for safety
COPY apps/frontend/next.config.ts ./apps/frontend/next.config.ts

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

# Standalone produces a server.js. Because we built inside the frontend workspace,
# it ends up under the apps/frontend path after the copy above.
CMD ["node", "apps/frontend/server.js"]
