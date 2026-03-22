// src/controllers/vendas.controller.js
import { supabase } from "../lib/supabase.js";

// GET /vendas
export async function listarVendas(req, res) {
  try {
    const barbeariaId = req.barbeariaId;
    const periodo = String(req.query.periodo || "");

    let vendasQuery = supabase
      .from("vendas")
      .select(
        "id, total, lucro_total, comissao_pct_aplicada, comissao_valor, profissional_id, created_at, comissao_calculada_em, venda_itens(venda_id, quantidade, produto:produtos(nome))"
      )
      .eq("barbearia_id", barbeariaId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (periodo === "hoje") {
      // "hoje" no fuso local do servidor (se sua VPS estiver em UTC, isso vira "hoje UTC")
      // Se você quiser forçar America/Sao_Paulo independente do servidor, a gente ajusta depois.
      const now = new Date();
      const startLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      vendasQuery = vendasQuery.gte("created_at", startLocal.toISOString());
    }

    const { data: vendas, error: vendasErr } = await vendasQuery;
    if (vendasErr) {
      console.error("Erro Supabase GET /vendas:", vendasErr);
      return res.status(500).json({ error: "ERRO_VENDAS", message: vendasErr.message });
    }

    return res.json({
      vendas: (vendas || []).map((v) => {
        const { venda_itens, ...rest } = v;
        return {
          ...rest,
          itens: (venda_itens || []).map((it) => ({
            nome: it.produto?.nome ?? "(produto)",
            quantidade: it.quantidade,
          })),
        };
      }),
    });
  } catch (err) {
    console.error("Erro GET /vendas:", err);
    return res.status(500).json({ error: "ERRO_VENDAS", message: String(err?.message || err) });
  }
}

// POST /vendas
export async function criarVenda(req, res) {
  try {
    const barbeariaId = req.barbeariaId;

    // operador logado
    const userId = req.user?.id || req.auth?.userId || null;
    if (!userId) {
      return res.status(401).json({ error: "NAO_AUTENTICADO", message: "Usuário não autenticado." });
    }

    // profissional comissionado
    const profissionalId = String(req.body?.profissional_id || "").trim() || null;
    if (!profissionalId) {
      return res
        .status(400)
        .json({ error: "VALIDACAO", message: "profissional_id é obrigatório para registrar venda no PDV." });
    }

    // itens
    const itens = Array.isArray(req.body?.itens) ? req.body.itens : [];
    if (!itens.length) {
      return res.status(400).json({ error: "VALIDACAO", message: "itens é obrigatório." });
    }

    // normaliza e valida itens
    const norm = itens.map((it) => ({
      produto_id: String(it?.produto_id || "").trim(),
      quantidade: Number(it?.quantidade ?? 0),
    }));

    for (const it of norm) {
      if (!it.produto_id) {
        return res.status(400).json({ error: "VALIDACAO", message: "produto_id inválido." });
      }
      if (!Number.isFinite(it.quantidade) || it.quantidade <= 0) {
        return res.status(400).json({ error: "VALIDACAO", message: "quantidade inválida." });
      }
    }

    // valida profissional pertence à barbearia e pega % comissão do PDV
    const { data: prof, error: profErr } = await supabase
      .from("profissionais")
      .select("id, barbearia_id, nome, comissao_pdv_pct")
      .eq("id", profissionalId)
      .eq("barbearia_id", barbeariaId)
      .single();

    if (profErr) {
      console.error("Erro Supabase POST /vendas profissional:", profErr);
      return res.status(400).json({
        error: "VALIDACAO",
        message: "Profissional não encontrado ou não pertence à barbearia.",
      });
    }

    const comissaoPct = Number(prof?.comissao_pdv_pct ?? 0);
    if (!Number.isFinite(comissaoPct) || comissaoPct < 0 || comissaoPct > 100) {
      return res.status(400).json({
        error: "VALIDACAO",
        message: "comissao_pdv_pct inválida no profissional (esperado 0..100).",
      });
    }

    // busca produtos
    const produtoIds = [...new Set(norm.map((i) => i.produto_id))];

    const { data: produtos, error: prodErr } = await supabase
      .from("produtos")
      .select("id, nome, estoque_qtd, preco_venda, preco_custo")
      .eq("barbearia_id", barbeariaId)
      .in("id", produtoIds);

    if (prodErr) {
      console.error("Erro Supabase POST /vendas produtos:", prodErr);
      return res.status(500).json({ error: "ERRO_VENDAS", message: prodErr.message });
    }

    const mapProd = new Map((produtos || []).map((p) => [p.id, p]));

    // valida existência e estoque
    for (const it of norm) {
      const p = mapProd.get(it.produto_id);
      if (!p) {
        return res.status(400).json({
          error: "VALIDACAO",
          message: `Produto não encontrado ou não pertence à barbearia: ${it.produto_id}`,
        });
      }
      const estoque = Number(p.estoque_qtd ?? 0);
      if (it.quantidade > estoque) {
        return res.status(400).json({
          error: "ESTOQUE_INSUFICIENTE",
          message: `Estoque insuficiente para ${p.nome}. Disponível: ${estoque}`,
        });
      }
    }

    // calcula total e lucro
    let total = 0;
    let lucroTotal = 0;

    for (const it of norm) {
      const p = mapProd.get(it.produto_id);
      const pv = Number(p?.preco_venda ?? 0);
      const pc = p?.preco_custo == null ? 0 : Number(p.preco_custo);

      total += pv * it.quantidade;
      lucroTotal += (pv - pc) * it.quantidade;
    }

    // comissão sobre lucro (se lucro negativo, comissão = 0)
    const lucroBase = Math.max(0, lucroTotal);
    const comissaoValor = Number(((lucroBase * comissaoPct) / 100).toFixed(2));

    // ✅ selo financeiro
    const agoraISO = new Date().toISOString();

    // 1) cria venda com snapshot
    const { data: venda, error: vendaErr } = await supabase
      .from("vendas")
      .insert({
        barbearia_id: barbeariaId,
        user_id: userId,
        profissional_id: profissionalId,
        total,
        lucro_total: lucroTotal,
        comissao_pct_aplicada: comissaoPct,
        comissao_valor: comissaoValor,
        comissao_calculada_em: agoraISO,
      })
      .select(
        "id, total, lucro_total, comissao_pct_aplicada, comissao_valor, profissional_id, created_at, comissao_calculada_em"
      )
      .single();

    if (vendaErr) {
      console.error("Erro Supabase POST /vendas insert venda:", vendaErr);
      return res.status(500).json({ error: "ERRO_VENDAS", message: vendaErr.message });
    }

    // 2) cria itens
    const itensInsert = norm.map((it) => {
      const p = mapProd.get(it.produto_id);
      const pv = Number(p?.preco_venda ?? 0);
      const pc = p?.preco_custo == null ? 0 : Number(p.preco_custo);

      return {
        venda_id: venda.id,
        produto_id: it.produto_id,
        quantidade: it.quantidade,
        preco_venda_unit: pv,
        preco_custo_unit: pc,
        subtotal: pv * it.quantidade,
      };
    });

    const { error: itensErr } = await supabase.from("venda_itens").insert(itensInsert);
    if (itensErr) {
      console.error("Erro Supabase POST /vendas insert itens:", itensErr);

      // rollback best-effort
      await supabase.from("vendas").delete().eq("id", venda.id);

      return res.status(500).json({ error: "ERRO_VENDAS", message: itensErr.message });
    }

    // 3) baixa estoque (best-effort)
    for (const it of norm) {
      const p = mapProd.get(it.produto_id);
      const novoEstoque = Number(p.estoque_qtd ?? 0) - it.quantidade;

      const { error: upErr } = await supabase
        .from("produtos")
        .update({ estoque_qtd: novoEstoque })
        .eq("id", it.produto_id)
        .eq("barbearia_id", barbeariaId);

      if (upErr) {
        console.error("Erro baixando estoque:", upErr);
        return res.status(500).json({
          error: "ERRO_ESTOQUE",
          message: `Venda criada, mas falhou ao baixar estoque de ${p?.nome || it.produto_id}`,
        });
      }
    }

    return res.status(201).json({ venda });
  } catch (err) {
    console.error("Erro POST /vendas:", err);
    return res.status(500).json({ error: "ERRO_VENDAS", message: String(err?.message || err) });
  }
}

