# syntax=docker/dockerfile:1
# ACP reference host — multi-stage build producing a small, non-root runtime image.
# The same image runs every ADR-0008 deployment profile via environment variables.

# ---- builder: install all deps and compile TypeScript -> dist/ ----
FROM node:24-slim AS builder
WORKDIR /app

# Pin pnpm to the version the repo requires (package.json devEngines).
RUN corepack enable && corepack prepare pnpm@11.7.0 --activate

# Install with a warm store cache; copy manifests first for layer caching.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

# ---- runtime: production deps + compiled output only ----
FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    ACP_PORT=4317

RUN corepack enable && corepack prepare pnpm@11.7.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --prod --frozen-lockfile

COPY --from=builder /app/dist ./dist

# Drop privileges: the stock `node` user ships with the base image.
USER node

EXPOSE 4317

# Readiness probe (ADR-0008 operational contract): green only when the storage
# backend answers. Node 24 has global fetch, so no curl is needed in the image.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.ACP_PORT||4317)+'/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/app/server/main.js"]
