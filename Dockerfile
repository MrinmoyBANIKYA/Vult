# Vult in one container: the built app and the engine (model calls, market data, saved runs) on one port,
# with LibreOffice to recalculate every generated workbook. Pair it with Ollama (see docker-compose.yml) so
# model calls stay inside your network, and with Supabase for sign-in and shared data.
#
#   docker build -t vult .
#   docker run -p 8787:8787 --env-file .env.production vult

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# VITE_ variables are baked into the browser bundle at build time.
ARG VITE_SUPABASE_URL=
ARG VITE_SUPABASE_PUBLISHABLE_KEY=
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends libreoffice-calc-nogui fonts-dejavu-core ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# On a server the engine answers beyond localhost, so every request must be signed in (see server/auth.js).
ENV NODE_ENV=production \
    VULT_ENGINE_HOST=0.0.0.0 \
    VULT_ENGINE_PORT=8787 \
    VULT_ENGINE_ALLOW_REMOTE=1 \
    VULT_ENGINE_LOG=json \
    VULT_SOFFICE=/usr/bin/soffice
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/src/lib ./src/lib
COPY --from=build /app/supabase/functions/_shared ./supabase/functions/_shared
RUN mkdir -p /app/.vult && chown -R node:node /app/.vult
USER node
VOLUME ["/app/.vult"]
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:8787/engine/health',{headers:{authorization:'Bearer '+(process.env.VULT_ENGINE_TOKEN||'')}}).then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.js"]
