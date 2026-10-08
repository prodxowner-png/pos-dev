import React, { useState } from 'react';
import { Container, GitBranch, CheckCircle2, Copy, Check, Terminal, Server, Layers, ShieldCheck } from 'lucide-react';

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
    <div className="space-y-8 max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 pb-10 border-b border-slate-200">
        <div className="min-w-0 flex items-center gap-6">
          <div className="p-4 bg-emerald-50 rounded-2xl shrink-0 border border-emerald-100/50">
            <Container className="w-8 h-8 text-emerald-600" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
              <span className="text-emerald-600">Infrastructure Blueprint</span>
              <span aria-hidden="true" className="text-slate-200">/</span>
              <span>Multi-Stage Topology</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight [text-wrap:balance]">
              Deployment & Container Orchestration
            </h2>
            <p className="text-sm md:text-base text-slate-500 font-medium leading-relaxed max-w-2xl [text-wrap:balance]">
              Enterprise-grade container definitions for Cloud Run, Kubernetes, and 
              High-Availability POS clusters with automated quality gates.
            </p>
          </div>
        </div>
      </div>

      <p className="text-slate-600 font-normal text-sm leading-relaxed max-w-3xl">
        สถาปัตยกรรมระดับองค์กรแบบ Multi-tier สำหรับ Cloud Run, Kubernetes และ High-Performance POS Workloads พร้อมระบบตรวจสอบคุณภาพอัตโนมัติ (Automated Quality Gates)
      </p>

      {/* Enterprise Container Topology Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm group hover:border-emerald-200 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tier 01</span>
              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-bold rounded">Stateless</span>
            </div>
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] font-bold uppercase rounded border border-emerald-100">Auto-Scale</span>
          </div>
          <div className="flex items-center gap-3 text-slate-900 font-bold text-lg tracking-tight mb-3">
            <div className="p-2 bg-slate-50 rounded-xl text-slate-600 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
              <Container className="w-5 h-5" />
            </div>
            <span>PRODX Core</span>
          </div>
          <p className="text-slate-600 font-normal text-sm leading-relaxed">
            Node.js 22 runtime with non-root security. Verified health probes at <code className="bg-slate-50 px-1.5 py-0.5 rounded text-indigo-600 font-mono text-xs border border-slate-200/60">/api/healthz</code>.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm group hover:border-indigo-200 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tier 02</span>
              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-bold rounded">Stateful</span>
            </div>
            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[9px] font-bold uppercase rounded border border-indigo-100">High Avail</span>
          </div>
          <div className="flex items-center gap-3 text-slate-900 font-bold text-lg tracking-tight mb-3">
            <div className="p-2 bg-slate-50 rounded-xl text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
              <Server className="w-5 h-5" />
            </div>
            <span>PostgreSQL Ledger</span>
          </div>
          <p className="text-slate-600 font-normal text-sm leading-relaxed">
            Append-only audit logs with financial balance invariant triggers and PITR recovery support.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm group hover:border-amber-200 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tier 03</span>
              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-bold rounded">Cache</span>
            </div>
            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[9px] font-bold uppercase rounded border border-amber-100">AOF Sync</span>
          </div>
          <div className="flex items-center gap-3 text-slate-900 font-bold text-lg tracking-tight mb-3">
            <div className="p-2 bg-slate-50 rounded-xl text-slate-600 group-hover:bg-amber-50 group-hover:text-amber-600 transition-colors">
              <Layers className="w-5 h-5" />
            </div>
            <span>Redis Sessions</span>
          </div>
          <p className="text-slate-600 font-normal text-sm leading-relaxed">
            Low-latency session store, distributed locks for idempotency, and login rate throttling.
          </p>
        </div>
      </div>

      {/* CI/CD Pipeline Gates + Configuration Code Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 5 Cols: Automated CI/CD Gates */}
        <div className="lg:col-span-5 space-y-6">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-slate-900 font-bold text-lg tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Operational Audit Blocks
            </h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">6 Verified Gates</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {gates.map((gate, index) => (
              <div key={gate.id} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-emerald-200 transition-all group">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[10px] font-bold text-slate-400 font-mono">#{index + 1}</div>
                  <div className="text-emerald-700 font-bold text-[9px] inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 rounded-full border border-emerald-100">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    <span>PASSED</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-slate-900 leading-tight group-hover:text-emerald-700 transition-colors">
                    {gate.name}
                  </div>
                  <p className="text-[10px] text-slate-500 font-normal leading-relaxed line-clamp-2">
                    {gate.scope}
                  </p>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[9px] font-bold">
                  <span className="text-slate-400 uppercase tracking-wider">Duration</span>
                  <span className="text-slate-600 font-mono">{gate.duration}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 7 Cols: Ready-to-Deploy Infrastructure Code Viewer */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {['DOCKERFILE', 'COMPOSE', 'CICD'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveArtifact(tab as any)}
                  className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                    activeArtifact === tab
                      ? 'bg-slate-900 text-white shadow-sm shadow-slate-200'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  {tab === 'DOCKERFILE' ? 'Dockerfile' : tab === 'COMPOSE' ? 'Compose.yml' : 'CI-Pipeline'}
                </button>
              ))}
            </div>

            <button
              onClick={copyCode}
              className="px-3 py-1.5 text-[10px] font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-2 transition-all active:scale-95 shadow-sm"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'COPIED' : 'COPY'}</span>
            </button>
          </div>

          <div className="relative group p-6 bg-slate-50/30">
            <pre className="text-[11px] font-mono text-slate-700 overflow-x-auto leading-relaxed max-h-[440px] custom-scrollbar whitespace-pre">
              {currentCode}
            </pre>
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="px-2 py-1 bg-white border border-slate-200 text-slate-400 rounded text-[9px] font-bold shadow-sm">
                READ-ONLY ARTIFACT
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-sm">
                <Terminal className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Quick Start Command</span>
                <code className="text-xs font-mono font-bold text-slate-900 tabular-nums">docker compose up -d --build</code>
              </div>
            </div>
            <span className="text-slate-400 uppercase tracking-widest text-[9px] font-bold">Prod-Grade Artifact</span>
          </div>
        </div>
      </div>
    </div>
  );
};
