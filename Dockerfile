# ==========================================
# Metrics Backend - Production Dockerfile
# Optimized multi-stage build for Coolify/Docker
# ==========================================

# Stage 1: Build & Compile
FROM node:22-slim AS builder

WORKDIR /app

# Install OpenSSL for Prisma CLI and build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Layer 1: Dependencies (cached as long as package files do not change)
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

# Layer 2: Source code and compilation
COPY . .
RUN npm run build

# Stage 2: Production Runner
FROM node:22-slim AS runner

WORKDIR /app

# Install OpenSSL for Prisma engine & curl/wget for healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates curl wget && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3333

# Layer 1: Copy package definitions and prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# Layer 2: Install production dependencies only & generate Prisma Client
RUN npm ci --omit=dev && npx prisma generate

# Layer 3: Copy compiled application from builder
COPY --from=builder /app/build ./build

EXPOSE 3333

CMD ["node", "build/server.js"]
