// src/components/admin/AdminServicos.jsx
import { useState, useMemo } from "react";
import { useAdminServicos } from "../../hooks/useAdminServicos";

export function AdminServicos({ accessToken, barbeariaId, onVoltar }) {
  const {
    servicos,
    loadingServicos,
    erroServicos,
    criarServico,
    atualizarServico,
    desativarServico,
  } = useAdminServicos({ accessToken, barbeariaId });

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
      novoStatus ? "Serviço ativado com sucesso." : "Serviço desativado com sucesso."
    );

    if (editingId === servico.id) setAtivo(novoStatus);
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-5xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-50">Gestão de Serviços</h1>
            <p className="text-sm text-slate-400 mt-1">
              Cadastre, edite e ative/desative os serviços da barbearia.
            </p>
          </div>

          <button
            onClick={onVoltar}
            className="text-xs px-3 py-1 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 transition"
          >
            Voltar
          </button>
        </header>

        <div className="grid gap-6 md:grid-cols-[1.4fr_1.6fr]">
          {/* FORM */}
          <section className="bg-slate-900/40 border border-slate-700/60 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-100 flex items-center gap-2 text-sm">
                <span className="inline-block w-2 h-2 rounded-full bg-sky-400" />
                {editingId ? "Editar serviço" : "Novo serviço"}
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

            {servicoEmEdicao && (
              <p className="text-[11px] text-slate-400 mb-2">
                Editando: <span className="font-medium">{servicoEmEdicao.nome}</span>
              </p>
            )}

            <form onSubmit={handleSalvar} className="space-y-3 text-xs">
              <div className="flex flex-col">
                <label className="text-[11px] text-slate-400 mb-1">Nome do serviço</label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1 text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col">
                  <label className="text-[11px] text-slate-400 mb-1">Duração (minutos)</label>
                  <input
                    type="number"
                    min="1"
                    value={duracaoMinutos}
                    onChange={(e) => setDuracaoMinutos(e.target.value)}
                    className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1 text-slate-100"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-[11px] text-slate-400 mb-1">Preço (R$)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={preco}
                    onChange={(e) => setPreco(e.target.value)}
                    className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1 text-slate-100"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 mt-1">
                <input
                  id="servico-ativo"
                  type="checkbox"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  className="w-3 h-3"
                />
                <label htmlFor="servico-ativo" className="text-[11px] text-slate-300">
                  Serviço ativo (aparece para o cliente)
                </label>
              </div>

              <button
                type="submit"
                disabled={loadingSalvar}
                className="mt-3 w-full text-xs px-3 py-2 rounded-lg border border-sky-500 text-sky-100 hover:bg-sky-500/10 disabled:opacity-60 transition"
              >
                {loadingSalvar ? "Salvando..." : editingId ? "Salvar alterações" : "Criar serviço"}
              </button>
            </form>
          </section>

          {/* LISTA */}
          <section className="bg-slate-900/40 border border-slate-700/60 rounded-2xl p-4 text-xs">
            {erroServicos && (
              <div className="bg-red-900/40 border border-red-700 text-red-100 text-xs px-3 py-2 rounded-lg mb-3">
                {erroServicos}
              </div>
            )}

            {loadingServicos ? (
              <p className="text-sm text-slate-400">Carregando serviços...</p>
            ) : servicos?.length ? (
              <div className="max-h-[420px] overflow-y-auto pr-1">
                <table className="w-full text-[11px] border-collapse">
                  <thead className="sticky top-0 bg-slate-900/90 backdrop-blur">
                    <tr className="text-slate-400 border-b border-slate-700/60">
                      <th className="text-left py-2 pr-2 font-medium">Serviço</th>
                      <th className="text-right py-2 px-2 font-medium">Duração</th>
                      <th className="text-right py-2 px-2 font-medium">Preço</th>
                      <th className="text-center py-2 px-2 font-medium">Status</th>
                      <th className="text-right py-2 pl-2 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {servicos.map((s) => (
                      <tr key={s.id} className="border-b border-slate-800/60 hover:bg-slate-800/40">
                        <td className="py-2 pr-2 text-slate-100">
                          <div className="font-medium">{s.nome}</div>
                        </td>
                        <td className="py-2 px-2 text-right text-slate-200">{s.duracao_minutos} min</td>
                        <td className="py-2 px-2 text-right text-emerald-400 font-semibold">
                          R$ {Number(s.preco || 0).toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span
                            className={
                              "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] " +
                              (s.ativo
                                ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/40"
                                : "bg-slate-700/60 text-slate-300 border border-slate-600")
                            }
                          >
                            {s.ativo ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                        <td className="py-2 pl-2 text-right space-x-1">
                          <button
                            type="button"
                            onClick={() => handleEditar(s)}
                            className="inline-flex items-center px-2 py-1 rounded-lg border border-slate-600 text-[11px] text-slate-200 hover:bg-slate-800 transition"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleAtivo(s)}
                            className={
                              "inline-flex items-center px-2 py-1 rounded-lg border text-[11px] transition " +
                              (s.ativo
                                ? "border-amber-500 text-amber-300 hover:bg-amber-500/10"
                                : "border-emerald-500 text-emerald-300 hover:bg-emerald-500/10")
                            }
                          >
                            {s.ativo ? "Desativar" : "Ativar"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Nenhum serviço cadastrado ainda.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

