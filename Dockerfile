# syntax=docker/dockerfile:1.7
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/engine/package.json packages/engine/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --ignore-scripts

FROM deps AS build
ENV NUXT_TELEMETRY_DISABLED=1
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
# ordre du build racine : engine (dist/ typé, lu par l'API) -> web (nuxt generate) -> api (tsc)
RUN npm run build -w @matreso/engine \
 && (cd apps/web && npx nuxt prepare) \
 && npm run build -w @matreso/web \
 && npm run build -w @matreso/api

FROM node:24-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/engine/package.json packages/engine/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# dépendances de production de l'API et du moteur seulement (le front est déjà construit) ; npm recrée le lien de workspace
# node_modules/@matreso/engine -> ../../packages/engine, résolu dans l'image finale vers /app/packages/engine/dist
RUN npm ci --omit=dev --ignore-scripts -w @matreso/api -w @matreso/engine

FROM node:24-alpine AS runtime
RUN apk add --no-cache tzdata
ENV NODE_ENV=production PORT=3000 WEB_DIST=/app/web TZ=Europe/Paris
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/packages/engine/package.json ./packages/engine/package.json
COPY --from=build /app/packages/engine/dist ./packages/engine/dist
# apps/api/package.json à côté de dist/ : le serveur MCP y lit la version du paquet ; drizzle/ : migrations jouées au démarrage
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/drizzle ./apps/api/drizzle
COPY --from=build /app/apps/web/.output/public ./web
USER node
EXPOSE 3000
# variables à fournir au lancement : DATABASE_URL, SESSION_SECRET, PUBLIC_URL (origine publique, sans chemin), WEBAUTHN_RP_ID et WEBAUTHN_ORIGIN
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s CMD wget -qO- http://127.0.0.1:${PORT}/api/health || exit 1
WORKDIR /app/apps/api
CMD ["node", "dist/main.js"]
