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

COPY tsconfig.json tsconfig.build.json ./
COPY scripts/clean-dist.mjs scripts/check-dist-runtime.mjs ./scripts/
COPY src ./src
RUN pnpm build && pnpm prune --prod

# ---- runtime: pruned production deps + compiled output only ----
FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    ACP_PORT=4317 \
    MSGPACKR_NATIVE_ACCELERATION_DISABLED=true

COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist

# Durable-storage mount point for the sqlite adapter. Created and owned by the
# runtime `node` user so a named/bind volume mounted here is writable without
# running as root (Docker seeds an empty named volume with this dir's ownership).
RUN mkdir -p /data && chown node:node /data

# Drop privileges: the stock `node` user ships with the base image.
USER node

EXPOSE 4317

# Readiness probe (ADR-0008 operational contract): green only when the storage
# backend answers. Node 24 has global fetch, so no curl is needed in the image.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.ACP_PORT||4317)+'/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/app/server/main.js"]
