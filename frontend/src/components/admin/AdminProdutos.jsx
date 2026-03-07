// src/components/admin/AdminProdutos.jsx
import { useMemo, useState } from "react";
import { useAdminProdutos } from "../../hooks/useAdminProdutos";

function MoneyInput({ value, onChange }) {
  return (
    <input
      type="number"
      step="0.01"
      min="0"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1 text-slate-100"
    />
  );
}

export function AdminProdutos({ accessToken, barbeariaId, adminRole, onVoltar }) {
  const podeGerir = ["admin_owner", "admin_staff"].includes(adminRole);

  const { produtos, loading, erro, recarregar, criarProduto, atualizarProduto } =
    useAdminProdutos({ accessToken, barbeariaId });

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
      setForm({ nome: "", estoque_qtd: "0", preco_custo: "0", preco_venda: "0", ativo: true });
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

  async function handleAjustarEstoque(p) {
    if (!podeGerir) return;

    const novo = window.prompt(
      `Ajustar estoque de "${p.nome}". Informe o novo estoque (inteiro >= 0):`,
      String(p.estoque_qtd ?? 0)
    );
    if (novo == null) return;

    const n = Number(novo);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      alert("Estoque inválido. Use um inteiro >= 0.");
      return;
    }

    try {
      setMsg("");
      await atualizarProduto(p.id, { estoque_qtd: n });
      await recarregar();
    } catch (e) {
      setMsg(e?.message || "Erro ao ajustar estoque.");
    }
  }

  async function handleEditarPrecos(p) {
    if (!podeGerir) return;

    const custo = window.prompt(`Preço de custo (R$) de "${p.nome}":`, String(p.preco_custo ?? 0));
    if (custo == null) return;
    const venda = window.prompt(`Preço de venda (R$) de "${p.nome}":`, String(p.preco_venda ?? 0));
    if (venda == null) return;

    const pc = Number(custo);
    const pv = Number(venda);
    if (!Number.isFinite(pc) || pc < 0 || !Number.isFinite(pv) || pv < 0) {
      alert("Preços inválidos. Use números >= 0.");
      return;
    }

    try {
      setMsg("");
      await atualizarProduto(p.id, { preco_custo: pc, preco_venda: pv });
      await recarregar();
    } catch (e) {
      setMsg(e?.message || "Erro ao editar preços.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 px-4 py-6">
      <div className="w-full max-w-5xl mx-auto space-y-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-50">Produtos</h1>
            <p className="text-sm text-slate-400 mt-1">
              Cadastro e controle básico de estoque (sem negativo).
            </p>
            {!podeGerir && (
              <p className="text-[11px] text-slate-500 mt-2">
                Seu perfil pode visualizar, mas não pode alterar produtos.
              </p>
            )}
          </div>

          <button
            onClick={onVoltar}
            className="text-xs px-3 py-1 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 transition"
          >
            Voltar ao painel
          </button>
        </header>

        {msg ? (
          <div className="rounded-xl border border-slate-700 bg-slate-800/40 px-4 py-3 text-xs text-slate-200">
            {msg}
          </div>
        ) : null}

        {erro ? (
          <div className="rounded-xl border border-red-700 bg-red-900/30 px-4 py-3 text-xs text-red-100">
            {erro}
          </div>
        ) : null}

        <div className="grid md:grid-cols-2 gap-4">
          <section className="rounded-2xl border border-slate-700 bg-slate-800/30 p-4">
            <h2 className="font-semibold text-slate-50">Novo produto</h2>

            <form onSubmit={handleCriar} className="mt-3 grid gap-2 text-xs">
              <div className="flex flex-col">
                <span className="text-[11px] text-slate-400 mb-1">Nome</span>
                <input
                  value={form.nome}
                  onChange={(e) => setForm((s) => ({ ...s, nome: e.target.value }))}
                  className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1 text-slate-100"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col">
                  <span className="text-[11px] text-slate-400 mb-1">Estoque</span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={form.estoque_qtd}
                    onChange={(e) => setForm((s) => ({ ...s, estoque_qtd: e.target.value }))}
                    className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1 text-slate-100"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] text-slate-400 mb-1">Custo (R$)</span>
                  <MoneyInput
                    value={form.preco_custo}
                    onChange={(v) => setForm((s) => ({ ...s, preco_custo: v }))}
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] text-slate-400 mb-1">Venda (R$)</span>
                  <MoneyInput
                    value={form.preco_venda}
                    onChange={(v) => setForm((s) => ({ ...s, preco_venda: v }))}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 mt-1 text-[11px] text-slate-300">
                <input
                  type="checkbox"
                  checked={!!form.ativo}
                  onChange={(e) => setForm((s) => ({ ...s, ativo: e.target.checked }))}
                />
                Produto ativo
              </label>

              <button
                type="submit"
                disabled={!podeGerir || salvando}
                className="mt-2 w-full text-xs px-3 py-2 rounded-lg border border-emerald-500 text-emerald-100 hover:bg-emerald-500/10 disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                {salvando ? "Salvando..." : "Criar produto"}
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-700 bg-slate-800/30 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-slate-50">Lista</h2>
              <button
                onClick={recarregar}
                className="text-xs px-3 py-1 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 transition"
              >
                Atualizar
              </button>
            </div>

            <div className="mt-3">
              <input
                placeholder="Buscar por nome..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
              />
            </div>

            {loading ? (
              <p className="text-sm text-slate-400 mt-3">Carregando...</p>
            ) : (
              <ul className="mt-3 space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {produtosFiltrados.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-xl border border-slate-700 bg-slate-900/40 px-3 py-2 text-xs flex items-start justify-between gap-2"
                  >
                    <div>
                      <div className="font-semibold text-slate-100">{p.nome}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Estoque: <span className="text-slate-200">{p.estoque_qtd}</span> •
                        Venda: <span className="text-emerald-300">R$ {Number(p.preco_venda || 0).toFixed(2)}</span> •
                        Custo: <span className="text-slate-300">R$ {Number(p.preco_custo || 0).toFixed(2)}</span>
                      </div>
                      <div className="mt-1">
                        {p.ativo ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-900/30 text-emerald-100 border border-emerald-700">
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-200 border border-slate-600">
                            Inativo
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <button
                        onClick={() => handleEditarPrecos(p)}
                        disabled={!podeGerir}
                        className="px-2 py-1 rounded-lg border border-slate-600 text-slate-200 text-[10px] hover:bg-slate-800 transition disabled:opacity-60"
                      >
                        Preços
                      </button>
                      <button
                        onClick={() => handleAjustarEstoque(p)}
                        disabled={!podeGerir}
                        className="px-2 py-1 rounded-lg border border-slate-600 text-slate-200 text-[10px] hover:bg-slate-800 transition disabled:opacity-60"
                      >
                        Estoque
                      </button>
                      <button
                        onClick={() => handleToggleAtivo(p)}
                        disabled={!podeGerir}
                        className="px-2 py-1 rounded-lg border border-slate-600 text-slate-200 text-[10px] hover:bg-slate-800 transition disabled:opacity-60"
                      >
                        {p.ativo ? "Desativar" : "Ativar"}
                      </button>
                    </div>
                  </li>
                ))}

                {!produtosFiltrados.length ? (
                  <li className="text-sm text-slate-400">Nenhum produto encontrado.</li>
                ) : null}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

