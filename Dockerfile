# ==============================================================================
# PRODX ENTERPRISE POS - MULTI-STAGE PRODUCTION DOCKERFILE
# ==============================================================================

# Stage 1: Dependencies & Frontend Build
FROM node:22-alpine AS builder
WORKDIR /app

# Install native build dependencies if required
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Production Runtime Image
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Create non-root enterprise user for container security
RUN addgroup --system --gid 1001 prodx && \
    adduser --system --uid 1001 prodx

COPY --from=builder --chown=prodx:prodx /app/package.json ./
COPY --from=builder --chown=prodx:prodx /app/node_modules ./node_modules
COPY --from=builder --chown=prodx:prodx /app/dist ./dist
COPY --from=builder --chown=prodx:prodx /app/server.ts ./server.ts
COPY --from=builder --chown=prodx:prodx /app/tsconfig.json ./tsconfig.json

USER prodx

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/healthz || exit 1

CMD ["npx", "tsx", "server.ts"]
