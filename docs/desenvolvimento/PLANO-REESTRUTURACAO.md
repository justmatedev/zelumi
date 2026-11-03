# Plano de implementação: reestruturação do Zelumi

> **Para execução por agentes:** usar `superpowers:executing-plans` para implementar as tarefas em sequência. Usar `superpowers:subagent-driven-development` somente se o usuário escolher execução com agentes. Os passos abaixo são acompanhados por caixas de seleção.

**Objetivo:** organizar o Zelumi em três aplicações e dois pacotes compartilhados, com instalação única e preservação dos fluxos atuais.

**Arquitetura:** monorepositório com npm workspaces. `apps/web` contém o site; `apps/api`, o Worker e seus adaptadores D1; `apps/bot`, a execução local com SQLite. `packages/finance` reúne regras financeiras e `packages/bot-core` reúne conversas e cliente Telegram.

**Tecnologias:** Node.js >=22.16.0, npm, JavaScript ESM, TypeScript, Next.js, React, Cloudflare Workers/D1, SQLite, Vitest e testes nativos do Node. Preservar as versões atuais durante a migração.

**Especificação:** proposta de três aplicações e dois pacotes aceita pelo usuário na conversa de 02/11/2026, consolidada nas decisões abaixo. Este documento planeja a execução; sua criação não inicia a implementação nem a publicação.

## Resultado da execução local — 02/11/2026

As sete tarefas foram concluídas localmente. Validações: 100 testes de backend/pacotes, 60 de interface, tipos, build/export e dry-run do Worker aprovados. A instalação única com `npm ci` foi validada em cópia limpa sem credenciais; todos os casos de teste anteriores foram preservados. O navegador passou nas 30 combinações das três páginas, dois temas e cinco larguras, incluindo textos longos, valores altos, teclado e preservação da barra entre páginas. Reiniciar manteve registros, identificadores, totais e snapshot do D1 local.

As quatro migrações mantêm os mesmos hashes e as versões resolvidas dos lockfiles anteriores foram preservadas. A revisão independente identificou um fallback de caminho do SQLite introduzido pela movimentação; ele foi restaurado e ganhou teste de regressão com comparação exata dos caminhos.

Na execução inicial, o sandbox manteve `.git` somente para leitura e impediu a criação de branch; a implementação foi concluída no diretório atual. Depois, o usuário solicitou os commits, e o acesso necessário ao Git local foi autorizado para registrar código e documentação em commits separados. Não houve push ou deploy. A Vercel ainda precisa receber a Root Directory `apps/web` e acesso às fontes externas antes da próxima publicação.

## Decisões e limites

- Adotar npm workspaces, com um `package-lock.json` na raiz e `npm ci` como instalação completa.
- Preservar os comandos públicos `dev`, `bot`, `web:dev`, `web:build`, `web:check` e todos os comandos `cf:*`. `npm test` continua cobrindo backend, bot e regras financeiras; acrescentar `web:test` e `check` para a validação completa.
- Manter Node.js >=22.16.0 nos manifestos. Não atualizar dependências como parte desta mudança; reconciliar os dois lockfiles conferindo as versões efetivamente resolvidas.
- Preservar URLs, contratos HTTP, textos, comportamento, aparência, temas e layout compartilhado do painel. O caminho do arquivo pode mudar; a rota pública permanece.
- Não alterar o esquema ou o conteúdo das migrações SQL; não criar migração de banco para reorganizar diretórios.
- Preservar `.env`, `.dev.vars`, `data/` e a persistência `.wrangler/` na raiz. A nova localização de uma configuração não pode redirecionar a leitura do banco ou do ambiente.
- Preservar identificadores de recursos, secrets, domínio, webhook e projetos de hospedagem. Ajustes remotos e publicação são uma etapa posterior à validação local.
- Os componentes visuais continuam no site. Não criar pacote de UI, Turborepo, Nx, contêineres ou ferramenta adicional de build.
- Manter JavaScript e TypeScript nos módulos atuais. Não aproveitar a reorganização para reescrever regras ou converter todo o backend para TypeScript.
- Toda etapa de código termina com verificação e revisão do diff. Se houver commits, registrar somente arquivos da tarefa; não usar staging indiscriminado.

