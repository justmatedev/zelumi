# Site na Vercel e backend na Cloudflare

Endereço escolhido: **https://usezelumi.vercel.app**. O projeto Vercel já está conectado ao GitHub e usa `web` como Root Directory. O Next.js continua gerando arquivos estáticos; não é necessário migrar o D1, o webhook ou os segredos do Telegram.

## Implementação e validação

- [x] Configurar `web/vercel.json` para servir `out/`, encaminhar somente `/auth` e `/api` ao Worker e preservar cookies, métodos, corpos e parâmetros. Não adicionar redirecionamentos que mudem as rotas da API ou o arquivo do widget.
- [x] Aplicar cabeçalhos de segurança na Vercel, com CSP própria para o documento isolado do widget. Desativar cache das respostas autenticadas.
- [x] Separar os visitantes no limite de tentativas de login por trás do proxy. Confiar em `X-Real-IP` apenas quando o proxy apresentar um segredo próprio, sem reutilizar o token Telegram.
- [x] Testar limites com visitantes distintos e cabeçalhos forjados; testar login/sessão/logout com origem Vercel e destino Worker. Rodar backend, interface, tipos, build/export e dry-run.
- [x] Configurar o segredo do proxy na Vercel e na Cloudflare, publicar os arquivos e verificar o encaminhamento no endereço público.
- [x] Atualizar a origem autorizada do Worker e vincular o domínio no BotFather ao bot definitivo `@zelumi_bot`.
- [ ] Confirmar login, dados reais e resposta do bot com o usuário.

## Configuração da Vercel

Usar o projeto existente `zelumi`, sem criar outro. Root Directory: `web`. Permitir arquivos externos à raiz no build, pois o site importa `shared/` e `finance/`. O arquivo `web/vercel.json` define instalação, build e saída estática, além das rotas e cabeçalhos.

O domínio principal é `usezelumi.vercel.app`. Os endereços temporários de preview não são origens autorizadas para login ou edição em produção.

`framework: null` seleciona a entrega estática da Vercel: o build continua sendo Next.js. As rotas explícitas preservam `/telegram-widget.html` e os caminhos sem barra final da API, sem normalização automática do preset Next.js.

Adicionar `VERCEL_PROXY_SECRET` nas variáveis de ambiente do projeto Vercel. O mesmo valor deve existir como secret no Worker. É um valor aleatório independente, usado somente para identificar o proxy ao separar os limites de login. Nunca usar prefixo `NEXT_PUBLIC_`. Token Telegram e segredo do webhook ficam exclusivamente na Cloudflare e no `.env` local ignorado.

## Troca do login

Depois de validar a publicação e a API no novo endereço:

1. Definir `APP_ORIGIN` do Worker como `https://usezelumi.vercel.app` e publicar o Worker existente.
2. No BotFather, enviar `/setdomain`, selecionar `@zelumi_bot` e informar `usezelumi.vercel.app`.
3. Entrar novamente pelo novo domínio. Cookies anteriores pertencem ao endereço antigo; a nova sessão encontra os mesmos registros pelo ID Telegram.
4. Conferir Perfil, totais com `/mes`, edição/exclusão de um lançamento de teste e resposta de `/hoje` com o bot local desligado.

O webhook continua em `https://financeiro-testes-bot.miudo.workers.dev/telegram/webhook`. Não recriar o banco, reimportar registros ou trocar o token do bot durante esta migração. O bot definitivo é `@zelumi_bot`, com nome Zelumi. A transição está registrada em [TROCA-BOT.md](./TROCA-BOT.md); a foto pode ser ajustada separadamente.

## Estado da publicação — 02/11/2026

O usuário confirmou a chave do proxy na Vercel (Production e Preview). A mesma chave foi cadastrada como secret no Worker, sem substituir os segredos existentes. O commit `1955e8d` foi enviado à `main`; a Vercel confirmou sucesso na [publicação](https://vercel.com/justmateteam/zelumi/CJXLoLQMsyZX2Ayn7nppBgyV6cUv).

Worker atualizado para `APP_ORIGIN=https://usezelumi.vercel.app`, versão `6a9b984d-a3c0-45f3-a645-41f983c9654e`. A versão financeira anterior era `d3edc342-66e2-43fa-b1b1-05d3578bab11`; nenhuma migração de banco foi executada nesta troca.

Verificações: 69 testes de backend/D1, 15 de interface, tipos, build/export e dry-run passaram. Em produção, as quatro páginas e o documento do widget retornaram 200; a API anônima retornou JSON 401 sem cache; rota desconhecida retornou 404 e método incorreto 405. O início do login pelo domínio Vercel retornou 200 com o bot correto e cookie HttpOnly/Secure/SameSite=Lax preservado. Origens externas, preview e endereço antigo retornaram 403. Saúde do Worker 200 e webhook sem segredo 401. A revisão independente não encontrou problemas críticos ou importantes.

Atualização posterior: o usuário criou o bot definitivo `@zelumi_bot` e confirmou a vinculação de `usezelumi.vercel.app` a ele no BotFather. O Worker foi atualizado para esse bot, versão `5994e736-d2c5-4158-b527-3a22bee0c81b`, preservando os 7 lançamentos e perfis. A troca está registrada em [TROCA-BOT.md](./TROCA-BOT.md).

Ainda pendente: validação pelo usuário de login real, Perfil, lançamentos e resposta do bot definitivo. As verificações anônimas não comprovam esses passos.

## Retorno ao endereço anterior

Se a integração não passar nas verificações, manter/restaurar `APP_ORIGIN` para o endereço do Worker e o mesmo domínio no BotFather. O Worker preserva os assets anteriores como alternativa; a troca da hospedagem do site não altera as tabelas financeiras. Um rollback da Vercel não troca automaticamente a configuração do Worker ou do Telegram.

## Referências

- [Rewrites para origens externas](https://vercel.com/docs/routing/rewrites)
- [Configuração de rotas e cabeçalhos](https://vercel.com/docs/project-configuration/vercel-json)
- [Login Widget clássico do Telegram](https://core.telegram.org/widgets/login-legacy)
