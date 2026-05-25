# Stage 1: Build Frontend
FROM node:18-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.2.2 --activate

# Install dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json ./server/
COPY scripts/ensure-pnpm.mjs scripts/install-hooks.mjs ./scripts/
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build Vite App
RUN pnpm run build

# Stage 2: Production Runtime
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@11.2.2 --activate

# Copy Static Server Dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json ./server/
COPY scripts/ensure-pnpm.mjs scripts/install-hooks.mjs ./scripts/
RUN pnpm install --filter etb-idp-server --prod --frozen-lockfile

# Copy Static Server Source
WORKDIR /app/server
COPY server/server.js ./

# Copy Frontend Build from Stage 1 to server/dist
COPY --from=builder /app/dist ./dist

EXPOSE 8080

CMD ["node", "server.js"]
