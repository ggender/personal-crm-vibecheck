# One image for staging and prod: the app plus what the migrate step needs
# (tsx and src/db/migrations). Built once in CI, tagged with the commit SHA.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build && rm -rf .next/cache

# Production packages only, plus tsx for the migrate step.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev && npm install --no-save tsx

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/next.config.ts /app/tsconfig.json ./
COPY --from=build /app/.next ./.next
COPY --from=build /app/src ./src
USER node
EXPOSE 3000
# `npm start` binds to localhost; in a container the app must listen on all interfaces.
CMD ["npx", "next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
