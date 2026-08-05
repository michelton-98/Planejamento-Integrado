-- Dispara a Edge Function "notificar-novo-cadastro" (supabase/functions/
-- notificar-novo-cadastro/index.ts) toda vez que um novo perfil é criado
-- com status_aprovacao = 'pendente' (todo cadastro novo nasce assim, via
-- o gatilho handle_new_user() da migration 0002). A function busca os
-- admins aprovados em perfis e envia o aviso por e-mail via Resend.
--
-- Usa o helper supabase_functions.http_request(), o mesmo mecanismo por
-- trás de "Database Webhooks" no painel do Supabase — só que declarado
-- aqui como migration para ficar versionado com o resto do schema.
--
-- O header Authorization usa a "publishable key" (chave anônima) do
-- projeto — não é segredo, é a mesma chave que já vai embutida no bundle
-- do site (VITE_SUPABASE_ANON_KEY) — só serve para a Edge Function aceitar
-- a chamada (verificação de JWT). Ela NÃO dá acesso a nada sensível: a
-- function usa a service role key (injetada automaticamente nela, nunca
-- aparece aqui) para ler perfis/admins no banco.
create trigger trg_notificar_novo_cadastro
  after insert on public.perfis
  for each row
  when (new.status_aprovacao = 'pendente')
  execute function supabase_functions.http_request(
    'https://fxbbwwacphkdugukghkm.supabase.co/functions/v1/notificar-novo-cadastro',
    'POST',
    '{"Content-Type":"application/json","Authorization":"Bearer sb_publishable_RCqIB4QjvW3xxbqoAbjT_w_wPRydDi-"}',
    '{}',
    '5000'
  );
