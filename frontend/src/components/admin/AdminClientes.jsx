// src/components/admin/AdminClientes.jsx
import { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../../config/api";
import { Badge } from "../common/Badge";
import { SectionCard } from "../common/SectionCard";
import { fmtBRDate } from "../../utils/formatters";

export function AdminClientes({
  accessToken,
  onVoltar,
  barbeariaNome,
  barbeariaLogoUrl,
}) {
  const [clientes, setClientes] = useState([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [erroClientes, setErroClientes] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [documento, setDocumento] = useState("");
  const [nascimento, setNascimento] = useState("");

  const [mensagem, setMensagem] = useState(null);
  const [erroForm, setErroForm] = useState(null);
  const [loadingSalvar, setLoadingSalvar] = useState(false);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    carregarClientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function carregarClientes() {
    setLoadingClientes(true);
    setErroClientes(null);
    try {
      const data = await apiFetch("/clientes", { accessToken });
      setClientes(Array.isArray(data) ? data : []);
    } catch (err) {
      setErroClientes(err.message || "Erro ao carregar clientes.");
    } finally {
      setLoadingClientes(false);
    }
  }

  const clientesFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        (c.whatsapp || "").includes(q.replace(/\D/g, ""))
    );
  }, [clientes, busca]);

  const clienteEmEdicao = useMemo(
    () => clientes.find((c) => c.id === editingId) || null,
    [clientes, editingId]
  );

  function resetForm() {
    setEditingId(null);
    setNome("");
    setWhatsapp("");
    setDocumento("");
    setNascimento("");
    setErroForm(null);
    setMensagem(null);
  }

  function handleEditar(cliente) {
    setEditingId(cliente.id);
    setNome(cliente.nome || "");
    setWhatsapp(cliente.whatsapp || "");
    setDocumento(cliente.documento || "");
    setNascimento(cliente.nascimento || "");
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

    if (!nome.trim()) {
      setErroForm("Nome é obrigatório.");
      return;
    }
    if (!whatsapp.trim()) {
      setErroForm("WhatsApp é obrigatório.");
      return;
    }

    const payload = {
      nome: nome.trim(),
      whatsapp: whatsapp.trim(),
      documento: documento.trim() || null,
      nascimento: nascimento || null,
    };

    try {
      setLoadingSalvar(true);

      if (editingId) {
        const data = await apiFetch(`/clientes/${editingId}`, {
          accessToken,
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setClientes((prev) => prev.map((c) => (c.id === editingId ? data : c)));
        setMensagem("Cliente atualizado com sucesso.");
      } else {
        const data = await apiFetch("/clientes", {
          accessToken,
          method: "POST",
          body: JSON.stringify(payload),
        });
        setClientes((prev) => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)));
        setMensagem("Cliente cadastrado com sucesso.");
        resetForm();
      }
    } catch (err) {
      setErroForm(err.message || "Erro ao salvar cliente.");
    } finally {
      setLoadingSalvar(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] px-4 py-8 text-[var(--text-app)] md:py-10">
      <div className="mx-auto w-full max-w-7xl">
        <header className="mb-8 overflow-hidden rounded-[28px] border border-[var(--border-color)] bg-[var(--bg-panel)] shadow-[var(--shadow-panel)] backdrop-blur-xl">
          <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-sky-500 to-emerald-500" />
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
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-violet-500/10 text-3xl">
                  👤
                </div>
              )}

              <div className="min-w-0">
                <div className="mb-2 inline-flex items-center rounded-full border border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-3 py-1 text-[11px] font-medium text-[var(--text-muted)]">
                  Cadastro de clientes
                </div>

                <h1 className="text-2xl font-bold tracking-tight text-[var(--text-app)] md:text-3xl">
                  {barbeariaNome || "Barbearia"}
                </h1>

                <p className="mt-2 text-sm text-[var(--text-muted)] md:text-[15px]">
                  Cadastre e gerencie os clientes da barbearia.
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
            title={editingId ? "Editar cliente" : "Novo cliente"}
            subtitle="Preencha os dados do cliente para cadastro."
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

            {clienteEmEdicao && (
              <div className="mb-4">
                <Badge tone="sky">Editando: {clienteEmEdicao.nome}</Badge>
              </div>
            )}

            <form onSubmit={handleSalvar} className="space-y-4">
              <div className="flex flex-col">
                <label className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                  Nome <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome completo"
                  className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-violet-500"
                />
              </div>

              <div className="flex flex-col">
                <label className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                  WhatsApp <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="Ex: 14999990000"
                  className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-violet-500"
                />
              </div>

              <div className="flex flex-col">
                <label className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                  Documento (CPF/RG)
                </label>
                <input
                  type="text"
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value)}
                  placeholder="Opcional"
                  className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-violet-500"
                />
              </div>

              <div className="flex flex-col">
                <label className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                  Data de nascimento
                </label>
                <input
                  type="date"
                  value={nascimento}
                  onChange={(e) => setNascimento(e.target.value)}
                  className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-violet-500"
                />
              </div>

              <button
                type="submit"
                disabled={loadingSalvar}
                className="w-full rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-95 disabled:opacity-60"
              >
                {loadingSalvar
                  ? "Salvando..."
                  : editingId
                  ? "Salvar alterações"
                  : "Cadastrar cliente"}
              </button>
            </form>
          </SectionCard>

          <SectionCard
            title="Clientes cadastrados"
            subtitle="Lista de clientes da barbearia."
            actions={
              clientesFiltrados.length > 0 ? (
                <Badge tone="slate">{clientesFiltrados.length} cliente{clientesFiltrados.length !== 1 ? "s" : ""}</Badge>
              ) : null
            }
          >
            <div className="mb-4">
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome ou WhatsApp..."
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-violet-500"
              />
            </div>

            {erroClientes && (
              <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
                {erroClientes}
              </div>
            )}

            {loadingClientes ? (
              <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                Carregando clientes...
              </div>
            ) : clientesFiltrados.length > 0 ? (
              <div className="space-y-3">
                {clientesFiltrados.map((c) => (
                  <div
                    key={c.id}
                    className="overflow-hidden rounded-[24px] border border-[var(--border-color)] bg-[var(--bg-panel-strong)] shadow-[var(--shadow-soft)]"
                  >
                    <div className="flex h-full">
                      <div className="w-1.5 shrink-0 bg-violet-500" />
                      <div className="flex-1 p-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <h3 className="mb-1.5 text-base font-bold text-[var(--text-app)]">
                              {c.nome}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge tone="sky">{c.whatsapp}</Badge>
                              {c.nascimento && (
                                <Badge tone="amber">{fmtBRDate(c.nascimento)}</Badge>
                              )}
                              {c.documento && (
                                <Badge tone="slate">{c.documento}</Badge>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 lg:justify-end">
                            <button
                              type="button"
                              onClick={() => handleEditar(c)}
                              className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] px-3 py-2 text-[11px] font-medium text-[var(--text-app)] transition hover:bg-[var(--bg-app)]"
                            >
                              Editar
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
                {busca ? "Nenhum cliente encontrado para esta busca." : "Nenhum cliente cadastrado ainda."}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
