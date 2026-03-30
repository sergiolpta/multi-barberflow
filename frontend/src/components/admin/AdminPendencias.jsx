// src/components/admin/AdminPendencias.jsx
import { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../../config/api";
import { Badge } from "../common/Badge";
import { SectionCard } from "../common/SectionCard";
import { fmtBRDate, formatBRL } from "../../utils/formatters";

export function AdminPendencias({
  accessToken,
  onVoltar,
  barbeariaNome,
  barbeariaLogoUrl,
}) {
  const [pendentes, setPendentes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [recebendoId, setRecebendoId] = useState(null);

  useEffect(() => {
    carregarPendentes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function carregarPendentes() {
    setLoading(true);
    setErro(null);
    try {
      const data = await apiFetch("/agendamentos/pendentes", { accessToken });
      setPendentes(Array.isArray(data) ? data : []);
    } catch (err) {
      setErro(err.message || "Erro ao carregar pendências.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReceber(ag) {
    setRecebendoId(ag.id);
    try {
      await apiFetch(`/agendamentos/${ag.id}/pagar`, { accessToken, method: "PATCH" });
      setPendentes((prev) => prev.filter((p) => p.id !== ag.id));
    } catch (err) {
      alert(err.message || "Erro ao registrar pagamento.");
    } finally {
      setRecebendoId(null);
    }
  }

  const totalPendente = useMemo(
    () => pendentes.reduce((acc, p) => acc + Number(p.preco_aplicado ?? 0), 0),
    [pendentes]
  );

  return (
    <div className="min-h-screen bg-[var(--bg-app)] px-4 py-8 text-[var(--text-app)] md:py-10">
      <div className="mx-auto w-full max-w-7xl">
        <header className="mb-8 overflow-hidden rounded-[28px] border border-[var(--border-color)] bg-[var(--bg-panel)] shadow-[var(--shadow-panel)] backdrop-blur-xl">
          <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" />
          <div className="flex flex-col gap-6 p-5 md:p-7 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              {barbeariaLogoUrl ? (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-white/60 bg-white/95 p-3 shadow-xl shadow-black/10">
                  <img
                    src={barbeariaLogoUrl}
                    alt={barbeariaNome || "Logo da barbearia"}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-amber-500/10 text-3xl">
                  ⏳
                </div>
              )}

              <div className="min-w-0">
                <div className="mb-2 inline-flex items-center rounded-full border border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-3 py-1 text-[11px] font-medium text-[var(--text-muted)]">
                  Pagamentos pendentes
                </div>

                <h1 className="text-2xl font-bold tracking-tight text-[var(--text-app)] md:text-3xl">
                  {barbeariaNome || "Barbearia"}
                </h1>

                <p className="mt-2 text-sm text-[var(--text-muted)] md:text-[15px]">
                  Agendamentos realizados com pagamento ainda não recebido.
                </p>

                {pendentes.length > 0 && (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-sm font-semibold text-amber-700">
                    Total pendente: {formatBRL(totalPendente)}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={onVoltar}
              className="inline-flex items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-4 py-2.5 text-sm font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-panel)]"
            >
              Voltar
            </button>
          </div>
        </header>

        <SectionCard
          title="Pendências"
          subtitle="Clique em Receber para registrar o pagamento e incluir no financeiro."
          actions={
            pendentes.length > 0 ? (
              <Badge tone="amber">{pendentes.length} pendente{pendentes.length !== 1 ? "s" : ""}</Badge>
            ) : null
          }
        >
          {erro && (
            <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
              {erro}
            </div>
          )}

          {loading ? (
            <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-4 py-10 text-center text-sm text-[var(--text-muted)]">
              Carregando pendências...
            </div>
          ) : pendentes.length > 0 ? (
            <div className="space-y-3">
              {pendentes.map((ag) => (
                <div
                  key={ag.id}
                  className="overflow-hidden rounded-[24px] border border-[var(--border-color)] bg-[var(--bg-panel-strong)] shadow-[var(--shadow-soft)]"
                >
                  <div className="flex h-full">
                    <div className="w-1.5 shrink-0 bg-amber-500" />
                    <div className="flex-1 p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone="amber">
                              {fmtBRDate(ag.data)} · {String(ag.hora_inicio || "").slice(0, 5)}
                            </Badge>
                            <Badge tone="emerald">{formatBRL(ag.preco_aplicado)}</Badge>
                          </div>

                          <div className="text-sm text-[var(--text-app)]">
                            <span className="font-semibold">{ag.servico?.nome || "Serviço"}</span>
                          </div>

                          <div className="grid gap-1 text-[12px] text-[var(--text-muted)] sm:grid-cols-2">
                            <div>
                              <span className="font-semibold text-[var(--text-app)]">Cliente:</span>{" "}
                              {ag.cliente?.nome || "—"}
                              {ag.cliente?.whatsapp ? ` · ${ag.cliente.whatsapp}` : ""}
                            </div>
                            <div>
                              <span className="font-semibold text-[var(--text-app)]">Profissional:</span>{" "}
                              {ag.profissional?.nome || "—"}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleReceber(ag)}
                          disabled={recebendoId === ag.id}
                          className="shrink-0 rounded-xl border border-emerald-500/60 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-500/15 disabled:opacity-60"
                        >
                          {recebendoId === ag.id ? "Registrando..." : "Receber pagamento"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-4 py-10 text-center text-sm text-[var(--text-muted)]">
              Nenhum pagamento pendente. ✓
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
