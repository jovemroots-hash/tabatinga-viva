// netlify/functions/resumo-tempo-real.mjs
// Retorna o consolidado em tempo real das pesquisas preenchidas no Projeto Tabatinga Viva

export default async (req, context) => {
  const token = process.env.NETLIFY_TOKEN || "nfc_d9GeJZ6gmguC6Sj6we8hrHwEKVu1bZ2f9ae3";
  const siteId = process.env.NETLIFY_SITE_ID || "2a88b494-9572-4a3e-b224-60017fbaa7a9";

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=3, s-maxage=3"
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const res = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/submissions`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      throw new Error(`Netlify API status ${res.status}: ${res.statusText}`);
    }

    const submissions = await res.json();

    // 12 ATIVIDADES BASE DO PROJETO
    const ATIVIDADES_NOMES = [
      { id: "futebol", titulo: "1. Futebol & Futsal", icone: "⚽" },
      { id: "volei", titulo: "2. Vôlei de Praia & Adaptado (60+)", icone: "🏐" },
      { id: "boxe", titulo: "3. Boxe Educativo / Defesa Pessoal", icone: "🥊" },
      { id: "funcional", titulo: "4. Funcional, Alongamento & Mobilidade", icone: "🧘" },
      { id: "danca", titulo: "5. Dança, Ritmos & Zumba", icone: "💃" },
      { id: "coral", titulo: "6. Canto Coral Comunitário", icone: "🎵" },
      { id: "violao", titulo: "7. Violão & Ukulele (Iniciação)", icone: "🎸" },
      { id: "teatro", titulo: "8. Teatro, Expressão & Desenho", icone: "🎭" },
      { id: "leitura", titulo: "9. Tabatinga Lê & Brinca + Xadrez", icone: "📚" },
      { id: "ingles", titulo: "10. Inglês Prático (Conversação)", icone: "🗣️" },
      { id: "espanhol", titulo: "11. Espanhol Prático (Turismo/Conversa)", icone: "🌎" },
      { id: "reforco", titulo: "12. Reforço Escolar & Apoio Pedagógico", icone: "✏️" }
    ];

    const stats = {
      total_familias: submissions.length,
      total_vagas: 0,
      total_mulheres: 0,
      total_homens: 0,
      total_outros: 0,
      turmas: { Mista: 0, Feminina: 0, Masculina: 0 },
      financeiro: { gratis: 0, rateio: 0 },
      vinculos: { Ubatuba: 0, Caragua: 0, Proprietario: 0, Trabalha: 0 },
      atividades: {},
      ultimas_manifestacoes: [],
      submissoes_completas: []
    };

    ATIVIDADES_NOMES.forEach(a => {
      stats.atividades[a.id] = {
        id: a.id,
        titulo: a.titulo,
        icone: a.icone,
        vagas: 0,
        turmas: { Mista: 0, Feminina: 0, Masculina: 0 },
        gratis: 0,
        rateio: 0
      };
    });

    submissions.forEach(sub => {
      const data = sub.data || {};
      const protocolo = data.protocolo || sub.id;
      const dataEnvio = data.data_envio || new Date(sub.created_at).toLocaleString("pt-BR");
      const vinculo = data.vinculo || "Morador Fixo";
      const whatsapp = data.whatsapp || "";

      // Vínculo
      if (vinculo.includes("Ubatuba")) stats.vinculos.Ubatuba++;
      else if (vinculo.includes("Caraguá")) stats.vinculos.Caragua++;
      else if (vinculo.includes("Proprietário")) stats.vinculos.Proprietario++;
      else stats.vinculos.Trabalha++;

      // Membros
      let membros = [];
      try {
        membros = JSON.parse(data.detalhes_familia || "[]");
      } catch (e) {
        membros = [];
      }

      membros.forEach(m => {
        if (m.sexo === "Mulher") stats.total_mulheres++;
        else if (m.sexo === "Homem") stats.total_homens++;
        else stats.total_outros++;
      });

      // Atividades
      let atividades = [];
      try {
        atividades = JSON.parse(data.detalhes_atividades || "[]");
      } catch (e) {
        atividades = [];
      }

      const atividadesNomesFamilia = [];

      atividades.forEach(at => {
        const qtdAlunos = (at.alunos || []).length || 1;
        stats.total_vagas += qtdAlunos;
        atividadesNomesFamilia.push(at.titulo);

        const ativId = at.id || "";
        let ativStat = stats.atividades[ativId];
        if (!ativStat) {
          // Busca por título aproximado
          const achou = ATIVIDADES_NOMES.find(an => at.titulo && at.titulo.includes(an.titulo.split(" ")[1]));
          if (achou) ativStat = stats.atividades[achou.id];
        }

        if (ativStat) {
          ativStat.vagas += qtdAlunos;
          const fmt = at.formatoTurma === "Feminina" ? "Feminina" : (at.formatoTurma === "Masculina" ? "Masculina" : "Mista");
          ativStat.turmas[fmt] += qtdAlunos;
          stats.turmas[fmt] += qtdAlunos;

          if ((at.valor || "").toLowerCase().includes("grátis") || (at.valor || "").toLowerCase().includes("gratuito")) {
            ativStat.gratis += qtdAlunos;
            stats.financeiro.gratis += qtdAlunos;
          } else {
            ativStat.rateio += qtdAlunos;
            stats.financeiro.rateio += qtdAlunos;
          }
        }
      });

      // Manifestação recente anonimizada
      if (stats.ultimas_manifestacoes.length < 6) {
        stats.ultimas_manifestacoes.push({
          protocolo: protocolo,
          hora: dataEnvio,
          vinculo: vinculo,
          total_pessoas: membros.length || 1,
          atividades: atividadesNomesFamilia
        });
      }

      // Registro completo para o painel de respostas
      stats.submissoes_completas.push({
        protocolo: protocolo,
        data_envio: dataEnvio,
        whatsapp: whatsapp,
        vinculo: vinculo,
        membros: membros,
        atividades: atividades,
        outra_sugestao: data.outra_sugestao || "",
        colaboracao_professor: data.colaboracao_professor || ""
      });
    });

    // Ranking ordenado
    stats.ranking_atividades = Object.values(stats.atividades).sort((a, b) => b.vagas - a.vagas);

    return new Response(JSON.stringify({ ok: true, timestamp: Date.now(), data: stats }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    return new Response(JSON.stringify({
      ok: false,
      error: error.message,
      timestamp: Date.now()
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
};
