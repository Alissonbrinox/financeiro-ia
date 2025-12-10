export default async function handler(req, res) {
  try {
    const { movimentos, metas, mes, ano } = req.body;

    if (!movimentos || !metas) {
      return res.status(400).json({ error: "Dados insuficientes." });
    }

    const prompt = `
      Você é um analista financeiro pessoal.
      Analise os gastos, metas e sobras do usuário.

      Dados do mês:
      Mês: ${mes}
      Ano: ${ano}

      Metas do mês:
      - Meta poupança: ${metas.metaPoupanca}
      - Meta variáveis: ${metas.metaVariavel}
      - Meta cartão: ${metas.metaCartao}

      Movimentos:
      ${movimentos.map(m => `
        - ${m.data} | ${m.tipo} | ${m.categoria} | R$ ${m.valor}
      `).join("\n")}

      Gere um relatório com:
      1. Resumo do mês.
      2. Riscos financeiros.
      3. Gastos acima da média.
      4. Previsão de atingir meta.
      5. Sugestões práticas.

      Responda em markdown claro e objetivo.
    `;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "Você é um analista financeiro profissional." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7
      })
    });

    const json = await response.json();
    const texto = json.choices?.[0]?.message?.content || "Sem análise.";

    return res.status(200).json({ texto });

  } catch (e) {
    return res.status(500).json({ error: e.toString() });
  }
}
