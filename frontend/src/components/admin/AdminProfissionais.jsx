// src/components/admin/AdminProfissionais.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { useAdminProfissionais } from "../../hooks/useAdminProfissionais";
import { apiFetch } from "../../config/api";

function formatBRL(v) {
  const n = Number(v ?? 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPct(v) {
  const n = Number(v ?? 0);
  return `${n.toFixed(2)}%`;
}

export function AdminProfissionais({ accessToken, barbeariaId, onVoltar }) {
  const {
    profissionais,
    loadingProfissionais,
    erroProfissionais,
    criarProfissional,
    atualizarProfissional,
  } = useAdminProfissionais({ accessToken, barbeariaId });

  const [editingId, setEditingId] = useState(null);
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [ativo, setAtivo] = useState(true);

  const [comissaoPacotePct, setComissaoPacotePct] = useState("0.00");
  const [comissaoPdvPct, setComissaoPdvPct] = useState("0.00");

  const [mensagem, setMensagem] = useState(null);
  const [erroForm, setErroForm] = useState(null);
  const [loadingSalvar, setLoadingSalvar] = useState(false);

  // painel comissões serviço
  const [selectedProfId, setSelectedProfId] = useState(null);
  const [loadingServ, setLoadingServ] = useState(false);
  const [erroServ, setErroServ] = useState("");
  const [itensServ, setItensServ] = useState([]); // [{servico_id, servico_nome, preco, comissao_pct_vigente}]
  const [draftPct, setDraftPct] = useState({}); // servico_id -> pct string

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

      setMensagem(editingId ? "Profissional atualizado com sucesso." : "Profissional criado com sucesso.");
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
      setErroForm(resp.message || `Não foi possível ${novoStatus ? "ativar" : "desativar"} o profissional.`);
      return;
    }

    setMensagem(novoStatus ? "Profissional ativado com sucesso." : "Profissional desativado com sucesso.");
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
          barbeariaId,
          // ✅ corta 304/ETag e reduz flicker
          cache: "no-store",
        });

        const itens = resp?.itens || [];
        setItensServ(itens);

        // prepara draft
        const draft = {};
        for (const it of itens) {
          draft[it.servico_id] = String(Number(it.comissao_pct_vigente ?? 0).toFixed(2));
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
    [accessToken, barbeariaId]
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
        // vigencia_inicio: "2025-12-01"  // se quiser controlar por data depois, a gente abre isso
      }));

      await apiFetch(`/profissionais/${selectedProfId}/comissoes-servico`, {
        method: "PUT",
        accessToken,
        barbeariaId,
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
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-6xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-50">Profissionais</h1>
            <p className="text-sm text-slate-400 mt-1">
              Somente owner. Aqui você cadastra profissionais e define comissões base.
            </p>
          </div>

          <button
            onClick={onVoltar}
            className="text-xs px-3 py-1 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 transition"
          >
            Voltar ao painel
          </button>
        </header>

        {!barbeariaId ? (
          <div className="bg-slate-800/40 border border-slate-700/60 text-slate-200 text-xs px-3 py-2 rounded-lg mb-4">
            Carregando contexto da barbearia (barbeariaId)…
          </div>
        ) : null}

        {/* ✅ Layout fix: SEM terceira coluna */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* COLUNA ESQUERDA: FORM */}
          <section className="bg-slate-900/40 border border-slate-700/60 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-100 flex items-center gap-2 text-sm">
                <span className="inline-block w-2 h-2 rounded-full bg-sky-400" />
                {editingId ? "Editar profissional" : "Novo profissional"}
              </h2>
              <button
                type="button"
                onClick={handleNovo}
                className="text-[11px] px-3 py-1 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 transition"
              >
                Novo
              </button>
            </div>

            {erroForm && (
              <div className="bg-red-900/40 border border-red-700 text-red-100 text-xs px-3 py-2 rounded-lg mb-3">
                {erroForm}
              </div>
            )}

            {mensagem && (
              <div className="bg-emerald-900/40 border border-emerald-600 text-emerald-100 text-xs px-3 py-2 rounded-lg mb-3">
                {mensagem}
              </div>
            )}

            {profissionalEmEdicao && (
              <p className="text-[11px] text-slate-400 mb-2">
                Editando: <span className="font-medium">{profissionalEmEdicao.nome}</span>
              </p>
            )}

            <form onSubmit={handleSalvar} className="space-y-3 text-xs">
              <div className="flex flex-col">
                <label className="text-[11px] text-slate-400 mb-1">Nome do profissional</label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1 text-slate-100"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-[11px] text-slate-400 mb-1">WhatsApp (opcional)</label>
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1 text-slate-100"
                />
              </div>

              <div className="flex items-center gap-2 mt-1">
                <input
                  id="prof-ativo"
                  type="checkbox"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  className="w-3 h-3"
                />
                <label htmlFor="prof-ativo" className="text-[11px] text-slate-300">
                  Profissional ativo (aparece para o cliente)
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="flex flex-col">
                  <label className="text-[11px] text-slate-400 mb-1">Comissão Pacote (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={comissaoPacotePct}
                    onChange={(e) => setComissaoPacotePct(e.target.value)}
                    className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1 text-slate-100"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-[11px] text-slate-400 mb-1">Comissão PDV (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={comissaoPdvPct}
                    onChange={(e) => setComissaoPdvPct(e.target.value)}
                    className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1 text-slate-100"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loadingSalvar}
                className="mt-3 w-full text-xs px-3 py-2 rounded-lg border border-sky-500 text-sky-100 hover:bg-sky-500/10 disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                {loadingSalvar ? "Salvando..." : editingId ? "Salvar alterações" : "Criar profissional"}
              </button>
            </form>
          </section>

          {/* COLUNA DIREITA: LISTA + PAINEL (ABAIXO) */}
          <section className="flex flex-col gap-6">
            {/* LISTA */}
            <div className="bg-slate-900/40 border border-slate-700/60 rounded-2xl p-4 text-xs">
              {erroProfissionais && (
                <div className="bg-red-900/40 border border-red-700 text-red-100 text-xs px-3 py-2 rounded-lg mb-3">
                  {erroProfissionais}
                </div>
              )}

              {loadingProfissionais ? (
                <p className="text-sm text-slate-400">Carregando profissionais...</p>
              ) : profissionais?.length ? (
                <div className="max-h-[320px] overflow-y-auto pr-1">
                  <table className="w-full text-[11px] border-collapse">
                    <thead className="sticky top-0 bg-slate-900/90 backdrop-blur">
                      <tr className="text-slate-400 border-b border-slate-700/60">
                        <th className="text-left py-2 pr-2 font-medium">Profissional</th>
                        <th className="text-center py-2 px-2 font-medium">Status</th>
                        <th className="text-right py-2 pl-2 font-medium">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profissionais.map((p) => (
                        <tr key={p.id} className="border-b border-slate-800/60 hover:bg-slate-800/40">
                          <td className="py-2 pr-2 align-top text-slate-100">
                            <div className="font-medium">{p.nome}</div>
                            <div className="text-[10px] text-slate-400 mt-1">
                              Pacote: {formatPct(p.comissao_pacote_pct)} · PDV: {formatPct(p.comissao_pdv_pct)}
                            </div>
                          </td>
                          <td className="py-2 px-2 text-center align-top">
                            <span
                              className={
                                "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] " +
                                (p.ativo
                                  ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/40"
                                  : "bg-slate-700/60 text-slate-300 border border-slate-600")
                              }
                            >
                              {p.ativo ? "Ativo" : "Inativo"}
                            </span>
                          </td>
                          <td className="py-2 pl-2 text-right align-top space-x-1">
                            <button
                              type="button"
                              onClick={() => handleEditar(p)}
                              className="inline-flex items-center px-2 py-1 rounded-lg border border-slate-600 text-[11px] text-slate-200 hover:bg-slate-800 transition"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedProfId(p.id)}
                              className={
                                "inline-flex items-center px-2 py-1 rounded-lg border text-[11px] transition " +
                                (selectedProfId === p.id
                                  ? "border-sky-500 text-sky-200 bg-sky-500/10"
                                  : "border-slate-600 text-slate-200 hover:bg-slate-800")
                              }
                            >
                              Comissões serviço
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleAtivo(p)}
                              className={
                                "inline-flex items-center px-2 py-1 rounded-lg border text-[11px] transition " +
                                (p.ativo
                                  ? "border-amber-500 text-amber-300 hover:bg-amber-500/10"
                                  : "border-emerald-500 text-emerald-300 hover:bg-emerald-500/10")
                              }
                            >
                              {p.ativo ? "Desativar" : "Ativar"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-400">Nenhum profissional cadastrado ainda.</p>
              )}
            </div>

            {/* PAINEL DE COMISSÕES POR SERVIÇO (ABAIXO, não lateral) */}
            <div className="bg-slate-900/40 border border-slate-700/60 rounded-2xl p-4 text-xs">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-100 text-sm">Comissões por serviço</h3>
                  <p className="text-[11px] text-slate-400">
                    {profissionalSelecionado ? profissionalSelecionado.nome : "Selecione um profissional na lista."}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => selectedProfId && carregarComissoesServico(selectedProfId)}
                    disabled={!selectedProfId || loadingServ}
                    className="text-[11px] px-3 py-1 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Atualizar
                  </button>
                  <button
                    type="button"
                    onClick={salvarComissoesServico}
                    disabled={!selectedProfId || loadingServ}
                    className="text-[11px] px-3 py-1 rounded-lg border border-sky-500 text-sky-100 hover:bg-sky-500/10 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Salvar
                  </button>
                </div>
              </div>

              {erroServ ? (
                <div className="bg-red-900/40 border border-red-700 text-red-100 text-xs px-3 py-2 rounded-lg mb-3">
                  {erroServ}
                </div>
              ) : null}

              {!selectedProfId ? (
                <div className="text-[11px] text-slate-400">Escolha um profissional para editar as comissões.</div>
              ) : loadingServ ? (
                <div className="text-[11px] text-slate-400">Carregando comissões…</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] border-collapse">
                    <thead className="bg-slate-900/60">
                      <tr className="text-slate-400 border-b border-slate-700/60">
                        <th className="text-left py-2 pr-2 font-medium">Serviço</th>
                        <th className="text-left py-2 px-2 font-medium">Preço</th>
                        <th className="text-left py-2 px-2 font-medium">Comissão (%)</th>
                        <th className="text-right py-2 pl-2 font-medium">Vigente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(itensServ || []).map((it) => (
                        <tr key={it.servico_id} className="border-b border-slate-800/60">
                          <td className="py-2 pr-2 text-slate-100">{it.servico_nome}</td>
                          <td className="py-2 px-2 text-slate-200">{formatBRL(it.preco)}</td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={draftPct[it.servico_id] ?? "0.00"}
                              onChange={(e) =>
                                setDraftPct((prev) => ({ ...prev, [it.servico_id]: e.target.value }))
                              }
                              className="w-28 bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1 text-slate-100"
                            />
                          </td>
                          <td className="py-2 pl-2 text-right">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-slate-800/60 border border-slate-700 text-slate-200">
                              {formatPct(it.comissao_pct_vigente)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <p className="text-[10px] text-slate-400 mt-3">
                    Nota: por enquanto salvamos uma regra “vigente a partir de hoje”. Se você quiser vigência por data,
                    a gente adiciona inputs de vigência e histórico.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

