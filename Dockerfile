# Stage 1: Build the React frontend
FROM node:20-bookworm-slim AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm install
COPY client/ ./
COPY tsconfig.base.json /app/
RUN npm run build

# Stage 2: Build the Express server
FROM node:20-bookworm-slim AS server-build
WORKDIR /app/server
COPY server/package.json server/package-lock.json* ./
RUN npm install
COPY server/ ./
COPY tsconfig.base.json /app/
RUN npm run build

# Stage 3: Production image with Playwright Chromium
FROM mcr.microsoft.com/playwright:v1.49.1-noble
WORKDIR /app

# Copy built client
COPY --from=client-build /app/client/dist ./client/dist

# Copy server source and install production deps
COPY server/package.json server/package-lock.json* ./server/
WORKDIR /app/server
RUN npm install --omit=dev
RUN npx playwright install chromium

# Copy compiled server
COPY --from=server-build /app/server/dist ./dist

WORKDIR /app/server
ENV NODE_ENV=production
EXPOSE 10000
CMD ["node", "dist/index.js"]
