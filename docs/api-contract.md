# BarberFlow API Contract

## Overview
Base URL (future):
`https://api.agenda.nexushomelp.tec.br`

All responses use JSON format and standard HTTP status codes.

---

# 1. Context

### GET /context
Returns barbershop information based on host or slug.

**Query Params**  
- host: string

**Response 200**
```json
{
  "barbearia": {
    "id": "uuid",
    "nome": "Barbearia do João",
    "slug": "barbearia-do-joao",
    "whatsapp": "+55 14 99999-9999"
  }
}
```

---

# 2. Profissionais

### GET /profissionais
Lists active professionals for the current barbershop.

**Response 200**
```json
[
  { "id": "uuid", "nome": "João", "whatsapp": "+55 14 99999-0000" },
  { "id": "uuid", "nome": "Pedro", "whatsapp": "+55 14 98888-0000" }
]
```

---

# 3. Serviços

### GET /servicos
Lists services available.

**Response 200**
```json
[
  { "id": "uuid", "nome": "Corte", "duracao_minutos": 30, "preco": 40.00 },
  { "id": "uuid", "nome": "Barba", "duracao_minutos": 20, "preco": 30.00 }
]
```

---

# 4. Clientes

### POST /clientes/lookup
Finds or creates a client by WhatsApp.

**Body**
```json
{
  "whatsapp": "+55 14 99999-1111",
  "nome": "José da Silva"
}
```

**Response 200**
```json
{
  "id": "uuid",
  "nome": "José da Silva",
  "whatsapp": "+55 14 99999-1111",
  "cadastrado_previo": false
}
```

---

# 5. Disponibilidade

### GET /disponibilidade
Returns available time slots.

**Query Params**
- profissional_id: string
- servico_id: string
- data: YYYY-MM-DD

**Response 200**
```json
{
  "data": "2025-12-10",
  "profissional_id": "uuid",
  "servico_id": "uuid",
  "duracao_minutos": 30,
  "horarios_disponiveis": ["09:00", "09:30", "10:00", "14:30"]
}
```

---

# 6. Agendamentos

### POST /agendamentos
Creates a new appointment.

**Body**
```json
{
  "cliente_id": "uuid",
  "profissional_id": "uuid",
  "servico_id": "uuid",
  "data": "2025-12-10",
  "hora": "09:30"
}
```

**Response 201**
```json
{
  "id": "uuid",
  "status": "confirmado",
  "inicio": "2025-12-10T12:30:00Z",
  "fim": "2025-12-10T13:00:00Z",
  "google_event_id": "abc123@google.com"
}
```

---

### GET /agendamentos
Lists appointments, filterable.

Example:
```
GET /agendamentos?data=2025-12-10
```

**Response 200**
```json
[
  {
    "id": "uuid",
    "cliente_nome": "José da Silva",
    "profissional_nome": "João",
    "servico_nome": "Corte",
    "inicio": "2025-12-10T12:30:00Z",
    "fim": "2025-12-10T13:00:00Z",
    "status": "confirmado"
  }
]
```

---

### DELETE /agendamentos/:id
Cancels an appointment.

**Response 200**
```json
{
  "id": "uuid",
  "status": "cancelado"
}
```

---
