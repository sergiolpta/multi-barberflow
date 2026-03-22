// src/components/admin/AdminVendas.jsx
import { useMemo, useState } from "react";
import { useAdminProdutos } from "../../hooks/useAdminProdutos";
import { useAdminVendas } from "../../hooks/useAdminVendas";
import { useAdminProfissionais } from "../../hooks/useAdminProfissionais";

import { Badge } from "../common/Badge";
import { SectionCard } from "../common/SectionCard";

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

  const profissionalSelecionado = useMemo(
    () => profAtivos.find((p) => p.id === profissionalId),
    [profAtivos, profissionalId]
  );

  const totalItens = useMemo(
    () => itens.reduce((acc, i) => acc + Number(i.quantidade || 0), 0),
    [itens]
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
    <div className="min-h-screen bg-[var(--bg-app)] px-4 py-8 text-[var(--text-app)] md:py-10">
      <div className="mx-auto w-full max-w-7xl">
        <header className="mb-8 overflow-hidden rounded-[28px] border border-[var(--border-color)] bg-[var(--bg-panel)] shadow-[var(--shadow-panel)] backdrop-blur-xl">
          <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-sky-500 to-amber-500" />
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
                  🛒
                </div>
              )}

              <div className="min-w-0">
                <div className="mb-2 inline-flex items-center rounded-full border border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-3 py-1 text-[11px] font-medium text-[var(--text-muted)]">
                  PDV e vendas rápidas
                </div>

                <h1 className="text-2xl font-bold tracking-tight text-[var(--text-app)] md:text-3xl">
                  {barbeariaNome || "Barbearia"}
                </h1>

                <p className="mt-2 text-sm text-[var(--text-muted)] md:text-[15px]">
                  Registre vendas de balcão, dê baixa no estoque e grave comissão por profissional.
                </p>

                {!podeVender && (
                  <p className="mt-2 text-[12px] text-[var(--text-soft)]">
                    Seu perfil pode visualizar, mas não pode registrar vendas.
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

        {erroGeral ? (
          <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
            {erroGeral}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.02fr_1.98fr]">
          <SectionCard
            title="PDV"
            subtitle="Monte a venda, selecione o profissional comissionado e finalize a operação."
            actions={
              <button
                onClick={async () => {
                  await Promise.all([
                    recarregarProdutos(),
                    recarregar(),
                    recarregarProfissionais(),
                  ]);
                }}
                className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-4 py-2.5 text-sm font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-panel)]"
              >
                Atualizar
              </button>
            }
          >
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge tone="sky">{ativos.length} produtos ativos</Badge>
                <Badge tone="emerald">{profAtivos.length} profissionais ativos</Badge>
                <Badge tone="amber">{totalItens} item(ns) no carrinho</Badge>
              </div>

              <div className="flex flex-col">
                <label className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                  Profissional (comissionado)
                </label>
                <select
                  value={profissionalId}
                  onChange={(e) => setProfissionalId(e.target.value)}
                  className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-3 text-sm text-[var(--text-app)] outline-none transition focus:border-emerald-500"
                >
                  <option value="">Selecione</option>
                  {(profAtivos || []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} (PDV: {Number(p.comissao_pdv_pct || 0).toFixed(0)}%)
                    </option>
                  ))}
                </select>
                {profissionalSelecionado ? (
                  <div className="mt-2 text-[12px] text-[var(--text-muted)]">
                    Comissão PDV atual:{" "}
                    <span className="font-semibold text-[var(--text-app)]">
                      {Number(profissionalSelecionado.comissao_pdv_pct || 0).toFixed(2)}%
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col">
                <label className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                  Produto
                </label>
                <select
                  value={produtoId}
                  onChange={(e) => setProdutoId(e.target.value)}
                  className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-3 text-sm text-[var(--text-app)] outline-none transition focus:border-emerald-500"
                >
                  <option value="">Selecione</option>
                  {(ativos || []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} (estoque: {p.estoque_qtd})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                <div className="flex flex-col">
                  <label className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                    Quantidade
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={qtd}
                    onChange={(e) => setQtd(Number(e.target.value))}
                    className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-3 text-sm text-[var(--text-app)] outline-none transition focus:border-emerald-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={addItem}
                  disabled={!podeVender}
                  className="h-[48px] rounded-xl border border-sky-500/60 bg-sky-500/10 px-4 text-sm font-medium text-sky-600 transition hover:bg-sky-500/15 disabled:opacity-60"
                >
                  Adicionar
                </button>
              </div>

              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)] p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-[var(--text-app)]">Carrinho</div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      Itens preparados para a venda atual.
                    </div>
                  </div>
                  <Badge tone="amber">{totalItens} item(ns)</Badge>
                </div>

                {itens.length ? (
                  <ul className="space-y-2">
                    {itens.map((i) => (
                      <li
                        key={i.produto_id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-3"
                      >
                        <span className="text-sm text-[var(--text-app)]">
                          <span className="font-medium">{i.nome}</span>{" "}
                          <span className="text-[var(--text-muted)]">x</span> {i.quantidade}
                        </span>
                        <button
                          onClick={() => removerItem(i.produto_id)}
                          className="rounded-xl border border-rose-500/60 bg-rose-500/10 px-3 py-1.5 text-[11px] font-medium text-rose-600 transition hover:bg-rose-500/15"
                        >
                          Remover
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                    Nenhum item adicionado.
                  </div>
                )}
              </div>

              <button
                onClick={finalizarVenda}
                disabled={!podeVender || salvando || !itens.length}
                className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {salvando ? "Registrando..." : "Finalizar venda"}
              </button>

              {loadingGeral ? (
                <p className="text-[12px] text-[var(--text-muted)]">Carregando dados...</p>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard
            title="Vendas de hoje"
            subtitle="Acompanhe as últimas vendas registradas, lucro e comissão aplicada."
            actions={
              <button
                onClick={recarregar}
                className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-4 py-2.5 text-sm font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-panel)]"
              >
                Atualizar
              </button>
            }
          >
            {loadingVendas ? (
              <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                Carregando vendas...
              </div>
            ) : vendas?.length ? (
              <div className="space-y-3">
                {vendas.map((v) => (
                  <div
                    key={v.id}
                    className="overflow-hidden rounded-[24px] border border-[var(--border-color)] bg-[var(--bg-panel-strong)] shadow-[var(--shadow-soft)]"
                  >
                    <div className="flex h-full">
                      <div className="w-1.5 shrink-0 bg-emerald-500" />
                      <div className="flex-1 p-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <Badge tone="emerald">
                                Total: R$ {Number(v.total || 0).toFixed(2)}
                              </Badge>

                              {typeof v.lucro_total !== "undefined" ? (
                                <Badge tone="sky">
                                  Lucro: R$ {Number(v.lucro_total || 0).toFixed(2)}
                                </Badge>
                              ) : null}

                              {typeof v.comissao_valor !== "undefined" ? (
                                <Badge tone="amber">
                                  Comissão: R$ {Number(v.comissao_valor || 0).toFixed(2)}
                                </Badge>
                              ) : null}
                            </div>

                            <div className="text-sm text-[var(--text-app)]">
                              {Array.isArray(v.itens) && v.itens.length
                                ? v.itens.map((i) => `${i.nome} x${i.quantidade}`).join(" • ")
                                : "Venda sem detalhamento de itens"}
                            </div>

                            <div className="mt-2 text-[12px] text-[var(--text-muted)]">
                              {typeof v.lucro_total !== "undefined" ? (
                                <>
                                  Percentual aplicado:{" "}
                                  <span className="font-semibold text-[var(--text-app)]">
                                    {Number(v.comissao_pct_aplicada || 0).toFixed(0)}%
                                  </span>
                                </>
                              ) : null}
                            </div>
                          </div>

                          <div className="text-[12px] text-[var(--text-muted)]">
                            {new Date(v.created_at).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                Nenhuma venda hoje.
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}