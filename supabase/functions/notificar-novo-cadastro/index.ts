// Edge Function: notificar-novo-cadastro
//
// Disparada por um trigger de banco (ver migration 0008) toda vez que um
// novo registro é inserido em public.perfis com status_aprovacao =
// 'pendente' (todo cadastro novo nasce assim). Envia um e-mail via Resend
// para todos os administradores aprovados, avisando que há um cadastro
// esperando aprovação.
//
// Segurança: o corpo que o trigger manda (payload.record) NUNCA é
// confiado diretamente para montar o e-mail — ele só é usado para pegar o
// `id` do perfil recém-criado. Os dados reais (nome/e-mail/função) são
// buscados de volta no banco com a service role key. Isso evita que
// alguém que descubra a URL da function force o envio de um e-mail com
// conteúdo forjado para os admins: sem um `id` de perfil pendente
// existente de verdade, não sai e-mail nenhum.
//
// Variáveis de ambiente necessárias (configuradas como secrets da Edge
// Function no painel do Supabase — nunca no código):
//   RESEND_API_KEY     (obrigatória) — API key do Resend.
//   RESEND_FROM_EMAIL  (opcional) — remetente; padrão usa o domínio de
//                       testes do Resend (onboarding@resend.dev), que só
//                       funciona sem verificação de domínio em modo teste.
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetadas automaticamente
// pelo Supabase em toda Edge Function — não precisam ser configuradas.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Controle RDO <onboarding@resend.dev>'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

function escapeHtml(texto: unknown) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function respostaJson(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return respostaJson({ error: 'Método não suportado.' }, 405)
  }

  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY não configurada nas secrets da function.')
    return respostaJson({ error: 'RESEND_API_KEY não configurada.' }, 500)
  }

  let payload: { record?: { id?: string } }
  try {
    payload = await req.json()
  } catch {
    return respostaJson({ error: 'Corpo da requisição não é JSON válido.' }, 400)
  }

  const perfilId = payload?.record?.id
  if (!perfilId) {
    return respostaJson({ skipped: true, motivo: 'payload sem record.id' })
  }

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

  // Rebusca o perfil no banco (nunca confia no corpo recebido) — só
  // segue adiante se ele existir e realmente estiver pendente.
  const { data: perfil, error: erroPerfil } = await supabase
    .from('perfis')
    .select('nome, email, funcao, status_aprovacao')
    .eq('id', perfilId)
    .single()

  if (erroPerfil || !perfil) {
    return respostaJson({ skipped: true, motivo: 'perfil não encontrado' })
  }

  if (perfil.status_aprovacao !== 'pendente') {
    return respostaJson({ skipped: true, motivo: 'perfil não está mais pendente' })
  }

  const { data: admins, error: erroAdmins } = await supabase
    .from('perfis')
    .select('email')
    .eq('is_admin', true)
    .eq('status_aprovacao', 'aprovado')

  if (erroAdmins) {
    console.error('Erro ao buscar admins:', erroAdmins.message)
    return respostaJson({ error: erroAdmins.message }, 500)
  }

  const destinatarios = (admins ?? []).map((admin) => admin.email).filter(Boolean)

  if (destinatarios.length === 0) {
    return respostaJson({ skipped: true, motivo: 'nenhum admin aprovado encontrado' })
  }

  const nome = perfil.nome || '(sem nome informado)'
  const email = perfil.email || '(sem e-mail)'
  const funcao = perfil.funcao || '(não informado)'

  const assunto = 'Novo cadastro aguardando aprovação — Controle RDO'
  const corpoHtml = `
    <p>Um novo cadastro foi solicitado no <strong>Controle RDO</strong> e está aguardando aprovação:</p>
    <ul>
      <li><strong>Nome:</strong> ${escapeHtml(nome)}</li>
      <li><strong>E-mail:</strong> ${escapeHtml(email)}</li>
      <li><strong>Função:</strong> ${escapeHtml(funcao)}</li>
    </ul>
    <p>Acesse a aba <strong>Aprovações</strong> no sistema para aprovar ou recusar esse cadastro.</p>
  `.trim()

  try {
    const respostaResend = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: destinatarios,
        subject: assunto,
        html: corpoHtml,
      }),
    })

    if (!respostaResend.ok) {
      const detalhe = await respostaResend.text()
      console.error(`Resend respondeu ${respostaResend.status}: ${detalhe}`)
      return respostaJson({ error: `Resend respondeu ${respostaResend.status}: ${detalhe}` }, 502)
    }

    return respostaJson({ enviado: true, destinatarios: destinatarios.length })
  } catch (err) {
    console.error('Erro ao chamar a API do Resend:', err)
    return respostaJson({ error: String(err) }, 500)
  }
})
