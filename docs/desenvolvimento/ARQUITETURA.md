# Arquitetura do Zelumi

O produto usa um monorepositório com npm workspaces, três aplicações e dois pacotes privados. Requisitos: Node.js >=22.16.0, npm e OpenSSL para o HTTPS local. Instalar tudo na raiz com `npm ci`; somente o lockfile raiz é versionado.

## Aplicações e pacotes

| Parte | Responsabilidade |
| --- | --- |
| [apps/web](../../apps/web/) — `@zelumi/web` | Site Next.js, rotas, interface, estado de sessão e cliente HTTP |
| [apps/api](../../apps/api/) — `@zelumi/api` | Worker, autenticação, API financeira, D1, webhook e fila de respostas |
| [apps/bot](../../apps/bot/) — `@zelumi/bot` | Inicialização por long polling e adaptador SQLite do bot local |
| [packages/finance](../../packages/finance/) — `@zelumi/finance` | Categorias, parser, parcelas, validação e modelo financeiro |
| [packages/bot-core](../../packages/bot-core/) — `@zelumi/bot-core` | Conversas, comandos e cliente Telegram usados pelo bot local e Worker |

Aplicações não importam código umas das outras. Testes de integração e ferramentas de desenvolvimento podem conectar essas partes. `bot-core` depende de `finance`; `finance` não depende de outro módulo interno.

## Imports compartilhados

Usar exports públicos: `@zelumi/finance/model`, `/parser` e `/categories`. O modelo mantém seus tipos em `model.d.mts`. SQL e versões de registros são exclusivos de servidor, acessados por `@zelumi/finance/server/sql` e `/server/version`; não importá-los no site.

O bot e o Worker usam `@zelumi/bot-core/engine` e `/telegram`. Não importar arquivos de `packages/*/src` por caminhos relativos externos nem criar um barrel que misture código de navegador e servidor.

## Organização do site

`app/` contém rotas, fontes, estilos globais, tokens e o layout compartilhado do painel. `features/auth`, `features/finance` e `features/profile` aproximam componentes, hooks e funções da funcionalidade que os utiliza.

`components/ui` contém os controles comuns; `components/layout`, a navegação e a estrutura do painel. Marca, tema, hooks de modal, cliente HTTP e utilidades comuns continuam fora das funcionalidades. Seguir o [guia visual](../../design/GUIA-VISUAL.md).

## Comandos na raiz

| Comando | Resultado |
| --- | --- |
| `npm ci` | Instala todas as aplicações e liga os pacotes locais |
| `npm run dev` | API fictícia e site em `https://localhost:3000` |
| `npm run bot` | Bot local com `.env` e SQLite da raiz |
| `npm test` | Regras financeiras, bot, autenticação e integração D1 |
| `npm run web:test` | Testes da interface |
| `npm run web:build` | Build estático e verificação de `apps/web/out` |
| `npm run web:check` | Build/export, tipos e testes da interface |
| `npm run check` | Testes de backend e `web:check` |
| `npm run cf:check` | Build do site e dry-run do Worker, sem publicar |

Os demais comandos `cf:*` continuam disponíveis. Os testes específicos também podem ser executados por workspace, por exemplo `npm test --workspace @zelumi/finance`. A integração entre adaptadores permanece em `tests/` na raiz.

## Configuração e dados locais

A configuração publicada é [apps/api/wrangler.jsonc](../../apps/api/wrangler.jsonc); as migrações ficam em [apps/api/migrations](../../apps/api/migrations/). O ambiente fictício tem configuração e entrada próprias em `apps/api/dev/`; a entrada de produção não importa o login local.

`.env`, `.dev.vars`, `data/` e `.wrangler/` permanecem na raiz. `npm run dev` preserva o D1 em `.wrangler/local-dev/`, incluindo certificados. O fluxo alternativo `cf:dev` usa `.wrangler/state/`. O SQLite local padrão permanece `data/zelumi.sqlite`.

Não usar um caminho relativo ao diretório da nova configuração para escolher bancos existentes. Os scripts raiz fixam os caminhos de ambiente e persistência; dados e credenciais ficam fora do Git.

## Publicação

A reorganização local não altera os recursos remotos. A Vercel precisa de Root Directory `apps/web`, acesso às fontes fora dessa raiz e instalação pelo lockfile raiz. Esse ajuste deve ocorrer antes de integrar à branch que dispara publicação. Consultar o [guia da Vercel](../infraestrutura/VERCEL.md) e o [guia Cloudflare](../infraestrutura/CLOUDFLARE.md).

O [plano de reestruturação](PLANO-REESTRUTURACAO.md) registra a sequência e os critérios da migração. [DECISOES.md](../DECISOES.md) e o [inventário](INVENTARIO-ARQUIVOS.md) preservam os registros históricos.
