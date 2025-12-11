// api/analise.js

// Helpers de CORS
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCors(res);

  // Preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use o método POST." });
  }

  try {
    const { movimentos, metas, mes, ano } = req.body || {};

    if (!movimentos || !Array.isArray(movimentos) || !metas) {
      return res
        .status(400)
        .json({ error: "Dados insuficientes para análise." });
    }

    // --- Cálculos básicos ---
    let totalEntradas = 0;
    let totalFixos = 0;
    let totalVariaveis = 0;
    let totalCartao = 0;

    movimentos.forEach((m) => {
      const v = Number(m.valor) || 0;
      if (m.tipo === "entrada") totalEntradas += v;
      if (m.tipo === "fixo") totalFixos += v;
      if (m.tipo === "variavel") totalVariaveis += v;
      if (m.tipo === "cartao") totalCartao += v;
    });

    const saldoMes = totalEntradas - totalFixos - totalVariaveis - totalCartao;
    const poupancaPossivel = Math.max(0, saldoMes);

    const listaMovimentos = movimentos
      .map((m) => {
        const data = m.data || "-";
        const tipo = m.tipo || "-";
        const cat = m.categoria || "-";
        const desc = m.descricao || "-";
        const valor = Number(m.valor || 0).toFixed(2).replace(".", ",");

        return `${data} | ${tipo} | ${cat} | R$ ${valor} | ${desc}`;
      })
      .join("\n");

    // --- Prompt para IA ---
    const prompt = `
Você é um analista financeiro pessoal.

Analise os gastos, metas e sobras do usuário e produza um relatório claro, direto e prático em português.

Dados do mês:
- Mês: ${mes}
- Ano: ${ano}

Metas do mês:
- Meta de poupança: R$ ${Number(metas.metaPoupanca || 0).toFixed(2)}
- Meta de gastos variáveis: R$ ${Number(metas.metaVariavel || 0).toFixed(2)}
- Meta do cartão de crédito: R$ ${Number(metas.metaCartao || 0).toFixed(2)}

Totais calculados:
- Entradas: R$ ${totalEntradas.toFixed(2)}
- Fixos: R$ ${totalFixos.toFixed(2)}
- Variáveis: R$ ${totalVariaveis.toFixed(2)}
- Cartão: R$ ${totalCartao.toFixed(2)}
- Saldo do mês: R$ ${saldoMes.toFixed(2)}
- Poupança possível: R$ ${poupancaPossivel.toFixed(2)}

Lista de movimentos (um por linha):
${listaMovimentos}

Gere um relatório com:
1) Resumo geral do mês.
2) Pontos positivos (o que está dentro ou melhor que as metas).
3) Alertas e riscos (onde está acima das metas ou perigoso).
4) Sugestões práticas e simples para o próximo mês (máx. 5 bullets).
5) Se a meta anual de poupança de R$ 15.600,00 parece alcançável no ritmo atual (explique rapidamente).
Resposta em tom amigável, mas objetivo.
`;

    // --- Chamada para API da OpenAI via fetch (sem SDK) ---
    const apiKey = process.env.CLIENT_KEY;

    if (!apiKey) {
      console.error("CLIENT_KEY não configurada no Vercel");
      return res.status(500).json({ error: "CLIENT_KEY não configurada." });
    }

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // ou outro modelo que sua conta permitir
        messages: [
          {
            role: "system",
            content: "Você é um analista financeiro profissional.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.5,
      }),
    });

    const data = await openaiRes.json();

    if (!openaiRes.ok) {
      console.error("Erro da OpenAI:", data);
      return res
        .status(500)
        .json({ error: "Erro ao chamar a OpenAI.", detalhes: data });
    }

    const texto =
      data.choices?.[0]?.message?.content ||
      "Não foi possível gerar o texto da análise.";

    return res.status(200).json({ texto });
  } catch (error) {
    console.error("Erro /api/analise:", error);
    return res.status(500).json({ error: "Erro interno na análise." });
  }
}
