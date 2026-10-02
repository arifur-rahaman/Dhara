# syntax=docker/dockerfile:1
# Production image for the Next.js app (standalone output).
FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S dhara && adduser -S dhara -G dhara
COPY --from=build --chown=dhara:dhara /app/.next/standalone ./
COPY --from=build --chown=dhara:dhara /app/.next/static ./.next/static
COPY --from=build --chown=dhara:dhara /app/public ./public
USER dhara
EXPOSE 3000
CMD ["node", "server.js"]
