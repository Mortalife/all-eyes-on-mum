# Stage 1: Install dependencies
FROM node:24-slim AS deps

RUN corepack enable pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

# Stage 2: Build application
FROM node:24-slim AS build

RUN corepack enable pnpm

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm run build

# Prune dev dependencies after build
RUN pnpm prune --prod

# Stage 3: Production image with Litestream
FROM node:24-slim AS production

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates wget && \
    wget -qO /tmp/litestream.deb https://github.com/benbjohnson/litestream/releases/download/v0.5.6/litestream-0.5.6-linux-x86_64.deb && \
    dpkg -i /tmp/litestream.deb && \
    rm /tmp/litestream.deb && \
    apt-get purge -y wget && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy production node_modules and built output
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-public ./dist-public
COPY --from=build /app/package.json ./

# Create data directory for SQLite databases
RUN mkdir -p /data

# Litestream configuration file
COPY litestream.yml /etc/litestream.yml

ENV NODE_ENV=production
ENV DATABASE_PATH=/data/
ENV PORT=3000

EXPOSE 3000

# Use litestream replicate -exec to start the app with continuous replication
CMD ["litestream", "replicate", "-config", "/etc/litestream.yml", "-exec", "node dist/index.js"]