## Alternativas consideradas

1. **Organização gradual:** manter os diretórios principais e melhorar seus interiores. Menor custo de migração, mas a divisão entre aplicações e bibliotecas continua implícita.
2. **Reestruturação completa — escolhida:** `apps/` e `packages/`, com workspaces e organização do site por funcionalidades. Exige ajustar imports, instalação e publicação, mas torna os limites de reutilização explícitos.

## Estrutura final

```text
zelumi/
├── apps/
│   ├── web/
│   │   ├── app/                     # Rotas, layout, fontes e CSS global
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── finance/
│   │   │   └── profile/
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   ├── layout/
│   │   │   ├── brand.tsx
│   │   │   └── theme-provider.tsx
│   │   ├── hooks/                  # Hooks comuns, como use-modal
│   │   ├── lib/                    # Cliente HTTP e utilidades comuns
│   │   ├── public/
│   │   ├── tests/
│   │   ├── AGENTS.md
│   │   └── package.json
│   ├── api/
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   ├── finance/
│   │   │   ├── telegram/
│   │   │   └── worker.mjs
│   │   ├── migrations/
│   │   ├── dev/
│   │   ├── tests/
│   │   ├── package.json
│   │   └── wrangler.jsonc
│   └── bot/
│       ├── src/
│       ├── tests/
│       └── package.json
├── packages/
│   ├── finance/
│   │   ├── src/
│   │   │   ├── server/              # SQL e versões com node:crypto
│   │   │   ├── model.mjs
│   │   │   ├── model.d.mts
│   │   │   ├── parser.mjs
│   │   │   └── categories.mjs
│   │   ├── tests/
│   │   └── package.json
│   └── bot-core/
│       ├── src/
│       │   ├── engine.mjs
│       │   └── telegram.mjs
│       └── package.json
├── scripts/
├── tests/                          # Integração e suporte D1 compartilhado
├── docs/
│   ├── produto/
│   ├── desenvolvimento/
│   ├── infraestrutura/
│   ├── archive/
│   └── DECISOES.md
├── design/
├── data/                           # Privado, ignorado pelo Git
├── AGENTS.md
├── README.md
├── package.json
└── package-lock.json
```

Os diretórios gerados `.wrangler/`, `node_modules/` e as saídas do Next continuam ignorados. Não mover manualmente dependências ou caches para a nova estrutura.

## Contratos entre partes

| Consumidor | Dependências internas permitidas |
| --- | --- |
| `@zelumi/web` | Entradas de `@zelumi/finance` compatíveis com navegador |
| `@zelumi/api` | `@zelumi/finance` e `@zelumi/bot-core` |
| `@zelumi/bot` | `@zelumi/finance` e `@zelumi/bot-core` |
| `@zelumi/bot-core` | Entradas compatíveis com seu runtime de `@zelumi/finance` |
| `@zelumi/finance` | Nenhuma outra aplicação ou pacote interno |

Não permitir imports de uma aplicação para outra. Código compartilhado passa por exports explícitos dos pacotes, sem importar seus diretórios `src` externamente.

Exports de `@zelumi/finance`: `./model` com os tipos atuais de `model.d.mts`, `./parser`, `./categories`, `./server/sql` e `./server/version`. Exports de `@zelumi/bot-core`: `./engine` e `./telegram`. Não criar um barrel que reexporte código de servidor para consumidores do navegador.

Preservar os nomes e contratos públicos existentes: `parse`, `resolve`, `schedule`, `hasExplicitDate`, `validateEdit`, `readStored`, `recordVersion`, `buildProjection`, `handleUpdate`, `localDate`, `createTelegram` e `TelegramError`. A mudança é de endereço de import, não de semântica.

## Pontos prioritários de revisão

