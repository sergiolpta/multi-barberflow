// src/components/admin/AdminVendas.jsx
import { useMemo, useState } from "react";
import { useAdminProdutos } from "../../hooks/useAdminProdutos";
import { useAdminVendas } from "../../hooks/useAdminVendas";
import { useAdminProfissionais } from "../../hooks/useAdminProfissionais";

export function AdminVendas({
  accessToken,
  adminRole,
  onVoltar,
  barbeariaNome,
  barbeariaLogoUrl,
}) {
  const podeVender = ["admin_owner", "admin_staff"].includes(adminRole);

  const {
    produtos,
    loading: loadingProd,
    erro: erroProd,
    recarregar: recarregarProdutos,
  } = useAdminProdutos({ accessToken });

  const {
    vendas,
    loading: loadingVendas,
    erro: erroVendas,
    recarregar,
    registrarVenda,
  } = useAdminVendas({ accessToken });

  const {
    profissionais,
    loading: loadingProf,
    erro: erroProf,
    recarregar: recarregarProfissionais,
  } = useAdminProfissionais({ accessToken });

  const ativos = useMemo(() => (produtos || []).filter((p) => p.ativo), [produtos]);

  const profAtivos = useMemo(
    () => (profissionais || []).filter((p) => p.ativo),
    [profissionais]
  );

  const [profissionalId, setProfissionalId] = useState("");
  const [produtoId, setProdutoId] = useState("");
  const [qtd, setQtd] = useState(1);
  const [itens, setItens] = useState([]);
  const [msg, setMsg] = useState("");
  const [salvando, setSalvando] = useState(false);

  const produtoSelecionado = useMemo(
    () => ativos.find((p) => p.id === produtoId),
    [ativos, produtoId]
  );

  function addItem() {
    setMsg("");

    if (!podeVender) {
      setMsg("Seu perfil não tem permissão para registrar vendas.");
      return;
    }

    if (!produtoSelecionado) {
      setMsg("Selecione um produto.");
      return;
    }

    const n = Number(qtd);

    if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
      setMsg("Quantidade inválida (use inteiro > 0).");
      return;
    }

    if (Number(produtoSelecionado.estoque_qtd) < n) {
      setMsg(`Estoque insuficiente. Disponível: ${produtoSelecionado.estoque_qtd}`);
      return;
    }

    setItens((prev) => {
      const idx = prev.findIndex((i) => i.produto_id === produtoSelecionado.id);

      if (idx >= 0) {
        const novo = [...prev];
        const novaQtd = novo[idx].quantidade + n;

        if (Number(produtoSelecionado.estoque_qtd) < novaQtd) {
          setMsg(`Estoque insuficiente para somar. Disponível: ${produtoSelecionado.estoque_qtd}`);
          return prev;
        }

        novo[idx] = { ...novo[idx], quantidade: novaQtd };
        return novo;
      }

      return [
        ...prev,
        {
          produto_id: produtoSelecionado.id,
          nome: produtoSelecionado.nome,
          quantidade: n,
        },
      ];
    });
  }

  function removerItem(produto_id) {
    setItens((prev) => prev.filter((i) => i.produto_id !== produto_id));
  }

  async function finalizarVenda() {
    setMsg("");

    if (!podeVender) {
      setMsg("Seu perfil não tem permissão para registrar vendas.");
      return;
    }

    if (!profissionalId) {
      setMsg("Selecione o profissional comissionado (obrigatório).");
      return;
    }

    if (!itens.length) {
      setMsg("Adicione ao menos 1 item.");
      return;
    }

    try {
      setSalvando(true);

      await registrarVenda({
        profissional_id: profissionalId,
        itens: itens.map((i) => ({
          produto_id: i.produto_id,
          quantidade: i.quantidade,
        })),
      });

      setItens([]);
      setProdutoId("");
      setQtd(1);
      setMsg("Venda registrada e estoque atualizado.");

      await Promise.all([recarregar(), recarregarProdutos()]);
    } catch (e) {
      setMsg(e?.message || "Erro ao registrar venda.");
    } finally {
      setSalvando(false);
    }
  }

  const erroGeral = erroProd || erroVendas || erroProf;
  const loadingGeral = loadingProd || loadingVendas || loadingProf;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 px-4 py-6">
      <div className="w-full max-w-5xl mx-auto space-y-6">
        <header className="rounded-2xl border border-slate-700 bg-slate-800/30 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {barbeariaLogoUrl ? (
                <img
                  src={barbeariaLogoUrl}
                  alt={barbeariaNome || "Logo da barbearia"}
                  className="w-14 h-14 rounded-xl object-cover border border-slate-700 bg-slate-900/60"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl border border-slate-700 bg-slate-900/60 flex items-center justify-center text-slate-500 text-[10px] text-center px-1">
                  Sem logo
                </div>
              )}

              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  Painel administrativo
                </p>
                <h1 className="text-xl md:text-2xl font-bold text-slate-50 truncate">
                  {barbeariaNome || "Barbearia"}
                </h1>
                <p className="text-sm text-slate-400 mt-1">Vendas (Balcão)</p>
                <p className="text-xs text-slate-500 mt-1">
                  Registre venda rápida, dê baixa no estoque e grave comissão por profissional.
                </p>

                {!podeVender && (
                  <p className="text-[11px] text-slate-500 mt-2">
                    Seu perfil pode visualizar, mas não pode registrar vendas.
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={onVoltar}
              className="shrink-0 text-xs px-3 py-1 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 transition"
            >
              Voltar ao painel
            </button>
          </div>
        </header>

        {msg ? (
          <div className="rounded-xl border border-slate-700 bg-slate-800/40 px-4 py-3 text-xs text-slate-200">
            {msg}
          </div>
        ) : null}

        {erroGeral ? (
          <div className="rounded-xl border border-red-700 bg-red-900/30 px-4 py-3 text-xs text-red-100">
            {erroGeral}
          </div>
        ) : null}

        <div className="grid md:grid-cols-2 gap-4">
          <section className="rounded-2xl border border-slate-700 bg-slate-800/30 p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-50">PDV</h2>
              <button
                onClick={async () => {
                  await Promise.all([
                    recarregarProdutos(),
                    recarregar(),
                    recarregarProfissionais(),
                  ]);
                }}
                className="text-xs px-3 py-1 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 transition"
              >
                Atualizar
              </button>
            </div>

            <div className="mt-3 grid gap-2 text-xs">
              <div className="flex flex-col">
                <span className="text-[11px] text-slate-400 mb-1">
                  Profissional (comissionado)
                </span>
                <select
                  value={profissionalId}
                  onChange={(e) => setProfissionalId(e.target.value)}
                  className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-2 text-slate-100"
                >
                  <option value="">Selecione</option>
                  {(profAtivos || []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} (PDV: {Number(p.comissao_pdv_pct || 0).toFixed(0)}%)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col">
                <span className="text-[11px] text-slate-400 mb-1">Produto</span>
                <select
                  value={produtoId}
                  onChange={(e) => setProdutoId(e.target.value)}
                  className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-2 text-slate-100"
                >
                  <option value="">Selecione</option>
                  {(ativos || []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} (estoque: {p.estoque_qtd})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                <div className="flex flex-col">
                  <span className="text-[11px] text-slate-400 mb-1">Quantidade</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={qtd}
                    onChange={(e) => setQtd(Number(e.target.value))}
                    className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-2 text-slate-100"
                  />
                </div>

                <button
                  type="button"
                  onClick={addItem}
                  disabled={!podeVender}
                  className="h-[38px] px-3 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800 transition disabled:opacity-60"
                >
                  Adicionar
                </button>
              </div>

              <div className="mt-3 rounded-xl border border-slate-700 bg-slate-900/40 p-3">
                <div className="text-[11px] text-slate-400 mb-2">Itens</div>
                {itens.length ? (
                  <ul className="space-y-2">
                    {itens.map((i) => (
                      <li
                        key={i.produto_id}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-slate-200">
                          {i.nome} <span className="text-slate-500">x</span> {i.quantidade}
                        </span>
                        <button
                          onClick={() => removerItem(i.produto_id)}
                          className="px-2 py-1 rounded-lg border border-rose-600 text-rose-200 text-[10px] hover:bg-rose-600/10 transition"
                        >
                          Remover
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500">Nenhum item adicionado.</p>
                )}
              </div>

              <button
                onClick={finalizarVenda}
                disabled={!podeVender || salvando || !itens.length}
                className="mt-2 w-full text-xs px-3 py-2 rounded-lg border border-emerald-500 text-emerald-100 hover:bg-emerald-500/10 disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                {salvando ? "Registrando..." : "Finalizar venda"}
              </button>

              {loadingGeral ? <p className="text-xs text-slate-500">Carregando...</p> : null}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-700 bg-slate-800/30 p-4">
            <h2 className="font-semibold text-slate-50">Vendas de hoje</h2>

            {loadingVendas ? (
              <p className="text-sm text-slate-400 mt-3">Carregando vendas...</p>
            ) : vendas?.length ? (
              <ul className="mt-3 space-y-2 max-h-[420px] overflow-y-auto pr-1 text-xs">
                {vendas.map((v) => (
                  <li
                    key={v.id}
                    className="rounded-xl border border-slate-700 bg-slate-900/40 px-3 py-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-slate-200 font-semibold">
                        Total: R$ {Number(v.total || 0).toFixed(2)}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {new Date(v.created_at).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 mt-1">
                      {typeof v.lucro_total !== "undefined" ? (
                        <>
                          Lucro: R$ {Number(v.lucro_total || 0).toFixed(2)} • Comissão: R${" "}
                          {Number(v.comissao_valor || 0).toFixed(2)} (
                          {Number(v.comissao_pct_aplicada || 0).toFixed(0)}%)
                        </>
                      ) : null}
                    </div>

                    {Array.isArray(v.itens) && v.itens.length ? (
                      <div className="text-[11px] text-slate-400 mt-1">
                        {v.itens.map((i) => `${i.nome} x${i.quantidade}`).join(" • ")}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400 mt-3">Nenhuma venda hoje.</p>
            )}

            <button
              onClick={recarregar}
              className="mt-3 text-xs px-3 py-1 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 transition"
            >
              Atualizar
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}