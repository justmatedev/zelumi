# Site na Vercel e backend na Cloudflare

Endereço escolhido: **https://usezelumi.vercel.app**. O projeto Vercel já está conectado ao GitHub e usa `web` como Root Directory. O Next.js continua gerando arquivos estáticos; não é necessário migrar o D1, o webhook ou os segredos do Telegram.

## Implementação e validação

- [ ] Configurar `web/vercel.json` para servir `out/`, encaminhar somente `/auth` e `/api` ao Worker e preservar cookies, métodos, corpos e parâmetros. Não adicionar redirecionamentos que mudem as rotas da API ou o arquivo do widget.
- [ ] Aplicar cabeçalhos de segurança na Vercel, com CSP própria para o documento isolado do widget. Desativar cache das respostas autenticadas.
- [ ] Separar os visitantes no limite de tentativas de login por trás do proxy. Confiar em `X-Real-IP` apenas quando o proxy apresentar um segredo próprio, sem reutilizar o token Telegram.
- [ ] Testar limites com visitantes distintos e cabeçalhos forjados; testar login/sessão/logout com origem Vercel e destino Worker. Rodar backend, interface, tipos, build/export e dry-run.
- [ ] Configurar o segredo do proxy na Vercel e na Cloudflare, publicar os arquivos e verificar o encaminhamento no endereço público.
- [ ] Atualizar a origem autorizada do Worker, vincular o novo domínio no BotFather e confirmar login, dados reais e resposta do bot com o usuário.

## Configuração da Vercel

Usar o projeto existente `zelumi`, sem criar outro. Root Directory: `web`. Permitir arquivos externos à raiz no build, pois o site importa `shared/` e `finance/`. O arquivo `web/vercel.json` define instalação, build e saída estática, além das rotas e cabeçalhos.

O domínio principal é `usezelumi.vercel.app`. Os endereços temporários de preview não são origens autorizadas para login ou edição em produção.

Adicionar `VERCEL_PROXY_SECRET` nas variáveis de ambiente do projeto Vercel. O mesmo valor deve existir como secret no Worker. É um valor aleatório independente, usado somente para identificar o proxy ao separar os limites de login. Nunca usar prefixo `NEXT_PUBLIC_`. Token Telegram e segredo do webhook ficam exclusivamente na Cloudflare e no `.env` local ignorado.

## Troca do login

Depois de validar a publicação e a API no novo endereço:

1. Definir `APP_ORIGIN` do Worker como `https://usezelumi.vercel.app` e publicar o Worker existente.
2. No BotFather, enviar `/setdomain`, selecionar `@financeiro_lab_482_bot` e informar `usezelumi.vercel.app`.
3. Entrar novamente pelo novo domínio. Cookies anteriores pertencem ao endereço antigo; a nova sessão encontra os mesmos registros pelo ID Telegram.
4. Conferir Perfil, totais com `/mes`, edição/exclusão de um lançamento de teste e resposta de `/hoje` com o bot local desligado.

O webhook continua em `https://financeiro-testes-bot.miudo.workers.dev/telegram/webhook`. Não recriar o banco, reimportar registros ou trocar o token do bot durante esta migração. Nome, foto e username do bot são uma etapa separada.

## Retorno ao endereço anterior

Se a integração não passar nas verificações, manter/restaurar `APP_ORIGIN` para o endereço do Worker e o mesmo domínio no BotFather. O Worker preserva os assets anteriores como alternativa; a troca da hospedagem do site não altera as tabelas financeiras. Um rollback da Vercel não troca automaticamente a configuração do Worker ou do Telegram.

## Referências

- [Rewrites para origens externas](https://vercel.com/docs/routing/rewrites)
- [Configuração de rotas e cabeçalhos](https://vercel.com/docs/project-configuration/vercel-json)
- [Login Widget clássico do Telegram](https://core.telegram.org/widgets/login-legacy)