1. Instalação limpa: um clone com apenas `npm ci` consegue testar e compilar todas as partes.
2. Navegador: o build resolve os tipos financeiros sem incluir SQL, `node:crypto` ou `node:sqlite` no código do cliente.
3. Desenvolvimento: reiniciar mantém o mesmo D1 fictício e não habilita autenticação de teste na entrada publicada.
4. Hospedagem: a nova raiz do site mantém widget, proxy, cookies, cabeçalhos e arquivos estáticos corretos.
5. Testes: a redistribuição mantém todos os casos existentes sendo descobertos e executados.

## Tarefa 1 — Registrar a base de comparação

**Arquivos:** leitura de `README.md`, `package.json`, `web/package.json`, ambos os lockfiles, configurações, testes e estado do Git. Nenhuma movimentação nesta tarefa.

**Interfaces:** produz uma referência de comandos, versões, migrações e testes antes da mudança.

- [x] Inspecionar `git status --short` e preservar alterações já existentes, incluindo `docs/NOMES-INFRAESTRUTURA.md` se ainda estiver modificado. Verificar se já há isolamento de trabalho; criar uma branch/worktree de implementação quando necessário, sem mover arquivos privados.
- [x] Registrar nomes e quantidade de testes por suíte, versões resolvidas dos dois lockfiles e hashes dos quatro arquivos atuais de `cloudflare/migrations/`.
- [x] Executar `npm test`, `npm run web:build`, `npm --prefix web run typecheck`, `npm --prefix web test` e `npm run cf:check`. Resultado esperado: todos aprovados, com dry-run sem publicação. Registrar falhas preexistentes antes de prosseguir.
- [x] Identificar processos ativos antes de reinstalar dependências ou reiniciar desenvolvimento. Registrar os caminhos absolutos atuais de SQLite, D1 local e certificados sem expor seu conteúdo.

**Entrega verificável:** referência anterior à migração; eventuais falhas preexistentes identificadas.

## Tarefa 2 — Criar workspaces e extrair os pacotes compartilhados

**Arquivos:** criar `packages/finance/package.json`, `packages/bot-core/package.json` e seus `src/`; modificar `package.json`, `package-lock.json`, consumidores em `bot/`, `cloudflare/`, `web/`, `scripts/`, `tests/` e configurações de resolução.

**Interfaces:** produz os exports descritos em “Contratos entre partes”. Durante esta transição, o workspace do site ainda é `web`; será movido na tarefa 4.

- [x] Criar manifests privados ESM chamados `@zelumi/finance` e `@zelumi/bot-core`, versão `0.1.0`, com exports explícitos. Declarar dependências internas com uma versão compatível com os pacotes locais, como `0.1.0`, resolvida pelo npm workspace.
- [x] Mover `finance/model.mjs`, `model.d.mts`, `shared/parser.mjs` e `shared/categories.mjs` para `packages/finance/src/`; mover `finance/sql.mjs` e `version.mjs` para `src/server/`. Corrigir imports internos sem modificar regras financeiras.
- [x] Mover `bot/engine.mjs` e `bot/telegram.mjs` para `packages/bot-core/src/`. Manter `bot/index.mjs` e `bot/store.mjs` na aplicação local por enquanto.
- [x] Substituir todos os imports dos arquivos extraídos pelos exports de pacote. Declarar as dependências onde são consumidas, incluindo a raiz enquanto ela ainda hospedar scripts e backend transitório.
- [x] Configurar inicialmente workspaces `web`, `packages/*`; reconciliar os lockfiles preservando versões. Remover `web/package-lock.json` somente após o lockfile raiz incorporar suas dependências. Conferir se a resolução não introduziu atualizações involuntárias.
- [x] Adaptar consumidores de binários para usar resolução pelo pacote declarado, sem presumir `web/node_modules/next`; conferir `scripts/dev.mjs` e `scripts/cloudflare.mjs`.
- [x] Reexecutar os testes de parser, modelo, bot e backend existentes; rodar `npm run web:check` e `npm run cf:check`. Esperado: mesmos resultados e nenhum import antigo dos módulos extraídos em código ativo.

**Entrega verificável:** pacotes reais usados pelo produto, site ainda em `web/`, versões preservadas e suítes aprovadas.

## Tarefa 3 — Mover API e bot local

