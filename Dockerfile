# syntax=docker/dockerfile:1.7

# ---------- Build stage ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps using lockfile when available for reproducible builds.
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy source and build using the Node adapter.
COPY . .
ENV ADAPTER=node
RUN npm run build

# Prune dev dependencies for the runtime image.
RUN npm prune --omit=dev

# ---------- Runtime stage ----------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

# Copy only what's needed to run the SvelteKit Node server.
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Run as a non-root user.
RUN addgroup -S app && adduser -S app -G app \
    && chown -R app:app /app
USER app

EXPOSE 3000

CMD ["node", "build/index.js"]
