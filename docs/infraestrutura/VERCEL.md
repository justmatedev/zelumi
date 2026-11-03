# Site na Vercel

## Configuração

| Campo | Valor |
| --- | --- |
| Projeto | `zelumi` |
| Site | `https://usezelumi.vercel.app` |
| Root Directory | `apps/web` |
| Instalação | `cd ../.. && npm ci` |
| Build | `cd ../.. && npm run web:build` |
| Saída | `out/`, relativa à aplicação |
| Backend | `https://zelumi-bot.zelumi.workers.dev` |

Habilitar o acesso às fontes fora da Root Directory no build: o site importa `@zelumi/finance` de `packages/finance/` e usa o lockfile da raiz. A configuração de instalação, build, rotas e cabeçalhos está em [apps/web/vercel.json](../../apps/web/vercel.json).

O site usa exportação estática do Next.js. `framework: null` mantém a entrega estática com as rotas explícitas do projeto. Os arquivos finais ficam em `apps/web/out/`.

## Proxy e autenticação

As rotas `/auth` e `/api` são encaminhadas ao Worker, preservando cookies, métodos, corpos e parâmetros. Respostas autenticadas usam `no-store`; assets estáticos recebem os cabeçalhos definidos na configuração.

`VERCEL_PROXY_SECRET` deve existir nas variáveis privadas da Vercel e ter o mesmo valor no Worker. Essa chave identifica o proxy ao separar os limites de login por visitante. Não usar prefixo `NEXT_PUBLIC_`. Token Telegram e segredo do webhook pertencem ao backend.

A origem autorizada do Worker é `https://usezelumi.vercel.app`. O domínio informado ao BotFather para `@zelumi_bot` é `usezelumi.vercel.app`. Endereços de preview não são origens autorizadas para login ou edição em produção.

O arquivo `/telegram-widget.html` é uma ponte isolada para a autorização Telegram. Sua CSP permite o script de `telegram.org` e a conexão com `oauth.telegram.org`; a página principal não carrega esse SDK. Preservar a rota do widget sem normalizações que alterem seu endereço.

## Publicação e verificação

A integração Git publica o frontend ao atualizar a branch conectada. Antes de enviar código, executar na raiz:

```sh
npm run check
npm run cf:check
```

Um preview permite conferir páginas, fontes, marca, widget e encaminhamento das respostas anônimas. O login real deve ser conferido no domínio autorizado, sem ampliar a lista de origens para testar um preview.

Depois do deploy, verificar o estado Ready na Vercel, entrar pelo Telegram e conferir Perfil, lançamentos e totais. Usar um lançamento de teste para conferir edição e exclusão. `/hoje` e `/mes` validam a operação do bot; `/mes` deve ser consistente com as parcelas do mês no site.

O Worker é publicado separadamente, conforme [CLOUDFLARE.md](CLOUDFLARE.md). Alterações nos contratos de autenticação ou API exigem compatibilidade entre frontend e backend. Restaurar uma revisão do site não altera o Worker, o D1, o webhook ou as variáveis do outro serviço.
