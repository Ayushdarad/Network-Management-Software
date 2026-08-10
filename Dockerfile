# ── Stage 1: Build frontend ──────────────────────────────────────────────────
FROM node:22-alpine AS frontend
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY index.html vite.config.ts tsconfig*.json ./
COPY src ./src
COPY public ./public
RUN npm run build

# ── Stage 2: Build & run backend ─────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app/backend

# ICMP ping requires iputils-ping + NET_RAW capability at runtime
RUN apk add --no-cache iputils-ping

COPY backend/package.json backend/package-lock.json* ./
RUN npm ci

COPY backend/ ./
RUN npm run build

COPY --from=frontend /app/dist /app/dist

RUN chmod +x docker-entrypoint.sh

ENV NODE_ENV=production
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
