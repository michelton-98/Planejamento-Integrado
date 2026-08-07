import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// O mesmo build serve dois destinos diferentes:
// - Vercel: domínio próprio, serve a partir da raiz ("/").
// - GitHub Pages: serve num subcaminho (usuario.github.io/Controle-RDO/),
//   por isso os assets (JS/CSS) e as rotas do react-router precisam do
//   prefixo "/Controle-RDO/". O workflow do GitHub Actions
//   (.github/workflows/deploy-pages.yml) seta GITHUB_PAGES=true só no
//   build que vai pro Pages; o build da Vercel não seta essa variável e
//   continua servindo da raiz normalmente.
const base = process.env.GITHUB_PAGES === 'true' ? '/Controle-RDO/' : '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
})