**Arquivos:** criar `apps/api/package.json` e `apps/bot/package.json`; mover `cloudflare/`, `dev/`, arquivos restantes de `bot/`, `wrangler.jsonc`; modificar `scripts/*.mjs`, `tests/*.mjs`, `tests/helpers/d1.mjs`, `tests/wrangler.jsonc`, `.gitignore` e scripts npm.

**Interfaces:** produz `@zelumi/api` e `@zelumi/bot`; mantém os comandos raiz e os contratos HTTP existentes.

- [x] Mover `cloudflare/worker.mjs` para `apps/api/src/worker.mjs`; `cloudflare/auth/` e `cloudflare/finance/` para `apps/api/src/`. Mover `store.mjs`, `outbox.mjs` e `bot-binding.mjs` para `apps/api/src/telegram/`, ajustando seus imports.
- [x] Mover `cloudflare/migrations/` para `apps/api/migrations/` sem alterar bytes ou nomes; mover `dev/` para `apps/api/dev/` e a configuração publicada para `apps/api/wrangler.jsonc`.
- [x] Corrigir `main`, schema, `migrations_dir` e assets nas configurações. Nesta etapa os assets ainda apontam para `web/out`; a tarefa 4 muda para `apps/web/out`. O Worker local deve continuar usando sua entrada exclusiva de desenvolvimento.
- [x] Mover `bot/index.mjs` e `bot/store.mjs` para `apps/bot/src/`. Preservar o diretório de trabalho raiz do comando público `npm run bot`, a leitura do `.env` raiz e o padrão `data/zelumi.sqlite`.
- [x] Acrescentar `apps/*` aos workspaces, declarar dependências dos dois apps e adaptar os scripts de manutenção para passar explicitamente a configuração correta em todos os comandos Wrangler. Atualizar também comandos que leem ou reescrevem `wrangler.jsonc`.
- [x] Atualizar launcher, exportador, testes e helper D1. Preservar caminhos absolutos de `.wrangler/local-dev`, `.wrangler/state`, logs, certificados e ambiente; não deixar o novo diretório da configuração escolher outro arquivo `.dev.vars` implicitamente.
- [x] Rodar `npm test`, `npm run web:build` e `npm run cf:check`. Executar o teste local existente para criação de sessão fictícia, acesso a registros e ausência do login de teste no Worker publicado.
- [x] Iniciar o desenvolvimento de forma coordenada com processos existentes, confirmar conta fictícia e `/health`, reiniciar e conferir que os mesmos registros e identificadores continuam disponíveis. Não usar bot Telegram real nessa verificação.

**Entrega verificável:** API e bot nos novos diretórios, com banco local, migrações, autenticação e scripts preservados.

## Tarefa 4 — Mover o site e ajustar o pacote de hospedagem

**Arquivos:** mover `web/` para `apps/web/`; modificar `apps/web/next.config.ts`, `vercel.json`, `tsconfig.json`, `vitest.config.ts`, `components.json`, `scripts/dev.mjs`, `scripts/check-web-export.mjs`, manifests, lockfile, `.gitignore` e `apps/api/wrangler.jsonc`.

**Interfaces:** mantém `@zelumi/web`, URLs e export estático; produz o artefato `apps/web/out/`.

- [x] Ler as instruções de `apps/web/AGENTS.md` e a documentação local da versão instalada do Next antes dos ajustes. Mover rotas, fontes, public, testes e configurações juntos.
- [x] Remover o workspace transitório `web` e atualizar os comandos raiz para selecionar `@zelumi/web`. Preservar `@/*` relativo à raiz da aplicação e corrigir a raiz do Turbopack, que hoje sobe apenas um nível.
- [x] Adaptar launcher, verificador do export e assets do Worker para `apps/web/out`. Atualizar as regras de ignore de `.next`, `.next-local`, `out` e `coverage` para os novos caminhos.
- [x] Preparar `apps/web/vercel.json` para instalar pelo lockfile raiz e executar o build do workspace a partir da raiz correta, incluindo o verificador de export. Preservar integralmente proxy, rotas, variável privada e cabeçalhos atuais. Validar os comandos e a resolução dos pacotes compartilhados antes da publicação.
- [x] Rodar `npm run web:check`, `npm test` e `npm run cf:check`. Confirmar todas as páginas, fontes, símbolo, widget e `_headers` no export verificado.
- [x] Registrar o ajuste remoto pendente da Vercel: Root Directory de `web` para `apps/web`, acesso aos pacotes externos à raiz e instalação com o lockfile único. Não alterar o serviço remoto nesta tarefa.

