FROM node:24-alpine
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/worker apps/worker
COPY packages packages
RUN pnpm install --frozen-lockfile=false --config.dangerouslyAllowAllBuilds=true
CMD ["pnpm", "--filter", "@korepush/worker", "dev"]
