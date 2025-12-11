import OpenAI from "openai";

// <<< AQUI usamos OPENAI_API_KEY (que já existe na Vercel)
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helpers de CORS
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*"); // depois podemos trocar pelo domínio específico
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCors(res);

  // Preflight (OPTIONS)
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use o método POST." });
  }

  // Segurança extra: se a variável não estiver setada, já avisamos
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY não está definida nas Environment Variables.");
    return res.status(500).json({
      error: "Configuração da API ausente. Verifique OPENAI_API_KEY na Vercel.",
    });
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
        const data = m.data || "-";
        const tipo = m.tipo || "-";
        const cat = m.categoria || "-";
        const desc = m.descricao || "-";
        const valor = Number(m.valor || 0).toFixed(2).replace(".", ",");
        return `${data} | ${tipo} | ${cat} | R$ ${valor} | ${desc}`;
      })
      .join("\n");

    // PROMPT para a IA
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
`;

    // Chamada para a API nova da OpenAI (Responses)
    const resposta = await client.responses.create({
      model: "gpt-5.1-mini",
      input: prompt,
      max_output_tokens: 500,
    });

    const texto =
      resposta.output?.[0]?.content?.[0]?.text ||
      "Não foi possível gerar a análise.";

    return res.status(200).json({ texto });
  } catch (error) {
    console.error("Erro /api/analise:", error);
    return res.status(500).json({ error: "Erro interno na análise." });
  }
}
