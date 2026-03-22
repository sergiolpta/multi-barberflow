// src/components/admin/AdminProfissionais.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { useAdminProfissionais } from "../../hooks/useAdminProfissionais";
import { apiFetch } from "../../config/api";
import { Badge } from "../common/Badge";
import { SectionCard } from "../common/SectionCard";
import { formatBRL } from "../../utils/formatters";

function formatPct(v) {
  const n = Number(v ?? 0);
  return `${n.toFixed(2)}%`;
}

export function AdminProfissionais({
  accessToken,
  onVoltar,
  barbeariaNome,
  barbeariaLogoUrl,
}) {
  const {
    profissionais,
    loadingProfissionais,
    erroProfissionais,
    criarProfissional,
    atualizarProfissional,
  } = useAdminProfissionais({ accessToken });

  const [editingId, setEditingId] = useState(null);
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [ativo, setAtivo] = useState(true);

  const [comissaoPacotePct, setComissaoPacotePct] = useState("0.00");
  const [comissaoPdvPct, setComissaoPdvPct] = useState("0.00");

  const [mensagem, setMensagem] = useState(null);
  const [erroForm, setErroForm] = useState(null);
  const [loadingSalvar, setLoadingSalvar] = useState(false);

  const [selectedProfId, setSelectedProfId] = useState(null);
  const [loadingServ, setLoadingServ] = useState(false);
  const [erroServ, setErroServ] = useState("");
  const [itensServ, setItensServ] = useState([]);
  const [draftPct, setDraftPct] = useState({});

  const profissionalEmEdicao = useMemo(
    () => profissionais.find((p) => p.id === editingId) || null,
    [profissionais, editingId]
  );

  const profissionalSelecionado = useMemo(
    () => profissionais.find((p) => p.id === selectedProfId) || null,
    [profissionais, selectedProfId]
  );

  function resetForm() {
    setEditingId(null);
    setNome("");
    setWhatsapp("");
    setAtivo(true);
    setComissaoPacotePct("0.00");
    setComissaoPdvPct("0.00");
    setErroForm(null);
    setMensagem(null);
  }

  function handleEditar(prof) {
    setEditingId(prof.id);
    setNome(prof.nome || "");
    setWhatsapp(prof.whatsapp || "");
    setAtivo(prof.ativo ?? true);
    setComissaoPacotePct(String(prof.comissao_pacote_pct ?? "0.00"));
    setComissaoPdvPct(String(prof.comissao_pdv_pct ?? "0.00"));
    setErroForm(null);
    setMensagem(null);
  }

  function handleNovo() {
    resetForm();
  }

  async function handleSalvar(e) {
    e.preventDefault();
    setErroForm(null);
    setMensagem(null);

    if (!nome) {
      setErroForm("O nome do profissional é obrigatório.");
      return;
    }

    try {
      setLoadingSalvar(true);

      const payload = {
        nome,
        whatsapp: whatsapp || null,
        ativo,
        comissao_pacote_pct: Number(comissaoPacotePct ?? 0),
        comissao_pdv_pct: Number(comissaoPdvPct ?? 0),
      };

      let resp;
      if (editingId) {
        resp = await atualizarProfissional(editingId, payload);
      } else {
        resp = await criarProfissional(payload);
      }

      if (!resp.ok) {
        setErroForm(resp.message || "Não foi possível salvar o profissional.");
        return;
      }

      setMensagem(
        editingId
          ? "Profissional atualizado com sucesso."
          : "Profissional criado com sucesso."
      );

      if (!editingId) resetForm();
    } catch (err) {
      console.error("Erro inesperado ao salvar profissional:", err);
      setErroForm(err.message || "Erro inesperado ao salvar o profissional.");
    } finally {
      setLoadingSalvar(false);
    }
  }

  async function handleToggleAtivo(prof) {
    setErroForm(null);
    setMensagem(null);

    const novoStatus = !prof.ativo;
    const resp = await atualizarProfissional(prof.id, { ativo: novoStatus });

    if (!resp.ok) {
      setErroForm(
        resp.message ||
          `Não foi possível ${novoStatus ? "ativar" : "desativar"} o profissional.`
      );
      return;
    }

    setMensagem(
      novoStatus
        ? "Profissional ativado com sucesso."
        : "Profissional desativado com sucesso."
    );

    if (editingId === prof.id) setAtivo(novoStatus);
  }

  const carregarComissoesServico = useCallback(
    async (profId) => {
      const id = String(profId || "").trim();
      if (!id) return;

      setLoadingServ(true);
      setErroServ("");

      try {
        const resp = await apiFetch(`/profissionais/${id}/comissoes-servico`, {
          method: "GET",
          accessToken,
          cache: "no-store",
        });

        const itens = resp?.itens || [];
        setItensServ(itens);

        const draft = {};
        for (const it of itens) {
          draft[it.servico_id] = String(
            Number(it.comissao_pct_vigente ?? 0).toFixed(2)
          );
        }
        setDraftPct(draft);
      } catch (e) {
        setErroServ(e?.message || "Erro ao carregar comissões por serviço.");
        setItensServ([]);
        setDraftPct({});
      } finally {
        setLoadingServ(false);
      }
    },
    [accessToken]
  );

  useEffect(() => {
    if (selectedProfId) carregarComissoesServico(selectedProfId);
  }, [selectedProfId, carregarComissoesServico]);

  async function salvarComissoesServico() {
    if (!selectedProfId) return;

    setErroServ("");
    setMensagem(null);
    setLoadingServ(true);

    try {
      const regras = Object.entries(draftPct).map(([servico_id, pct]) => ({
        servico_id,
        comissao_pct: Number(pct ?? 0),
      }));

      await apiFetch(`/profissionais/${selectedProfId}/comissoes-servico`, {
        method: "PUT",
        accessToken,
        cache: "no-store",
        body: JSON.stringify({ regras }),
      });

      setMensagem("Comissões por serviço salvas.");
      await carregarComissoesServico(selectedProfId);
    } catch (e) {
      setErroServ(e?.message || "Erro ao salvar comissões por serviço.");
    } finally {
      setLoadingServ(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] px-4 py-8 text-[var(--text-app)] md:py-10">
      <div className="mx-auto w-full max-w-7xl">
        <header className="mb-8 overflow-hidden rounded-[28px] border border-[var(--border-color)] bg-[var(--bg-panel)] shadow-[var(--shadow-panel)] backdrop-blur-xl">
          <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500" />
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
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-indigo-500/10 text-3xl">
                  👤
                </div>
              )}

              <div className="min-w-0">
                <div className="mb-2 inline-flex items-center rounded-full border border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-3 py-1 text-[11px] font-medium text-[var(--text-muted)]">
                  Equipe e comissionamento
                </div>

                <h1 className="text-2xl font-bold tracking-tight text-[var(--text-app)] md:text-3xl">
                  {barbeariaNome || "Barbearia"}
                </h1>

                <p className="mt-2 text-sm text-[var(--text-muted)] md:text-[15px]">
                  Cadastre profissionais, controle status e defina comissões base e por serviço.
                </p>
              </div>
            </div>

            <button
              onClick={onVoltar}
              className="inline-flex items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-4 py-2.5 text-sm font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-panel)]"
            >
              Voltar ao painel
            </button>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[1.02fr_1.98fr]">
          <SectionCard
            title={editingId ? "Editar profissional" : "Novo profissional"}
            subtitle="Defina os dados básicos e as comissões padrão de pacote e PDV."
            actions={
              <button
                type="button"
                onClick={handleNovo}
                className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-4 py-2.5 text-sm font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-panel)]"
              >
                Novo
              </button>
            }
          >
            {erroForm && (
              <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
                {erroForm}
              </div>
            )}

            {mensagem && (
              <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
                {mensagem}
              </div>
            )}

            {profissionalEmEdicao && (
              <div className="mb-4">
                <Badge tone="sky">Editando: {profissionalEmEdicao.nome}</Badge>
              </div>
            )}

            <form onSubmit={handleSalvar} className="space-y-4">
              <div className="flex flex-col">
                <label className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                  Nome do profissional
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-sky-500"
                />
              </div>

              <div className="flex flex-col">
                <label className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                  WhatsApp (opcional)
                </label>
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-sky-500"
                />
              </div>

              <label className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-3 py-2.5 text-sm text-[var(--text-app)]">
                <input
                  id="prof-ativo"
                  type="checkbox"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  className="h-4 w-4"
                />
                Profissional ativo (aparece para o cliente)
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col">
                  <label className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                    Comissão Pacote (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={comissaoPacotePct}
                    onChange={(e) => setComissaoPacotePct(e.target.value)}
                    className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-sky-500"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                    Comissão PDV (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={comissaoPdvPct}
                    onChange={(e) => setComissaoPdvPct(e.target.value)}
                    className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-sky-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loadingSalvar}
                className="w-full rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-95 disabled:opacity-60"
              >
                {loadingSalvar
                  ? "Salvando..."
                  : editingId
                  ? "Salvar alterações"
                  : "Criar profissional"}
              </button>
            </form>
          </SectionCard>

          <div className="flex flex-col gap-6">
            <SectionCard
              title="Profissionais cadastrados"
              subtitle="Gerencie status, edite dados base e acesse comissões por serviço."
              actions={profissionais?.length ? <Badge tone="slate">{profissionais.length} profissionais</Badge> : null}
            >
              {erroProfissionais && (
                <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
                  {erroProfissionais}
                </div>
              )}

              {loadingProfissionais ? (
                <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                  Carregando profissionais...
                </div>
              ) : profissionais?.length ? (
                <div className="space-y-3">
                  {profissionais.map((p) => (
                    <div
                      key={p.id}
                      className="overflow-hidden rounded-[24px] border border-[var(--border-color)] bg-[var(--bg-panel-strong)] shadow-[var(--shadow-soft)]"
                    >
                      <div className="flex h-full">
                        <div className={`w-1.5 shrink-0 ${p.ativo ? "bg-emerald-500" : "bg-slate-400"}`} />
                        <div className="flex-1 p-4">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <Badge tone={p.ativo ? "emerald" : "slate"}>
                                  {p.ativo ? "Ativo" : "Inativo"}
                                </Badge>
                                <Badge tone="amber">
                                  Pacote: {formatPct(p.comissao_pacote_pct)}
                                </Badge>
                                <Badge tone="sky">
                                  PDV: {formatPct(p.comissao_pdv_pct)}
                                </Badge>
                              </div>

                              <h3 className="text-base font-bold text-[var(--text-app)]">
                                {p.nome}
                              </h3>

                              {p.whatsapp ? (
                                <div className="mt-2 text-[12px] text-[var(--text-muted)]">
                                  WhatsApp: {p.whatsapp}
                                </div>
                              ) : (
                                <div className="mt-2 text-[12px] text-[var(--text-soft)]">
                                  Sem WhatsApp informado
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                              <button
                                type="button"
                                onClick={() => handleEditar(p)}
                                className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] px-3 py-2 text-[11px] font-medium text-[var(--text-app)] transition hover:bg-[var(--bg-app)]"
                              >
                                Editar
                              </button>

                              <button
                                type="button"
                                onClick={() => setSelectedProfId(p.id)}
                                className={[
                                  "rounded-xl border px-3 py-2 text-[11px] font-medium transition",
                                  selectedProfId === p.id
                                    ? "border-sky-500/60 bg-sky-500/10 text-sky-600"
                                    : "border-[var(--border-color)] bg-[var(--bg-panel)] text-[var(--text-muted)] hover:bg-[var(--bg-app)]",
                                ].join(" ")}
                              >
                                Comissões serviço
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleAtivo(p)}
                                className={[
                                  "rounded-xl border px-3 py-2 text-[11px] font-medium transition",
                                  p.ativo
                                    ? "border-amber-500/60 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15"
                                    : "border-emerald-500/60 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15",
                                ].join(" ")}
                              >
                                {p.ativo ? "Desativar" : "Ativar"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                  Nenhum profissional cadastrado ainda.
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Comissões por serviço"
              subtitle={
                profissionalSelecionado
                  ? `Editando regras individuais de ${profissionalSelecionado.nome}.`
                  : "Selecione um profissional na lista para editar as regras."
              }
              actions={
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => selectedProfId && carregarComissoesServico(selectedProfId)}
                    disabled={!selectedProfId || loadingServ}
                    className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-4 py-2.5 text-sm font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-panel)] disabled:opacity-60"
                  >
                    Atualizar
                  </button>
                  <button
                    type="button"
                    onClick={salvarComissoesServico}
                    disabled={!selectedProfId || loadingServ}
                    className="rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:opacity-95 disabled:opacity-60"
                  >
                    Salvar
                  </button>
                </div>
              }
            >
              {erroServ ? (
                <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
                  {erroServ}
                </div>
              ) : null}

              {!selectedProfId ? (
                <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                  Escolha um profissional para editar as comissões.
                </div>
              ) : loadingServ ? (
                <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                  Carregando comissões…
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)]">
                  <table className="w-full border-collapse text-[12px]">
                    <thead>
                      <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)]">
                        <th className="px-4 py-3 text-left font-medium">Serviço</th>
                        <th className="px-3 py-3 text-left font-medium">Preço</th>
                        <th className="px-3 py-3 text-left font-medium">Comissão (%)</th>
                        <th className="px-4 py-3 text-right font-medium">Vigente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(itensServ || []).map((it) => (
                        <tr key={it.servico_id} className="border-b border-[var(--border-color)] last:border-b-0">
                          <td className="px-4 py-3 text-[var(--text-app)]">{it.servico_nome}</td>
                          <td className="px-3 py-3 text-[var(--text-muted)]">{formatBRL(it.preco)}</td>
                          <td className="px-3 py-3">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={draftPct[it.servico_id] ?? "0.00"}
                              onChange={(e) =>
                                setDraftPct((prev) => ({
                                  ...prev,
                                  [it.servico_id]: e.target.value,
                                }))
                              }
                              className="w-28 rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-app)] outline-none transition focus:border-sky-500"
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Badge tone="slate">{formatPct(it.comissao_pct_vigente)}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="border-t border-[var(--border-color)] px-4 py-3 text-[11px] text-[var(--text-muted)]">
                    Hoje a regra é salva como vigente a partir de agora. Se quiser histórico com vigência por data, o próximo passo é modelar isso.
                  </div>
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}