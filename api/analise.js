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

  const apiKey = process.env.CLIENT_KEY;
  if (!apiKey) {
    console.error("CLIENT_KEY não está definido nas variáveis de ambiente da Vercel.");
    return res
      .status(500)
      .json({ error: "Chave de API não configurada no servidor." });
  }

  try {
    const { movimentos, metas, mes, ano } = req.body || {};

    if (!movimentos || !Array.isArray(movimentos) || !metas) {
      return res
        .status(400)
        .json({ error: "Dados insuficientes para análise." });
    }

    // Cálculo dos totais
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
        return `${m.data || "-"} | ${m.tipo} | ${m.categoria} | R$ ${Number(
          m.valor || 0
        ).toFixed(2)} | ${m.descricao || "-"}`;
      })
      .join("\n");

    // PROMPT PARA A IA
    const prompt = `
Você é um analista financeiro pessoal.

Analise os gastos, metas e sobras do usuário e produza um relatório claro e prático.

Dados do mês:
- Mês: ${mes}
- Ano: ${ano}

Metas:
- Poupança: R$ ${metas.metaPoupanca}
- Variáveis: R$ ${metas.metaVariavel}
- Cartão: R$ ${metas.metaCartao}

Totais:
- Entradas: R$ ${totalEntradas.toFixed(2)}
- Gastos Fixos: R$ ${totalFixos.toFixed(2)}
- Variáveis: R$ ${totalVariaveis.toFixed(2)}
- Cartão: R$ ${totalCartao.toFixed(2)}
- Saldo: R$ ${saldoMes.toFixed(2)}
- Poupança possível: R$ ${poupancaPossivel.toFixed(2)}

Movimentos:
${listaMovimentos}

Monte o relatório com:
1. Resumo geral.
2. Pontos positivos.
3. Alertas e riscos.
4. Sugestões práticas (5 no máximo).
5. Se a meta anual de R$ 15.600 é possível.
Resposta em português, direta e amigável.
`;

    // Chamada direta na API da OpenAI (sem SDK)
    const openaiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "Você é um analista financeiro profissional.",
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 700,
          temperature: 0.7,
        }),
      }
    );

    const data = await openaiResponse.json();

    if (!openaiResponse.ok) {
      console.error("Erro da OpenAI:", data);
      return res
        .status(500)
        .json({ error: "Erro ao chamar a API da OpenAI.", detalhes: data });
    }

    const texto =
      data.choices?.[0]?.message?.content ||
      "Não foi possível gerar a análise.";

    return res.status(200).json({ texto });
  } catch (error) {
    console.error("Erro /api/analise:", error);
    return res.status(500).json({ error: "Erro interno na análise." });
  }
}
