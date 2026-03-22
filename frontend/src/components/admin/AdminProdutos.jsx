// src/components/admin/AdminProdutos.jsx
import { useMemo, useState } from "react";
import { useAdminProdutos } from "../../hooks/useAdminProdutos";
import { Badge } from "../common/Badge";
import { SectionCard } from "../common/SectionCard";

function MoneyInput({ value, onChange }) {
  return (
    <input
      type="number"
      step="0.01"
      min="0"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-sky-500"
    />
  );
}

export function AdminProdutos({
  accessToken,
  adminRole,
  onVoltar,
  barbeariaNome,
  barbeariaLogoUrl,
}) {
  const podeGerir = ["admin_owner", "admin_staff"].includes(adminRole);

  const { produtos, loading, erro, recarregar, criarProduto, atualizarProduto } =
    useAdminProdutos({ accessToken });

  const [form, setForm] = useState({
    nome: "",
    estoque_qtd: "0",
    preco_custo: "0",
    preco_venda: "0",
    ativo: true,
  });

  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");

  const [modalEstoque, setModalEstoque] = useState(null); // { produto, valor }
  const [modalPrecos, setModalPrecos] = useState(null);   // { produto, custo, venda }

  const produtosFiltrados = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    if (!q) return produtos;
    return produtos.filter((p) => String(p.nome || "").toLowerCase().includes(q));
  }, [produtos, search]);

  async function handleCriar(e) {
    e.preventDefault();
    setMsg("");

    if (!podeGerir) {
      setMsg("Seu perfil não tem permissão para gerenciar produtos.");
      return;
    }

    const payload = {
      nome: String(form.nome || "").trim(),
      estoque_qtd: Number(form.estoque_qtd || 0),
      preco_custo: Number(form.preco_custo || 0),
      preco_venda: Number(form.preco_venda || 0),
      ativo: !!form.ativo,
    };

    if (!payload.nome) {
      setMsg("Informe o nome do produto.");
      return;
    }
    if (payload.estoque_qtd < 0) {
      setMsg("Estoque não pode ser negativo.");
      return;
    }

    try {
      setSalvando(true);
      await criarProduto(payload);
      setForm({
        nome: "",
        estoque_qtd: "0",
        preco_custo: "0",
        preco_venda: "0",
        ativo: true,
      });
      setMsg("Produto criado com sucesso.");
      await recarregar();
    } catch (e2) {
      setMsg(e2?.message || "Erro ao criar produto.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleToggleAtivo(p) {
    if (!podeGerir) return;

    try {
      setMsg("");
      await atualizarProduto(p.id, { ativo: !p.ativo });
      await recarregar();
    } catch (e) {
      setMsg(e?.message || "Erro ao atualizar produto.");
    }
  }

  function handleAjustarEstoque(p) {
    if (!podeGerir) return;
    setModalEstoque({ produto: p, valor: String(p.estoque_qtd ?? 0) });
  }

  async function confirmarAjusteEstoque(e) {
    e.preventDefault();
    const n = Number(modalEstoque.valor);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      setMsg("Estoque inválido. Use um inteiro >= 0.");
      return;
    }
    try {
      setMsg("");
      await atualizarProduto(modalEstoque.produto.id, { estoque_qtd: n });
      setModalEstoque(null);
      await recarregar();
    } catch (e2) {
      setMsg(e2?.message || "Erro ao ajustar estoque.");
    }
  }

  function handleEditarPrecos(p) {
    if (!podeGerir) return;
    setModalPrecos({ produto: p, custo: String(p.preco_custo ?? 0), venda: String(p.preco_venda ?? 0) });
  }

  async function confirmarEdicaoPrecos(e) {
    e.preventDefault();
    const pc = Number(modalPrecos.custo);
    const pv = Number(modalPrecos.venda);
    if (!Number.isFinite(pc) || pc < 0 || !Number.isFinite(pv) || pv < 0) {
      setMsg("Preços inválidos. Use números >= 0.");
      return;
    }
    try {
      setMsg("");
      await atualizarProduto(modalPrecos.produto.id, { preco_custo: pc, preco_venda: pv });
      setModalPrecos(null);
      await recarregar();
    } catch (e2) {
      setMsg(e2?.message || "Erro ao editar preços.");
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] px-4 py-8 text-[var(--text-app)] md:py-10">
      <div className="mx-auto w-full max-w-7xl">
        <header className="mb-8 overflow-hidden rounded-[28px] border border-[var(--border-color)] bg-[var(--bg-panel)] shadow-[var(--shadow-panel)] backdrop-blur-xl">
          <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-sky-500 to-violet-500" />
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
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-emerald-500/10 text-3xl">
                  🧴
                </div>
              )}

              <div className="min-w-0">
                <div className="mb-2 inline-flex items-center rounded-full border border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-3 py-1 text-[11px] font-medium text-[var(--text-muted)]">
                  Estoque e catálogo
                </div>

                <h1 className="text-2xl font-bold tracking-tight text-[var(--text-app)] md:text-3xl">
                  {barbeariaNome || "Barbearia"}
                </h1>

                <p className="mt-2 text-sm text-[var(--text-muted)] md:text-[15px]">
                  Cadastre produtos, controle estoque e organize preços de custo e venda.
                </p>

                {!podeGerir && (
                  <p className="mt-2 text-[12px] text-[var(--text-soft)]">
                    Seu perfil pode visualizar, mas não pode alterar produtos.
                  </p>
                )}
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

        {msg ? (
          <div className="mb-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-3 text-sm text-[var(--text-app)]">
            {msg}
          </div>
        ) : null}

        {erro ? (
          <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
            {erro}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.02fr_1.98fr]">
          <SectionCard
            title="Novo produto"
            subtitle="Cadastre um item com estoque inicial, custo, preço de venda e status."
          >
            <form onSubmit={handleCriar} className="space-y-4">
              <div className="flex flex-col">
                <label className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                  Nome
                </label>
                <input
                  value={form.nome}
                  onChange={(e) => setForm((s) => ({ ...s, nome: e.target.value }))}
                  className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-emerald-500"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex flex-col">
                  <label className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                    Estoque
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={form.estoque_qtd}
                    onChange={(e) => setForm((s) => ({ ...s, estoque_qtd: e.target.value }))}
                    className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-emerald-500"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                    Custo (R$)
                  </label>
                  <MoneyInput
                    value={form.preco_custo}
                    onChange={(v) => setForm((s) => ({ ...s, preco_custo: v }))}
                  />
                </div>

                <div className="flex flex-col">
                  <label className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                    Venda (R$)
                  </label>
                  <MoneyInput
                    value={form.preco_venda}
                    onChange={(v) => setForm((s) => ({ ...s, preco_venda: v }))}
                  />
                </div>
              </div>

              <label className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-3 py-2.5 text-sm text-[var(--text-app)]">
                <input
                  type="checkbox"
                  checked={!!form.ativo}
                  onChange={(e) => setForm((s) => ({ ...s, ativo: e.target.checked }))}
                  className="h-4 w-4"
                />
                Produto ativo
              </label>

              <button
                type="submit"
                disabled={!podeGerir || salvando}
                className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {salvando ? "Salvando..." : "Criar produto"}
              </button>
            </form>
          </SectionCard>

          <SectionCard
            title="Lista de produtos"
            subtitle="Pesquise por nome e gerencie estoque, preços e status de cada item."
            actions={
              <>
                <button
                  onClick={recarregar}
                  className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-4 py-2.5 text-sm font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-panel)]"
                >
                  Atualizar
                </button>
              </>
            }
          >
            <div className="mb-4">
              <input
                placeholder="Buscar por nome..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-3 text-sm text-[var(--text-app)] outline-none transition focus:border-emerald-500"
              />
            </div>

            {loading ? (
              <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                Carregando produtos...
              </div>
            ) : produtosFiltrados.length ? (
              <div className="space-y-3">
                {produtosFiltrados.map((p) => (
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
                              <Badge tone="sky">Estoque: {p.estoque_qtd}</Badge>
                              <Badge tone="emerald">
                                Venda: R$ {Number(p.preco_venda || 0).toFixed(2)}
                              </Badge>
                              <Badge tone="slate">
                                Custo: R$ {Number(p.preco_custo || 0).toFixed(2)}
                              </Badge>
                            </div>

                            <h3 className="text-base font-bold text-[var(--text-app)]">
                              {p.nome}
                            </h3>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                            <button
                              onClick={() => handleEditarPrecos(p)}
                              disabled={!podeGerir}
                              className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] px-3 py-2 text-[11px] font-medium text-[var(--text-app)] transition hover:bg-[var(--bg-app)] disabled:opacity-60"
                            >
                              Preços
                            </button>

                            <button
                              onClick={() => handleAjustarEstoque(p)}
                              disabled={!podeGerir}
                              className="rounded-xl border border-sky-500/60 bg-sky-500/10 px-3 py-2 text-[11px] font-medium text-sky-600 transition hover:bg-sky-500/15 disabled:opacity-60"
                            >
                              Estoque
                            </button>

                            <button
                              onClick={() => handleToggleAtivo(p)}
                              disabled={!podeGerir}
                              className="rounded-xl border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-amber-700 transition hover:bg-amber-500/15 disabled:opacity-60"
                            >
                              {p.ativo ? "Desativar" : "Ativar"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {!produtosFiltrados.length ? (
                  <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                    Nenhum produto encontrado.
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                Nenhum produto encontrado.
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {/* Modal: Ajustar Estoque */}
      {modalEstoque && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <form
            onSubmit={confirmarAjusteEstoque}
            className="w-full max-w-sm rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel)] p-6 shadow-xl"
          >
            <h3 className="mb-4 text-base font-bold text-[var(--text-app)]">
              Ajustar estoque — {modalEstoque.produto.nome}
            </h3>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Novo estoque (inteiro ≥ 0)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={modalEstoque.valor}
              onChange={(e) => setModalEstoque((s) => ({ ...s, valor: e.target.value }))}
              className="mb-4 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none focus:border-sky-500"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalEstoque(null)}
                className="rounded-xl border border-[var(--border-color)] px-4 py-2 text-sm text-[var(--text-muted)] transition hover:bg-[var(--bg-panel-strong)]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-600"
              >
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Editar Preços */}
      {modalPrecos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <form
            onSubmit={confirmarEdicaoPrecos}
            className="w-full max-w-sm rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel)] p-6 shadow-xl"
          >
            <h3 className="mb-4 text-base font-bold text-[var(--text-app)]">
              Editar preços — {modalPrecos.produto.nome}
            </h3>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Preço de custo (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={modalPrecos.custo}
              onChange={(e) => setModalPrecos((s) => ({ ...s, custo: e.target.value }))}
              className="mb-3 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none focus:border-sky-500"
              autoFocus
            />
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Preço de venda (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={modalPrecos.venda}
              onChange={(e) => setModalPrecos((s) => ({ ...s, venda: e.target.value }))}
              className="mb-4 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none focus:border-sky-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalPrecos(null)}
                className="rounded-xl border border-[var(--border-color)] px-4 py-2 text-sm text-[var(--text-muted)] transition hover:bg-[var(--bg-panel-strong)]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-600"
              >
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}