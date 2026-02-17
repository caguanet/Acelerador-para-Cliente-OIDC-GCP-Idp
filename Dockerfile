# Stage 1: Build Frontend
FROM node:18-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
# Legacy peer deps flag might be needed for some vite plugins
# Use --ignore-scripts to prevent postinstall from failing (backend dir not copied yet)
RUN npm install --legacy-peer-deps --ignore-scripts

# Copy source
COPY . .

# Build Vite App
RUN npm run build

# Stage 2: Production Runtime
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy Static Server Dependencies
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm install --production

# Copy Static Server Source
COPY server/server.js ./

# Copy Frontend Build from Stage 1 to server/dist
COPY --from=builder /app/dist ./dist

EXPOSE 8080

CMD ["node", "server.js"]
