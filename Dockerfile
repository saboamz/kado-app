# syntax=docker/dockerfile:1

# Dependencies are installed once and reused, so a source-only change does not
# re-run npm ci.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The client is generated from the schema, not committed, so it must exist
# before next build type-checks anything importing it.
RUN npx prisma generate
# A build-time placeholder: no query runs here, but the schema demands the
# variable be set. The real one is injected at run time.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# A separate image that only applies migrations, run to completion before the
# server starts. Keeping the CLI and its dependency tree out of the runtime
# image means the long-lived container carries no migration tooling.
FROM node:22-alpine AS migrate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma
CMD ["npx", "prisma", "migrate", "deploy"]

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# An unprivileged user: nothing in the runtime needs root.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# The generated client, which standalone tracing does not pick up on its own.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
# Migrations and the CLI live outside the server, run by the migrate stage
# below rather than by this image at boot.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
