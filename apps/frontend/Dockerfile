FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable

# Build argument for API URL
ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Copy workspace manifests and source. Source must land before `pnpm install` runs --
# pnpm's node_modules uses symlinks (e.g. node_modules/@types/node), and BuildKit's COPY
# fails with "cannot copy to non-directory" when a later COPY has to merge a directory
# tree into a destination that already holds one of those symlinks.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/frontend ./apps/frontend

# Install dependencies. Cache mount keeps the pnpm store warm across builds now that the
# install layer is no longer cacheable independently of source changes.
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --filter=frontend --frozen-lockfile

# Build the application
WORKDIR /app/apps/frontend
RUN pnpm run build

# Production Stage
FROM node:22-alpine

WORKDIR /app

RUN corepack enable

# Copy workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/frontend/package.json ./apps/frontend/

# Install only production dependencies
RUN pnpm install --filter=frontend --frozen-lockfile --prod

# Copy built application from builder
COPY --from=builder /app/apps/frontend/.next ./apps/frontend/.next
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public
COPY apps/frontend/next.config.ts ./apps/frontend/

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

WORKDIR /app/apps/frontend

CMD ["node_modules/.bin/next", "start"]
