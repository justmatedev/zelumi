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

A origem autorizada do Worker é `https://usezelumi.vercel.app`. No BotFather, o `@zelumi_bot` precisa ter o login atual habilitado em **Bot Settings → Login Widget/Web Login**, com Client ID `9056845961`. Ativar **Switch to OpenID Connect Login**. Em **Redirect URIs**, cadastrar `https://usezelumi.vercel.app/telegram-widget.html`; em **Trusted Origins**, cadastrar `https://usezelumi.vercel.app`. A biblioteca usa o caminho do iframe como `redirect_uri`. **Native Login** não é necessário para o site. O `/setdomain` do widget legado não substitui essa configuração. Manter o algoritmo padrão **RS256**. Endereços de preview não são origens autorizadas para login ou edição em produção.

O arquivo `/telegram-widget.html` é uma ponte isolada para o SDK atual `https://oauth.telegram.org/js/telegram-login.js?6`. Sua CSP permite script e conexão com `oauth.telegram.org`; a página principal não carrega esse SDK. Preservar a rota do widget sem normalizações que alterem seu endereço. Não definir `Cross-Origin-Opener-Policy: same-origin`: o SDK precisa conversar com o popup.

O botão solicita apenas `openid` e `profile`, sem telefone ou permissão de envio. O fluxo JavaScript retorna `id_token` por `postMessage`; não há troca de código, e **Client Secret não é necessário**. Não confundir Client Secret com o token do bot, nem colocar qualquer um desses segredos no frontend.

Cada clique gera um nonce criptográfico de 256 bits antes de abrir o popup, mantendo o gesto do navegador. `/auth/telegram/start` recebe `{nonce}`, armazena seu hash no fluxo D1 vinculado ao cookie protegido e o devolve como `csrfToken`. Tentativas canceladas reutilizam o fluxo enquanto válido; montar a página não cria uma tentativa. `/auth/telegram/callback` recebe somente `{idToken}` com o cookie e o cabeçalho CSRF. O Worker verifica assinatura RS256 com as [chaves públicas oficiais](https://oauth.telegram.org/.well-known/jwks.json), emissor, destinatário, expiração, idade máxima de cinco minutos (tolerância de 30 segundos) e nonce. As chaves têm cache de dez minutos, atualização para chave desconhecida limitada a 30 segundos e consulta com timeout de cinco segundos. Falha ao consultar chaves é indisponibilidade; nunca autorizar com dados não verificados.

A claim assinada `id`, solicitada com `profile`, continua sendo o identificador dos registros financeiros. Não usar o `sub` OIDC como ID do bot nem confiar no objeto `user` decodificado pelo navegador. Sessões existentes e dados permanecem no mesmo banco; não é necessária migração SQL. O recibo transacional impede consumir duas vezes a mesma autorização. O callback não aceita o payload HMAC do widget legado.

Referência: [Telegram Login atual](https://core.telegram.org/bots/telegram-login).

## Publicação e verificação

A integração Git publica o frontend ao atualizar a branch conectada. Antes de enviar código, executar na raiz:

```sh
npm run check
npm run cf:check
```

Um preview permite conferir páginas, fontes, marca, widget e encaminhamento das respostas anônimas. O login real deve ser conferido no domínio autorizado, sem ampliar a lista de origens para testar um preview. Confirmar antes Redirect URIs, Trusted Origins e Client ID no BotFather. Publicar o Worker e o site na mesma janela de manutenção: os contratos de início/callback mudaram juntos, e páginas abertas com o cliente anterior precisam ser recarregadas. Testes locais simulam o Telegram; a validação real exige uma autorização nova no celular, além de conferir as sessões existentes.

Depois do deploy, verificar o estado Ready na Vercel, entrar pelo Telegram e conferir Perfil, lançamentos e totais. Usar um lançamento de teste para conferir edição e exclusão. `/hoje` e `/mes` validam a operação do bot; `/mes` deve ser consistente com as parcelas do mês no site.

O Worker é publicado separadamente, conforme [CLOUDFLARE.md](CLOUDFLARE.md). Alterações nos contratos de autenticação ou API exigem compatibilidade entre frontend e backend. Restaurar uma revisão do site não altera o Worker, o D1, o webhook ou as variáveis do outro serviço.
