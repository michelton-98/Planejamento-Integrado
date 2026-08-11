// Edge Function: excluir-usuario
//
// Exclui um usuário por completo: conta de autenticação (auth.users) e,
// por cascata (perfis.id referencia auth.users com "on delete cascade"),
// o registro correspondente em public.perfis. Existe como Edge Function
// porque isso exige a service role key — o cliente anônimo/autenticado do
// front-end não tem permissão para apagar a conta de OUTRO usuário via
// API de autenticação (só a Admin API, que só roda com a service role,
// consegue).
//
// Chamada a partir da tela "Gestão de Usuários" via
// supabase.functions.invoke('excluir-usuario', { body: { id } }) — o
// client já anexa o token da sessão atual no header Authorization.
//
// Segurança (defesa em profundidade — a mesma regra também está garantida
// no banco via trigger, ver migration 0009):
//   - exige um token válido (usuário autenticado);
//   - só quem tem is_admin = true em public.perfis pode chamar;
//   - bloqueia excluir a própria conta (evita se trancar fora sem querer);
//   - bloqueia excluir uma conta is_master.
//
// Variáveis de ambiente: SUPABASE_URL, SUPABASE_ANON_KEY e
// SUPABASE_SERVICE_ROLE_KEY são injetadas automaticamente pelo Supabase em
// toda Edge Function — não precisam ser configuradas manualmente.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function respostaJson(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return respostaJson({ error: 'Método não suportado.' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return respostaJson({ error: 'Não autenticado.' }, 401)
  }

  let body: { id?: string }
  try {
    body = await req.json()
  } catch {
    return respostaJson({ error: 'Corpo da requisição não é JSON válido.' }, 400)
  }

  const idAlvo = body?.id
  if (!idAlvo) {
    return respostaJson({ error: 'Campo "id" é obrigatório.' }, 400)
  }

  // Cliente "como o usuário que chamou" — só pra descobrir quem é (valida
  // o token). Todo o resto usa a service role, que ignora RLS.
  const supabaseComoUsuario = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user: usuarioSolicitante },
    error: erroSolicitante,
  } = await supabaseComoUsuario.auth.getUser()

  if (erroSolicitante || !usuarioSolicitante) {
    return respostaJson({ error: 'Sessão inválida ou expirada.' }, 401)
  }

  const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

  const { data: perfilSolicitante, error: erroPerfilSolicitante } = await supabaseAdmin
    .from('perfis')
    .select('is_admin')
    .eq('id', usuarioSolicitante.id)
    .single()

  if (erroPerfilSolicitante || !perfilSolicitante?.is_admin) {
    return respostaJson({ error: 'Apenas administradores podem excluir usuários.' }, 403)
  }

  if (idAlvo === usuarioSolicitante.id) {
    return respostaJson({ error: 'Você não pode excluir sua própria conta por aqui.' }, 400)
  }

  const { data: perfilAlvo, error: erroPerfilAlvo } = await supabaseAdmin
    .from('perfis')
    .select('is_master')
    .eq('id', idAlvo)
    .single()

  if (erroPerfilAlvo || !perfilAlvo) {
    return respostaJson({ error: 'Usuário não encontrado.' }, 404)
  }

  if (perfilAlvo.is_master) {
    return respostaJson({ error: 'Contas master não podem ser excluídas.' }, 403)
  }

  // Apaga a conta de autenticação; o registro em public.perfis some junto
  // por cascata (foreign key "on delete cascade").
  const { error: erroExclusao } = await supabaseAdmin.auth.admin.deleteUser(idAlvo)

  if (erroExclusao) {
    console.error('Erro ao excluir usuário:', erroExclusao.message)
    return respostaJson({ error: erroExclusao.message }, 500)
  }

  return respostaJson({ excluido: true })
})
