# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**BarberFlow** is a multi-tenant barber shop management system. It manages appointments, professionals, services, packages, products, sales, and financial operations across multiple barbershops.

## Commands

### Backend (`/backend`)
```bash
npm install
npm run dev      # Runs on http://localhost:3001 with nodemon
npm start        # Production start
```

### Frontend (`/frontend`)
```bash
npm install
npm run dev      # Runs on http://localhost:5173
npm run build    # Production build to dist/
npm run lint     # ESLint check
npm run preview  # Preview production build
```

### Docker (backend only)
```bash
docker build -t barberflow-api backend/
docker run -p 3002:3002 --env-file backend/.env barberflow-api
```

> Note: there are no automated tests configured in this project.

## Architecture

### Monorepo Structure
- `backend/` — Node.js + Express API
- `frontend/` — React + Vite SPA
- `docs/api-contract.md` — API specification

### Backend

**Entry points**: `src/server.js` → `src/app.js`

Follows a standard layered pattern:
- `src/routes/` — Express routers (16+ files, one per feature)
- `src/controllers/` — Request handlers and business logic
- `src/services/` — Reusable logic (comissões, financeiro, platformOnboarding)
- `src/middlewares/` — Auth (`authAdmin.js`), RBAC (`requireRole.js`), validation, rate limiting
- `src/validators/` — Zod schemas for request bodies (`validate.js` exposes `validate(schema)` middleware)
- `src/config/index.js` — Environment variable validation on startup; includes `config.business.*` constants
- `src/lib/supabase.js` — Supabase admin client (service role, server-side only)
- `src/utils/controllerHelpers.js` — `getBarbeariaId(req)`, `respondBarbeariaAusente(res)` shared by all controllers
- `src/utils/datetime.js` — `parseDateOnly()`, `normalizeHora()`, `getNowInBusinessTimeZone()` shared by controllers
- `src/utils/response.js` — `sendError(res, status, code, message, details?)` for standardized error responses

**Multi-tenancy**: `barbearia_id` is always derived from the authenticated user's token/profile — never from client-provided headers. This is enforced in `authAdmin.js` middleware which populates `req.adminProfile` and `req.barbeariaId` (use `req.barbeariaId`, not `req.user.barbearia_id`).

**Authentication flow**:
1. Supabase issues JWT on login (browser receives HS256 tokens, Node.js client receives ES256)
2. Frontend stores token and sends as `Authorization: Bearer <token>`
3. Backend `authAdmin.js` validates in cascade:
   - If `SUPABASE_JWT_SECRET` is set: verifies HS256 signature locally → `getUserById(sub)` (covers browser tokens)
   - Fallback: `supabaseAdmin.auth.getUser(token)` (covers ES256 tokens from Node.js clients)
4. `requireRole.js` fetches admin role/barbearia via user ID → `admin_profiles` → `user_roles`, sets `req.barbeariaId` and `req.adminProfile`

**RBAC roles**: `admin_owner`, `admin_staff`, `barber` — enforced with `requireRole` middleware per route.

**Rate limiting**: 200 req/window default, 120 for admin routes, 60 for public create endpoints, 10 for `/internal/platform` (onboarding). The platform limiter is mounted at `app.use("/internal/platform", limiterPlatform)` — must stay path-scoped or it will throttle all routes.

**Debug routes** (dev only): `GET /__whoami`, `GET /__routes`

### Frontend

React 19 SPA with Tailwind CSS. No router library — view state managed locally.

**Key files**:
- `src/App.jsx` — Root component, handles auth state and view switching
- `src/config/api.js` — API base URL + `apiFetch()` wrapper (inclui timeout de 15s via `AbortController`)
- `src/lib/supabaseClient.js` — Frontend Supabase client (publishable key only)
- `src/hooks/useAdminAuth.js` — Auth state and session management
- `src/components/common/Badge.jsx` — Badge reutilizável (tones: slate, sky, emerald, amber, rose, red)
- `src/components/common/SectionCard.jsx` — Card de seção reutilizável com title/subtitle/actions
- `src/utils/formatters.js` — `formatBRL()`, `fmtBRDate()`, `normalizarDataISO()`, `normalizarHoraHHMM()`, `toNumberOrNull()`

**User flow**: Admin-only. The app opens directly to the login screen. After authentication:
- **`admin_owner`**: Full access (agenda, financeiro, serviços, profissionais, pacotes, produtos, vendas)
- **`admin_staff`**: All panels except financeiro

**Inactive code** (preserved for future public booking feature):
- `src/hooks/useAgendamentoFlow.js` — Public booking hook (useEffect disabled, no API calls)
- `src/components/steps/` — Multi-step wizard components (`ClienteStep`, `ProfissionalStep`, `ServicoStep`, `DataHorariosStep`, `Summary`)
- These files are NOT imported anywhere in the active app

**Admin dashboard panels**: `AdminAgenda`, `AdminFinanceiro`, `AdminProfissionais`, `AdminServicos`, `AdminPacotes`, `AdminProdutos`, `AdminVendas`

**API base URL logic** (from `src/config/api.js`):
- `agenda.nexushomelp.tec.br` → `https://api.nexushomelp.tec.br`
- `agenda-hml.nexushomelp.tec.br` → `https://api-hml.nexushomelp.tec.br`
- anything else → `http://localhost:3001`

### Database (Supabase / PostgreSQL)

No migration files in repo — schema must be pre-configured in Supabase. Key table groups:
- **Multi-tenant root**: `barbearias`, `admin_profiles`, `user_roles`
- **Scheduling**: `agendamentos`, `pacotes`, `pacote_horarios`, `pacote_excecoes`, `bloqueios_agenda`
- **People**: `profissionais`, `clientes`, `servicos`, `profissional_servico_comissoes`
- **Financial**: `fechamentos`, `adiantamentos`, `despesas`, `v_financeiro_diario` (view)
- **Sales**: `vendas`, `venda_itens`, `produtos`

## Environment Variables

### Backend (`backend/.env`)
```
NODE_ENV=development
PORT=3001
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
SUPABASE_JWT_SECRET=<Supabase Dashboard → Settings → API → JWT Secret>
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
PLATFORM_ONBOARDING_TOKEN=<hash>
ENABLE_DEBUG_ROUTES=true

# Constantes de negócio (opcional — todos têm defaults)
BUSINESS_TIME_ZONE=America/Sao_Paulo
LOCAL_OFFSET=-03:00
JANELA_INICIO_MIN=540
JANELA_FIM_MIN=1260
SLOT_GRANULARITY_MIN=30
ADMIN_RETRO_TOLERANCE_MINUTES=30
```

### Frontend (`frontend/.env`)
```
VITE_SUPABASE_URL=https://...supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

> The `SUPABASE_SECRET_KEY` (service role) is server-side only and must never be exposed to the frontend.