**Entrega verificável:** site compilando no novo endereço local, integração com o Worker validada e configuração de hospedagem preparada.

## Tarefa 5 — Organizar o site por funcionalidade

**Arquivos:** `apps/web/features/`, `components/`, `hooks/`, `lib/`, `app/`, `tests/`, `design/GUIA-VISUAL.md` e referências de componentes no gerador.

**Interfaces:** preserva exports dos componentes, hooks, props e funções atuais; somente seus caminhos mudam.

- [x] Ler `design/GUIA-VISUAL.md` e manter os estilos globais e tokens em `apps/web/app/`. As rotas continuam leves e o layout `(dashboard)` permanece compartilhado.
- [x] Mover `components/finance/*` para `features/finance/components/`, `hooks/use-finance.ts` para `features/finance/hooks/use-finance.ts` e `lib/finance.ts` para `features/finance/lib/finance.ts`.
- [x] Mover `telegram-login.tsx`, `login-page.tsx`, `local-login.tsx` e `session-provider.tsx` para `features/auth/`. Manter os componentes agrupados em `components/` e o provider em `providers/` dentro da funcionalidade.
- [x] Mover `profile.tsx` para `features/profile/components/profile.tsx`; mover `app-shell.tsx` e `sidebar.tsx` para `components/layout/`. Manter `brand.tsx`, `theme-provider.tsx`, `hooks/use-modal.ts`, `lib/api.ts`, `lib/utils.ts` e os componentes de `ui/` como recursos comuns.
- [x] Atualizar imports, mocks dos testes, aliases do gerador quando necessário e links do guia visual na mesma etapa.
- [x] Rodar `npm run web:check`. Confirmar que todos os testes de interface anteriores foram descobertos, especialmente sessão, consultas, editor, controles, modal e navegação.
- [x] Conferir visualmente temas claro/escuro, teclado, menu móvel, navegação entre páginas, descrições longas e valores altos em 320, 390, 760, 1068 e 1280 px. Esperado: aparência e comportamento preservados.

**Entrega verificável:** organização por funcionalidade sem mudança de produto ou interface.

## Tarefa 6 — Redistribuir testes e consolidar os comandos

**Arquivos:** testes raiz, `apps/api/tests/`, `apps/bot/tests/`, `packages/finance/tests/`, manifests e configurações de testes.

**Interfaces:** `npm test` executa todos os testes não visuais; `npm run web:test` executa Vitest; `npm run check` executa `npm test` e `npm run web:check` sequencialmente. `cf:check` continua sendo a validação adicional do pacote Worker.

- [x] Mover `tests/parser.test.mjs` e `finance-model.test.mjs` para `packages/finance/tests/`; `bot.test.mjs` para `apps/bot/tests/`; `telegram-auth.test.mjs` para `apps/api/tests/`.
- [x] Manter na raiz os testes que atravessam aplicações/adaptadores: `cloudflare`, `web-auth`, `local-dev`, `bot-transition`, `finance-api`, `finance-storage` e `finance-import`. Manter `tests/helpers/d1.mjs` e `tests/wrangler.jsonc` como suporte comum.
- [x] Ajustar caminhos das configurações, fixtures e imports. Configurar `npm test` para executar explicitamente os arquivos `*.test.mjs` desses quatro diretórios, sem varrer dependências, caches ou executar testes duas vezes.
- [x] Declarar scripts locais de teste para apps/pacotes que possuem suítes. Não criar testes artificiais para pacotes sem suíte própria: os testes de bot e integração já exercitam `bot-core`.
- [x] Comparar a lista dos casos com a referência da tarefa 1; nenhum caso pode desaparecer pela mudança de diretório.
- [x] Em checkout temporário limpo da alteração, executar apenas `npm ci`, depois `npm run check` e `npm run cf:check`. Esperado: resolução dos workspaces, tipos, testes e builds aprovados sem instalações individuais. Não apagar dependências ou bancos da sessão ativa para simular esse cenário.

