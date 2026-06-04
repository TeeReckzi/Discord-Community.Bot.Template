FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

# Copy Prisma schema from repo root so the dashboard's Prisma client
# can be generated. The dashboard uses Prisma directly via @/lib/prisma.
COPY ../prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json next.config.js ./
COPY src/ ./src/
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next/ ./.next/
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/next.config.js ./

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["npm", "start"]
