# syntax=docker/dockerfile:1.7
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --ignore-scripts

FROM deps AS build
ENV NUXT_TELEMETRY_DISABLED=1
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
# ordre : shared (dist/ typé, lu par l'API) -> web (nuxt generate) -> api (tsc)
RUN npm run build -w @cresus/shared \
 && (cd apps/web && npx nuxt prepare) \
 && npm run build -w @cresus/web \
 && npm run build -w @cresus/api

FROM node:24-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# dépendances de production de l'API et de shared seulement (le front est déjà construit) ; npm recrée le lien de
# workspace node_modules/@cresus/shared -> ../../packages/shared, résolu dans l'image finale vers /app/packages/shared/dist
RUN npm ci --omit=dev --ignore-scripts -w @cresus/api -w @cresus/shared

FROM node:24-alpine AS runtime
RUN apk add --no-cache tzdata
ENV NODE_ENV=production PORT=3000 WEB_DIST=/app/web TZ=Europe/Paris
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
# drizzle/ : migrations jouées au démarrage
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/drizzle ./apps/api/drizzle
COPY --from=build /app/apps/web/.output/public ./web
USER node
EXPOSE 3000
# à fournir : DATABASE_URL, SESSION_SECRET ; ADMIN_EMAILS pour le panneau d'admin
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s CMD wget -qO- http://127.0.0.1:${PORT}/api/health || exit 1
WORKDIR /app/apps/api
CMD ["node", "dist/main.js"]
