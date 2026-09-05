# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=26
ARG PNPM_VERSION=11.17.0

# --- BASE ---
FROM node:${NODE_VERSION}-bookworm-slim AS base
ARG PNPM_VERSION
ENV PNPM_HOME="/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"
RUN npm install -g pnpm@${PNPM_VERSION}
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
  --mount=type=cache,target=/var/lib/apt,sharing=locked \
  apt-get update \
  && apt-get install -y --no-install-recommends openssl
WORKDIR /workspace

# --- FETCH ---
FROM base AS fetch
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./ 
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  --mount=type=cache,id=pnpm-metadata,target=/root/.cache/pnpm \
  pnpm --trust-lockfile fetch --frozen-lockfile

# --- BUILD ---
FROM fetch AS build
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  --mount=type=cache,id=pnpm-metadata,target=/root/.cache/pnpm \
  pnpm --trust-lockfile install --offline --frozen-lockfile

RUN pnpm --filter @leads-router/router prisma:generate \
  && pnpm --filter @leads-router/common build \
  && pnpm --filter @leads-router/gateway build \
  && pnpm --filter @leads-router/router build

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  --mount=type=cache,id=pnpm-metadata,target=/root/.cache/pnpm \
  pnpm --trust-lockfile --prefer-offline --filter @leads-router/gateway --prod deploy --legacy /prod/gateway \
  && pnpm --trust-lockfile --prefer-offline --filter @leads-router/router --prod deploy --legacy /prod/router

# --- RUN: migrations ---
FROM build AS migrate
WORKDIR /workspace/apps/router
CMD ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]

# --- RUN: gateway ---
FROM gcr.io/distroless/nodejs${NODE_VERSION}-debian13:nonroot AS gateway
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=65532:65532 /prod/gateway ./
CMD ["dist/main.js"]

# --- RUN: router ---
FROM gcr.io/distroless/nodejs${NODE_VERSION}-debian13:nonroot AS router
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=65532:65532 /prod/router ./
CMD ["dist/main.js"]
