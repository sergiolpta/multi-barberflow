# BarberFlow ✂️💈
Sistema completo de gestão para barbearias, com foco em **agenda inteligente**, **controle financeiro**, **multi-profissionais** e **automação de processos**.

---

## 📌 Visão Geral

O **BarberFlow** é uma aplicação full-stack desenvolvida para barbearias que precisam sair do controle manual (papel/WhatsApp) e adotar um fluxo profissional de agendamentos, atendimento e gestão financeira.

O projeto foi pensado desde o início para:
- Escalar para múltiplas barbearias (multi-tenant)
- Integrar com automações (n8n, WhatsApp, Google Calendar)
- Rodar de forma estável em produção (Docker + VPS)

---

## 🚀 Principais Funcionalidades

### 📅 Agendamentos
- Agenda por profissional
- Controle de horários disponíveis
- Integração com Google Calendar
- Endpoints preparados para automação via WhatsApp

### 👥 Profissionais
- Cadastro de profissionais
- Associação com serviços
- Comissão por serviço
- Comissão por pacote
- Estrutura preparada para regras por vigência

### 🧾 Serviços & Pacotes
- Serviços individuais
- Pacotes recorrentes
- Controle de vigência
- Estrutura pronta para cobrança e comissão

### 💰 Financeiro
- Estrutura de comissões
- Adiantamentos
- Despesas
- Fechamento por período
- Snapshot financeiro
- Base para expansão (PDV, vendas, relatórios)

### 🔐 Autenticação & Segurança
- Autenticação baseada em token
- Controle por barbearia (multi-tenant)
- Contexto da barbearia resolvido pelo usuário autenticado
- Uso de RLS no Supabase
- Service Role isolado no backend

---

## 🧱 Arquitetura

```text
barberflow/
├── backend/              # API Node.js + Express
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── middlewares/
│   │   ├── lib/
│   │   └── server.js
│   ├── Dockerfile
│   └── package.json
│
├── frontend/             # Frontend
│
└── infra/
    └── docker-compose.yml


🛠️ Stack Tecnológica
Backend

Node.js 20

Express

Supabase (PostgreSQL + Auth)

Docker

Infraestrutura

Docker Compose

Traefik (Reverse Proxy)

Cloudflare (DNS / SSL)

VPS Linux (produção)

Automação (ecossistema)

n8n

Google Calendar

WhatsApp API (planejado)

⚙️ Variáveis de Ambiente

Exemplo de .env utilizado no backend:

PORT=3001
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_publishable_key
SUPABASE_SECRET_KEY=your_service_role_key
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=200
ENABLE_DEBUG_ROUTES=true

⚠️ Nunca versione o .env real.
Em produção, ele deve ser carregado por variável de ambiente, env_file ou mecanismo equivalente da sua infraestrutura.

🐳 Rodando com Docker (Produção / VPS)
docker compose up -d --build barberflow-api

Verificar status:

docker compose ps
docker logs barberflow-api

Health check:

curl http://localhost:3001/health
🧪 Rodando Localmente (Desenvolvimento)
cd backend
npm install
npm run dev

Requer Node.js 18+ e acesso ao projeto Supabase.

🌐 Acesso via Traefik

Em produção, a API pode ser acessada via domínio:

https://api.seudominio.com/health

O Traefik roteia automaticamente para o container correto.

🧠 Conceitos Importantes

Multi-tenant: todas as rotas administrativas operam dentro do barbearia_id do usuário autenticado

A barbearia não é definida por header do frontend

O backend não deve depender de BARBEARIA_ID_DEFAULT

O backend nunca expõe service role ao frontend

O frontend nunca deve acessar a service role

As operações de leitura, criação, edição e exclusão devem sempre filtrar por barbearia_id

📈 Status do Projeto

✔ API funcional
✔ Multi-tenant em consolidação
✔ Infraestrutura validada em produção
✔ Pronto para evolução controlada em ambiente separado

🔄 Em evolução:

Financeiro avançado

PDV

WhatsApp automatizado

Dashboard analítico

Domínio por barbearia

Isolamento multi-tenant completo com revisão estrutural

👤 Autor

Sérgio Braz
Automação • Integrações • Sistemas sob medida

GitHub: https://github.com/sergiolpta

📄 Licença

Projeto privado. Uso comercial restrito.