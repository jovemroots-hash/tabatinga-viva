// netlify/functions/gerenciar-respostas.mjs
// Autenticação de Coordenadores e Gerenciamento (Exclusão pontual ou em lote) de Respostas no Netlify Forms

import crypto from "crypto";

const token = process.env.NETLIFY_TOKEN || "nfc_d9GeJZ6gmguC6Sj6we8hrHwEKVu1bZ2f9ae3";
const siteId = process.env.NETLIFY_SITE_ID || "2a88b494-9572-4a3e-b224-60017fbaa7a9";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "tabatinga2026";

// Função para gerar token de sessão administrativo simples e seguro
function gerarTokenAdmin() {
  const salt = "tabatinga-viva-salt-2026";
  const hoje = new Date().toISOString().slice(0, 10);
  return crypto.createHash("sha256").update(`${ADMIN_PASSWORD}-${hoje}-${salt}`).digest("hex");
}

function validarToken(tokenEnviado) {
  if (!tokenEnviado) return false;
  const tokenEsperadoHoje = gerarTokenAdmin();
  // Também aceitamos a própria senha como token
  if (tokenEnviado === ADMIN_PASSWORD) return true;
  return tokenEnviado === tokenEsperadoHoje;
}

export default async (req, context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8"
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Método não permitido" }), {
      status: 405,
      headers: corsHeaders
    });
  }

  try {
    const body = await req.json();
    const action = body.action || "";

    // 1. LOGIN ADMINISTRATIVO
    if (action === "login") {
      const password = (body.password || "").trim();
      if (password === ADMIN_PASSWORD) {
        const sessionToken = gerarTokenAdmin();
        return new Response(JSON.stringify({
          ok: true,
          token: sessionToken,
          message: "Login realizado com sucesso!"
        }), { status: 200, headers: corsHeaders });
      } else {
        return new Response(JSON.stringify({
          ok: false,
          error: "Senha de acesso incorreta"
        }), { status: 401, headers: corsHeaders });
      }
    }

    // 2. VERIFICAÇÃO DE SESSÃO / TOKEN
    if (action === "verify_token") {
      const isValid = validarToken(body.token);
      return new Response(JSON.stringify({
        ok: isValid,
        message: isValid ? "Token válido" : "Token expirado ou inválido"
      }), { status: isValid ? 200 : 401, headers: corsHeaders });
    }

    // A partir daqui, todas as ações requerem token válido
    if (!validarToken(body.token)) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Acesso não autorizado. Faça login novamente."
      }), { status: 401, headers: corsHeaders });
    }

    // 3. EXCLUSÃO PONTUAL DE UMA RESPOSTA ESPECÍFICA (Ex: spam, duplicada, mal intencionada)
    if (action === "delete_one") {
      const submissionId = (body.submission_id || "").trim();
      if (!submissionId) {
        return new Response(JSON.stringify({
          ok: false,
          error: "ID da submissão não fornecido"
        }), { status: 400, headers: corsHeaders });
      }

      const delRes = await fetch(`https://api.netlify.com/api/v1/submissions/${submissionId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (delRes.status === 204 || delRes.ok) {
        return new Response(JSON.stringify({
          ok: true,
          deleted_id: submissionId,
          message: `Resposta #${submissionId} apagada com sucesso!`
        }), { status: 200, headers: corsHeaders });
      } else {
        const errText = await delRes.text();
        return new Response(JSON.stringify({
          ok: false,
          error: `Erro ao apagar submissão no Netlify (${delRes.status}): ${errText}`
        }), { status: 500, headers: corsHeaders });
      }
    }

    // 4. LIMPAR TODOS OS DADOS DE TESTE (Em lote)
    if (action === "clear_all") {
      // Busca todas as submissões do site
      const listRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/submissions`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!listRes.ok) {
        throw new Error(`Falha ao listar submissões: ${listRes.statusText}`);
      }

      const submissions = await listRes.json();
      let apagadas = 0;

      for (const sub of submissions) {
        try {
          const r = await fetch(`https://api.netlify.com/api/v1/submissions/${sub.id}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          if (r.ok || r.status === 204) apagadas++;
        } catch (e) {
          console.error(`Erro ao apagar submissão ${sub.id}:`, e);
        }
      }

      return new Response(JSON.stringify({
        ok: true,
        total_deleted: apagadas,
        message: `${apagadas} registro(s) de teste apagado(s) com sucesso do banco de dados na nuvem.`
      }), { status: 200, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ ok: false, error: "Ação desconhecida" }), {
      status: 400,
      headers: corsHeaders
    });

  } catch (error) {
    return new Response(JSON.stringify({
      ok: false,
      error: error.message
    }), { status: 500, headers: corsHeaders });
  }
};
