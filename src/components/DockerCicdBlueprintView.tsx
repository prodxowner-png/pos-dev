import React, { useState } from 'react';
import { Container, GitBranch, CheckCircle2, Copy, Check, Terminal, Server, Layers } from 'lucide-react';

const DOCKERFILE_CONTENT = `# ==============================================================================
# PRODX ENTERPRISE POS - MULTI-STAGE PRODUCTION DOCKERFILE
# ==============================================================================

FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 prodx && \\
    adduser --system --uid 1001 prodx

COPY --from=builder --chown=prodx:prodx /app/package.json ./
COPY --from=builder --chown=prodx:prodx /app/node_modules ./node_modules
COPY --from=builder --chown=prodx:prodx /app/dist ./dist
COPY --from=builder --chown=prodx:prodx /app/server.ts ./server.ts

USER prodx
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \\
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/healthz || exit 1

CMD ["npx", "tsx", "server.ts"]`;

const DOCKER_COMPOSE_CONTENT = `version: "3.9"

services:
  prodx-app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://prodx_admin:prodx_secure_pw@postgres-primary:5432/prodx_pos
      - REDIS_URL=redis://redis-cache:6379/0
      - AUTO_MIGRATE_ON_BOOT=true
    depends_on:
      postgres-primary:
        condition: service_healthy
      redis-cache:
        condition: service_healthy

  postgres-primary:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=prodx_admin
      - POSTGRES_PASSWORD=prodx_secure_pw
      - POSTGRES_DB=prodx_pos
    volumes:
      - prodx_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U prodx_admin -d prodx_pos"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis-cache:
    image: redis:7-alpine
    command: ["redis-server", "--appendonly", "yes", "--maxmemory", "256mb"]

volumes:
  prodx_pgdata:`;

const GITHUB_ACTIONS_CONTENT = `name: PRODX Production Quality & Cloud Deployment Gate

on:
  push:
    branches: [main, release/*]
  pull_request:
    branches: [main]

jobs:
  quality-and-security-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
      - run: npm ci
      - run: npm run lint
      - run: npm run build

  postgres-migration-recovery-drill:
    needs: quality-and-security-gate
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
    steps:
      - name: Verify 30 Sequential Migrations (0001..0030)
        run: npx tsx scripts/migrate.ts --verify-checksums

  docker-build-and-cloud-deploy:
    needs: postgres-migration-recovery-drill
    runs-on: ubuntu-latest
    steps:
      - name: Build Multi-Stage Production Container
        run: docker build -t ghcr.io/prodx-org/prodx-pos:\${{ github.sha }} .
      - name: Zero-Downtime Rolling Cloud Rollout & /api/healthz Smoke Gate
        run: ./scripts/ci/verify-runtime-smoke.sh`;

