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

# Layer 3: Prune devDependencies to keep only production packages for runtime
RUN npm prune --omit=dev && npx prisma generate

# Stage 2: Production Runner
FROM node:22-slim AS runner

WORKDIR /app

# Install OpenSSL for Prisma engine, curl/wget for healthchecks e tzdata para o fuso horário
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates curl wget tzdata && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3333
# Todos os clientes são do Brasil: o servidor roda sempre no horário de Brasília
ENV TZ=America/Sao_Paulo

# Layer 1: Copy package definitions and prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# Layer 2: Copy pre-built production node_modules from builder (no duplicate internet download!)
COPY --from=builder /app/node_modules ./node_modules

# Layer 3: Copy compiled application from builder
COPY --from=builder /app/build ./build

EXPOSE 3333

CMD ["node", "build/server.js"]
