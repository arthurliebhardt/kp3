# Korepush Codex

Self-hosted K3s PaaS MVP scaffold.

This repository is a Turborepo monorepo for the platform described in the functional spec:

- `apps/web`: Next.js dashboard, API routes, Better Auth integration points
- `apps/worker`: TypeScript worker for Postgres queue jobs and Kubernetes writes
- `packages/db`: Drizzle schema, database client, migrations entrypoint
- `packages/queue`: Postgres-backed job queue with `FOR UPDATE SKIP LOCKED`
- `packages/k8s`: Kubernetes labels, path validation, manifest builders, client helpers
- `packages/crypto`: AES-GCM helpers for encrypted env vars and future kubeconfigs
- `packages/auth`: Better Auth factory
- `infra/k8s`: platform manifests used by the installer
- `scripts/install.sh`: single-server K3s installer foundation

## Local development

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

## Database

```bash
pnpm db:generate
pnpm db:migrate
```

## Worker

```bash
pnpm worker
```