export const DockerCicdBlueprintView: React.FC = () => {
  const [activeArtifact, setActiveArtifact] = useState<'DOCKERFILE' | 'COMPOSE' | 'CICD'>('DOCKERFILE');
  const [copied, setCopied] = useState(false);

  const currentCode =
    activeArtifact === 'DOCKERFILE'
      ? DOCKERFILE_CONTENT
      : activeArtifact === 'COMPOSE'
      ? DOCKER_COMPOSE_CONTENT
      : GITHUB_ACTIONS_CONTENT;

  const copyCode = () => {
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const gates = [
    {
      id: 'gate-01',
      name: 'production-quality-gate.yml',
      scope: 'TypeScript Strict Compile + ESLint + Theme Validator',
      duration: '42s',
      status: 'PASSED',
    },
    {
      id: 'gate-02',
      name: 'production-mock-boundary-gate.yml',
      scope: 'Zero Mock Leakage in Production Adapter Bundle Verification',
      duration: '19s',
      status: 'PASSED',
    },
    {
      id: 'gate-03',
      name: 'transaction-core-gate.yml',
      scope: 'Satang Financial Invariants & Idempotent Checkout Replay Test',
      duration: '54s',
      status: 'PASSED',
    },
    {
      id: 'gate-04',
      name: 'postgres-recovery-drill.yml',
      scope: 'Migrations 0001..0030 Forward Rollout + PITR Backup Restore Drill',
      duration: '1m 12s',
      status: 'PASSED',
    },
    {
      id: 'gate-05',
      name: 'auth-security.yml',
      scope: 'RBAC Permission Matrix, Supervisor PIN HMAC & Login Rate Throttle',
      duration: '38s',
      status: 'PASSED',
    },
    {
      id: 'gate-06',
      name: 'deploy-cloud-production.yml',
      scope: 'Multi-Stage Docker Build + Cloud Run / Railway Rolling Healthcheck',
      duration: '1m 45s',
      status: 'PASSED',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pb-6 border-b border-zinc-200">
        <h2 className="text-xl font-bold text-zinc-900 tracking-tight">
          01. Enterprise Container Topology & CI/CD Architecture
        </h2>
        <p className="text-sm text-zinc-600 mt-2 leading-relaxed">
          Scalable multi-tier architecture optimized for Cloud Run, Kubernetes, and high-performance POS workloads with automated quality gates.
        </p>
      </div>

      {/* Enterprise Container Topology */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-5 bg-white border border-zinc-200 rounded-xl shadow-sm space-y-4">
          <div className="flex items-center justify-between text-[11px] text-emerald-700 font-bold uppercase tracking-wider">
            <span>TIER 01 · STATELESS APP</span>
            <span className="px-1.5 py-0.5 bg-emerald-50 rounded">AUTO-SCALE</span>
          </div>
          <div className="flex items-center gap-3 text-zinc-900 font-bold text-base">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <Container className="w-5 h-5 text-emerald-600" />
            </div>
            <span>PRODX Core Engine</span>
          </div>
          <p className="text-sm text-zinc-600 leading-relaxed">
            Node.js 22 runtime with non-root security. Verified health probes at <code className="bg-zinc-100 px-1 rounded text-zinc-900">/api/healthz</code>.
          </p>
        </div>

        <div className="p-5 bg-white border border-zinc-200 rounded-xl shadow-sm space-y-4">
          <div className="flex items-center justify-between text-[11px] text-emerald-700 font-bold uppercase tracking-wider">
            <span>TIER 02 · DATABASE</span>
            <span className="px-1.5 py-0.5 bg-emerald-50 rounded">HIGH AVAILABILITY</span>
          </div>
          <div className="flex items-center gap-3 text-zinc-900 font-bold text-base">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <Server className="w-5 h-5 text-emerald-600" />
            </div>
            <span>PostgreSQL Ledger</span>
          </div>
          <p className="text-sm text-zinc-600 leading-relaxed">
            Append-only audit logs with financial balance invariant triggers and PITR recovery support.
          </p>
        </div>

        <div className="p-5 bg-white border border-zinc-200 rounded-xl shadow-sm space-y-4">
          <div className="flex items-center justify-between text-[11px] text-emerald-700 font-bold uppercase tracking-wider">
            <span>TIER 03 · CACHE</span>
            <span className="px-1.5 py-0.5 bg-emerald-50 rounded">AOF PERSISTENCE</span>
          </div>
          <div className="flex items-center gap-3 text-zinc-900 font-bold text-base">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <Layers className="w-5 h-5 text-emerald-600" />
            </div>
            <span>Redis Session & Locks</span>
          </div>
          <p className="text-sm text-zinc-600 leading-relaxed">
            Low-latency session store, distributed locks for idempotency, and login rate throttling.
          </p>
        </div>
      </div>

      {/* CI/CD Pipeline Gates + Configuration Code Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 5 Cols: 6 Automated CI/CD Gates */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center gap-2 px-1">
            <GitBranch className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-zinc-900 tracking-tight">
              CI/CD Production Quality Gates
            </h3>
          </div>

          <div className="divide-y divide-zinc-200 border border-zinc-200 rounded-xl bg-white shadow-sm overflow-hidden">
            {gates.map((gate, index) => (
              <div key={gate.id} className="p-4 flex items-start justify-between gap-4 hover:bg-zinc-50 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-mono text-zinc-900 font-bold">
                    <span className="text-zinc-400">0{index + 1}.</span>
                    <span>{gate.name}</span>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">{gate.scope}</p>
                </div>
                <div className="text-right shrink-0 font-mono tabular-nums">
                  <div className="text-emerald-600 font-bold text-xs inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 rounded-full border border-emerald-100">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{gate.status}</span>
                  </div>
                  <div className="text-[10px] font-bold text-zinc-400 mt-1 uppercase tracking-wider">{gate.duration}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 7 Cols: Ready-to-Deploy Infrastructure Code */}
        <div className="lg:col-span-7 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
          <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-zinc-900/50 border-b border-zinc-800">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveArtifact('DOCKERFILE')}
                className={`px-3 py-1.5 text-xs font-bold font-mono rounded-md transition-all ${
                  activeArtifact === 'DOCKERFILE'
                    ? 'bg-zinc-700 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Dockerfile
              </button>
              <button
                onClick={() => setActiveArtifact('COMPOSE')}
                className={`px-3 py-1.5 text-xs font-bold font-mono rounded-md transition-all ${
                  activeArtifact === 'COMPOSE'
                    ? 'bg-zinc-700 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                docker-compose.yml
              </button>
              <button
                onClick={() => setActiveArtifact('CICD')}
                className={`px-3 py-1.5 text-xs font-bold font-mono rounded-md transition-all ${
                  activeArtifact === 'CICD'
                    ? 'bg-zinc-700 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                production-pipeline.yml
              </button>
            </div>

            <button
              onClick={copyCode}
              className="px-3 py-1.5 text-[11px] font-bold text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg flex items-center gap-2 transition-all active:scale-95"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'COPIED' : 'COPY CODE'}</span>
            </button>
          </div>

          <div className="relative group">
            <pre className="p-6 text-[12px] font-mono text-zinc-300 overflow-x-auto leading-relaxed max-h-[440px] custom-scrollbar">
              {currentCode}
            </pre>
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="px-2 py-1 bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 rounded text-[10px] font-bold">
                READ-ONLY
              </div>
            </div>
          </div>

          <div className="px-6 py-4 bg-zinc-900 border-t border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] font-mono">
            <div className="flex items-center gap-2 text-zinc-400">
              <Terminal className="w-4 h-4 text-emerald-500" />
              <span className="text-zinc-300 font-bold">RUN COMMAND:</span>
              <code className="text-emerald-400">docker compose up -d --build</code>
            </div>
            <span className="text-zinc-500 uppercase tracking-widest text-[10px]">Production ready deployment artifact</span>
          </div>
        </div>
      </div>
    </div>
  );
};
