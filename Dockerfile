# syntax=docker/dockerfile:1

# ---------- 1. install: all dependencies (build tools included) ----------
FROM node:22-bookworm-slim AS install
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY views/package.json views/
COPY server/package.json server/
RUN npm ci

# ---------- 2. build: views first, then the server bundle ----------
FROM install AS build
COPY . .
RUN npm run build

# ---------- 3. production dependencies for the server only ----------
FROM node:22-bookworm-slim AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY views/package.json views/
COPY server/package.json server/
RUN npm ci --omit=dev --workspace server --ignore-scripts && npm cache clean --force

# ---------- 4. slim runtime, non-root ----------
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3001
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/server/package.json ./server/package.json
COPY --from=build --chown=node:node /app/server/dist ./server/dist
COPY --from=build --chown=node:node /app/views/dist ./views/dist
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/dist/index.js"]
