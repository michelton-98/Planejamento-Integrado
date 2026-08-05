# Controle-RDO
Dashboard de acompanhamento de RDOs

## Stack
- React 19 + Vite
- Tailwind CSS v4
- Supabase (`@supabase/supabase-js`)

## Estrutura de pastas
```
src/
  components/   # Componentes reutilizáveis
  pages/        # Páginas / rotas da aplicação
  lib/          # Integrações e utilitários (ex.: cliente Supabase)
```

## Configuração

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Copie `.env.example` para `.env` e preencha com as credenciais do seu projeto Supabase:
   ```bash
   cp .env.example .env
   ```
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
3. Rode o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

O cliente Supabase já configurado fica disponível em [`src/lib/supabaseClient.js`](src/lib/supabaseClient.js):
```js
import { supabase } from '../lib/supabaseClient'
```
