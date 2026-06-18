# =============================================================================
# EduInsight Frontend — Development Dockerfile (Next.js dev server)
# =============================================================================
FROM node:20-alpine AS deps

WORKDIR /app

# Install dependencies (layer-cached until package.json changes)
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

# =============================================================================
# Runtime dev stage — mount source as volume for hot-reload
# =============================================================================
FROM node:20-alpine AS dev

WORKDIR /app

# Pull installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source (overridden by volume mount in docker-compose for hot-reload)
COPY . .

ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["npx", "next", "dev", "--hostname", "0.0.0.0"]
