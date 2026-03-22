// src/components/admin/AdminServicos.jsx
import { useState, useMemo } from "react";
import { useAdminServicos } from "../../hooks/useAdminServicos";
import { Badge } from "../common/Badge";
import { SectionCard } from "../common/SectionCard";

export function AdminServicos({
  accessToken,
  onVoltar,
  barbeariaNome,
  barbeariaLogoUrl,
}) {
  const {
    servicos,
    loadingServicos,
    erroServicos,
    criarServico,
    atualizarServico,
    desativarServico,
  } = useAdminServicos({ accessToken });

  const [editingId, setEditingId] = useState(null);
  const [nome, setNome] = useState("");
  const [duracaoMinutos, setDuracaoMinutos] = useState("");
  const [preco, setPreco] = useState("");
  const [ativo, setAtivo] = useState(true);

  const [mensagem, setMensagem] = useState(null);
  const [erroForm, setErroForm] = useState(null);
  const [loadingSalvar, setLoadingSalvar] = useState(false);

  const servicoEmEdicao = useMemo(
    () => servicos.find((s) => s.id === editingId) || null,
    [servicos, editingId]
  );

  function resetForm() {
    setEditingId(null);
    setNome("");
    setDuracaoMinutos("");
    setPreco("");
    setAtivo(true);
    setErroForm(null);
    setMensagem(null);
  }

  function handleEditar(servico) {
    setEditingId(servico.id);
    setNome(servico.nome || "");
    setDuracaoMinutos(String(servico.duracao_minutos || ""));
    setPreco(String(servico.preco || ""));
    setAtivo(servico.ativo ?? true);
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

    if (!nome || !duracaoMinutos || preco === "") {
      setErroForm("Preencha nome, duração e preço.");
      return;
    }

    const duracaoNum = Number(duracaoMinutos);
    const precoNum = Number(preco);

    if (!Number.isFinite(duracaoNum) || duracaoNum <= 0) {
      setErroForm("Duração deve ser um número maior que zero.");
      return;
    }

    if (!Number.isFinite(precoNum) || precoNum < 0) {
      setErroForm("Preço deve ser um número maior ou igual a zero.");
      return;
    }

    try {
      setLoadingSalvar(true);

      let resp;
      if (editingId) {
        resp = await atualizarServico(editingId, {
          nome,
          duracao_minutos: duracaoNum,
          preco: precoNum,
          ativo,
        });
      } else {
        resp = await criarServico({
          nome,
          duracao_minutos: duracaoNum,
          preco: precoNum,
          ativo,
        });
      }

      if (!resp.ok) {
        setErroForm(resp.message || "Não foi possível salvar o serviço.");
        return;
      }

      setMensagem(
        editingId
          ? "Serviço atualizado com sucesso."
          : "Serviço criado com sucesso."
      );

      if (!editingId) resetForm();
    } catch (err) {
      console.error("Erro inesperado ao salvar serviço:", err);
      setErroForm(err.message || "Erro inesperado ao salvar o serviço.");
    } finally {
      setLoadingSalvar(false);
    }
  }

  async function handleToggleAtivo(servico) {
    setErroForm(null);
    setMensagem(null);

    const novoStatus = !servico.ativo;
    const resp = await atualizarServico(servico.id, { ativo: novoStatus });

    if (!resp.ok) {
      setErroForm(
        resp.message ||
          `Não foi possível ${novoStatus ? "ativar" : "desativar"} o serviço.`
      );
      return;
    }

    setMensagem(
      novoStatus
        ? "Serviço ativado com sucesso."
        : "Serviço desativado com sucesso."
    );

    if (editingId === servico.id) setAtivo(novoStatus);
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] px-4 py-8 text-[var(--text-app)] md:py-10">
      <div className="mx-auto w-full max-w-7xl">
        <header className="mb-8 overflow-hidden rounded-[28px] border border-[var(--border-color)] bg-[var(--bg-panel)] shadow-[var(--shadow-panel)] backdrop-blur-xl">
          <div className="h-1 w-full bg-gradient-to-r from-sky-500 via-cyan-500 to-emerald-500" />
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
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-sky-500/10 text-3xl">
                  ✂️
                </div>
              )}

              <div className="min-w-0">
                <div className="mb-2 inline-flex items-center rounded-full border border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-3 py-1 text-[11px] font-medium text-[var(--text-muted)]">
                  Catálogo de serviços
                </div>

                <h1 className="text-2xl font-bold tracking-tight text-[var(--text-app)] md:text-3xl">
                  {barbeariaNome || "Barbearia"}
                </h1>

                <p className="mt-2 text-sm text-[var(--text-muted)] md:text-[15px]">
                  Cadastre, organize e ative ou desative os serviços oferecidos pela barbearia.
                </p>
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

        <div className="grid gap-6 xl:grid-cols-[1.05fr_1.95fr]">
          <SectionCard
            title={editingId ? "Editar serviço" : "Novo serviço"}
            subtitle="Defina nome, duração, preço e disponibilidade para o catálogo."
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

            {servicoEmEdicao && (
              <div className="mb-4">
                <Badge tone="sky">Editando: {servicoEmEdicao.nome}</Badge>
              </div>
            )}

            <form onSubmit={handleSalvar} className="space-y-4">
              <div className="flex flex-col">
                <label className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                  Nome do serviço
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-sky-500"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col">
                  <label className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                    Duração (minutos)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={duracaoMinutos}
                    onChange={(e) => setDuracaoMinutos(e.target.value)}
                    className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-sky-500"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                    Preço (R$)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={preco}
                    onChange={(e) => setPreco(e.target.value)}
                    className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-sky-500"
                  />
                </div>
              </div>

              <label className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-3 py-2.5 text-sm text-[var(--text-app)]">
                <input
                  id="servico-ativo"
                  type="checkbox"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  className="h-4 w-4"
                />
                Serviço ativo (aparece para o cliente)
              </label>

              <button
                type="submit"
                disabled={loadingSalvar}
                className="w-full rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-95 disabled:opacity-60"
              >
                {loadingSalvar
                  ? "Salvando..."
                  : editingId
                  ? "Salvar alterações"
                  : "Criar serviço"}
              </button>
            </form>
          </SectionCard>

          <SectionCard
            title="Serviços cadastrados"
            subtitle="Visualize duração, preço e status de cada item do catálogo."
            actions={servicos?.length ? <Badge tone="slate">{servicos.length} serviços</Badge> : null}
          >
            {erroServicos && (
              <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
                {erroServicos}
              </div>
            )}

            {loadingServicos ? (
              <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                Carregando serviços...
              </div>
            ) : servicos?.length ? (
              <div className="space-y-3">
                {servicos.map((s) => (
                  <div
                    key={s.id}
                    className="overflow-hidden rounded-[24px] border border-[var(--border-color)] bg-[var(--bg-panel-strong)] shadow-[var(--shadow-soft)]"
                  >
                    <div className="flex h-full">
                      <div className={`w-1.5 shrink-0 ${s.ativo ? "bg-emerald-500" : "bg-slate-400"}`} />
                      <div className="flex-1 p-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <Badge tone={s.ativo ? "emerald" : "slate"}>
                                {s.ativo ? "Ativo" : "Inativo"}
                              </Badge>
                              <Badge tone="sky">{s.duracao_minutos} min</Badge>
                              <Badge tone="emerald">
                                R$ {Number(s.preco || 0).toFixed(2)}
                              </Badge>
                            </div>

                            <h3 className="text-base font-bold text-[var(--text-app)]">
                              {s.nome}
                            </h3>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                            <button
                              type="button"
                              onClick={() => handleEditar(s)}
                              className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] px-3 py-2 text-[11px] font-medium text-[var(--text-app)] transition hover:bg-[var(--bg-app)]"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleAtivo(s)}
                              className={[
                                "rounded-xl border px-3 py-2 text-[11px] font-medium transition",
                                s.ativo
                                  ? "border-amber-500/60 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15"
                                  : "border-emerald-500/60 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15",
                              ].join(" ")}
                            >
                              {s.ativo ? "Desativar" : "Ativar"}
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
                Nenhum serviço cadastrado ainda.
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}