**Entrega verificável:** instalação reproduzível, descoberta completa dos testes e comandos de validação consolidados.

## Tarefa 7 — Reorganizar a documentação e fechar a migração local

**Arquivos:** `README.md`, `AGENTS.md`, `docs/`, `design/*.md` e referências cruzadas em código/configuração.

**Interfaces:** documentação passa a descrever exclusivamente os caminhos e comandos novos, mantendo o histórico explicitamente identificado.

- [x] Mover `docs/BOT.md` e `CATEGORIAS.md` para `docs/produto/`.
- [x] Mover `docs/GITHUB.md`, `INVENTARIO-ARQUIVOS.md` e este plano para `docs/desenvolvimento/`.
- [x] Mover `CLOUDFLARE.md`, `docs/VERCEL.md` e `docs/NOMES-INFRAESTRUTURA.md` para `docs/infraestrutura/`, preservando alterações anteriores do usuário. Manter `docs/DECISOES.md` e `docs/archive/` em seus lugares.
- [x] Atualizar README com mapa do repositório, instalação única, comandos e links. Atualizar as convenções em `AGENTS.md`, referências do guia visual e instruções de hospedagem.
- [x] Nos documentos históricos, manter caminhos antigos quando forem parte do registro e indicar o equivalente atual. Não reescrever resultados históricos de testes como se fossem desta migração.
- [x] Conferir links e usar `rg` para procurar referências ativas aos caminhos antigos. Revisar cada ocorrência, distinguindo instruções atuais de histórico.
- [x] Conferir hashes das migrações contra a referência inicial, revisar o diff e executar `npm run check` e `npm run cf:check` após o último ajuste de código/configuração. Documentação isolada exige apenas consistência e links.
- [x] Entregar o resultado local com verificações executadas, mudanças de configuração remota ainda pendentes e instruções de publicação/retorno. Nenhum teste ou deploy é considerado aprovado apenas por estar listado neste plano.

**Entrega verificável:** código e documentação consistentes, sem perda de migrações, testes, dados ou alterações anteriores.

## Publicação posterior e retorno

A implementação local pode terminar sem publicar. Push para a branch conectada à Vercel também pode iniciar publicação automática; a entrega deve considerar esse efeito antes de integrar a mudança.

Quando houver autorização para publicar:

1. Conferir a documentação oficial vigente de instalação em monorepositórios na Vercel e validar um preview com raiz `apps/web`, lockfile raiz e acesso a `packages/`. Preparar a configuração antes de enviar alterações à branch de produção.
2. Validar no preview páginas, assets, widget, proxy e respostas anônimas. O domínio de preview não é origem autorizada para login real; não ampliar origens para facilitar a validação.
3. Atualizar o projeto Vercel existente e publicar o frontend. Publicar o Worker existente somente pelo fluxo `cf:deploy` já validado; não executar migrações remotas para esta reorganização.
4. Conferir no domínio autorizado login, perfil, lançamentos e operação do bot. Preservar os mesmos recursos e credenciais.

Para retornar, restaurar o commit anterior e a Root Directory `web` na Vercel em conjunto. Se houve publicação do Worker, restaurar sua versão anterior compatível. Banco e webhook permanecem os mesmos; a reorganização não deve depender de transformação de dados.

## Critérios de conclusão

- [x] Três aplicações e dois pacotes nos diretórios definidos, sem imports entre aplicações.
- [x] Um lockfile; instalação completa com `npm ci`; comandos públicos preservados.
- [x] Todos os casos de teste anteriores continuam executados; tipos, export e dry-run aprovados.
- [x] Persistência local preservada e autenticação fictícia restrita ao desenvolvimento.
- [x] Migrações idênticas; recursos remotos, secrets e dados preservados.
- [x] Interface, navegação e rotas sem regressões observadas nas verificações previstas.
- [x] Documentação e links atualizados; pendências de publicação descritas explicitamente.
