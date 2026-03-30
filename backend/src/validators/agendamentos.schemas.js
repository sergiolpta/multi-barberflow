// backend/src/validators/agendamentos.schemas.js
import { z } from "zod";

const yyyyMmDd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser YYYY-MM-DD");

const hhMm = z.string().regex(/^\d{2}:\d{2}$/, "Hora deve ser HH:MM");

// ✅ NOVO: nascimento (permite vazio/ausente, mas se vier, tem que ser YYYY-MM-DD)
const nascimentoYYYYMMDD = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Nascimento deve ser YYYY-MM-DD");

export const criarAgendamentoSchema = z.object({
  body: z
    .object({
      cliente_id: z.string().uuid().optional(),
      cliente_nome: z.string().min(2).max(120).optional(),
      cliente_whatsapp: z.string().min(8).max(30).optional(),

      // ✅ NOVO
      cliente_nascimento: nascimentoYYYYMMDD.optional(),

      profissional_id: z.string().uuid(),
      servico_id: z.string().uuid(),

      data: yyyyMmDd,
      hora: hhMm,

      pago: z.boolean().optional(),
    })
    .refine(
      (v) => {
        // se não veio cliente_id, exige nome + whatsapp
        if (!v.cliente_id) return !!v.cliente_nome && !!v.cliente_whatsapp;
        return true;
      },
      { message: "Sem cliente_id, informe cliente_nome e cliente_whatsapp" }
    ),

  query: z.any().optional(),
  params: z.any().optional(),
  headers: z.any().optional(),
});

export const reagendarSchema = z.object({
  body: z.object({
    data: yyyyMmDd,
    hora: hhMm,
  }),
  params: z.object({
    id: z.string().uuid(),
  }),
  query: z.any().optional(),
  headers: z.any().optional(),
});

export const cancelarSchema = z.object({
  body: z.any().optional(),
  params: z.object({
    id: z.string().uuid(),
  }),
  query: z.any().optional(),
  headers: z.any().optional(),
});

export const concluirSchema = z.object({
  body: z.any().optional(),
  params: z.object({
    id: z.string().uuid(),
  }),
  query: z.any().optional(),
  headers: z.any().optional(),
});

export const listarAgendamentosSchema = z.object({
  query: z.object({
    data: yyyyMmDd,
    profissional_id: z.string().uuid().optional(),
  }),
  body: z.any().optional(),
  params: z.any().optional(),
  headers: z.any().optional(),
});

/**
 * NOVO: Schema para adicionar extras (serviços) ao agendamento
 *
 * Endpoint: POST /agendamentos/:id/extras
 */
export const adicionarExtrasAgendamentoSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),

  body: z.object({
    profissional_id: z.string().uuid().optional(),
    user_id: z.string().uuid().optional(),

    itens: z
      .array(
        z.object({
          servico_id: z.string().uuid(),

          // ✅ aceita number ou string numérica ("1")
          quantidade: z.coerce.number().int().positive().optional(),

          // ✅ aceita number ou string numérica ("30.00")
          preco_venda_unit: z.coerce.number().nonnegative().optional(),
          preco_custo_unit: z.coerce.number().nonnegative().optional(),
        })
      )
      .min(1, "Informe ao menos um item em 'itens'"),
  }),

  query: z.any().optional(),
  headers: z.any().optional(),
});
