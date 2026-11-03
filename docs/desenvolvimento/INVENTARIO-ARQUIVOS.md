# Varredura dos arquivos do Zelumi

> Inventário histórico anterior à reestruturação em workspaces. Caminhos e tamanhos abaixo correspondem à varredura original; consulte a [arquitetura atual](ARQUITETURA.md) para os novos diretórios e a instalação única.

Data: 02/11/2026. Esta revisão classifica o que manter, o que é regenerável e o que pode ser arquivado. Nenhum arquivo foi excluído durante a varredura inicial. A limpeza posterior aprovada está registrada na seção 8.

## Resultado

Não foi identificado arquivo de código-fonte comprovadamente órfão nem dependência direta claramente dispensável. O principal volume está em dependências e arquivos gerados, já ignorados pelo Git. A retirada deles recupera espaço local, mas não simplifica o código versionado.

Há quatro planos internos dispensáveis para a execução e documentação histórica que precisa ser reconciliada com os ajustes recentes. Bancos, backups, ambiente e autenticação não entram em limpeza automática.

## 1. Manter: aplicação, configuração e testes

| Grupo | Motivo |
| --- | --- |
| `web/app/`, `web/components/`, `web/hooks/`, `web/lib/` | Interface atual, layout compartilhado, estilos, tokens, consultas e sessão |
| `web/public/` | Favicon, widget isolado e cabeçalhos dos assets |
| `bot/` | Execução local do bot e lógica também reutilizada pelo Worker |
| `cloudflare/` | API, autenticação, bot em nuvem, armazenamento e respostas |
| `cloudflare/migrations/` | Histórico necessário para criar e atualizar o banco; migração aplicada não é arquivo inútil |
| `finance/` e `shared/` | Regras e interpretador compartilhados entre bot, API, interface e testes |
| `dev/` sem seus caches | Conta de demonstração, entrada Worker separada, configuração local e valores fictícios |
| `scripts/` | Todos os scripts atuais têm comandos npm ou consumidores identificados |
| `tests/` e `web/tests/` | Validação do backend, banco, autenticação, interface e navegação |
| Os dois `package.json` e `package-lock.json` | Dois pacotes instalados separadamente pelo fluxo atual; preservar versões reproduzíveis |
| `wrangler.jsonc`, `web/vercel.json`, `dev/wrangler.jsonc`, `tests/wrangler.jsonc` | Configurações de ambientes diferentes, não cópias redundantes |
| `web/next.config.ts`, `web/postcss.config.mjs`, `web/tsconfig.json`, `web/vitest.config.ts` | Descobertos pelas próprias ferramentas, mesmo sem imports explícitos |
| `web/next-env.d.ts` | Arquivo gerado que participa da configuração TypeScript atual; não confundir com uma pasta de cache independente |
| `.gitignore`, `.gitattributes`, `.env.example`, `.dev.vars.example` | Exclusões, normalização e exemplos sem credenciais reais |
| `AGENTS.md` e `web/AGENTS.md` | Convenções do projeto e instruções específicas do framework; escopos diferentes |

### Arquivos que parecem dispensáveis, mas não são

- `finance/model.d.mts`: os tipos são resolvidos implicitamente pelos imports de `model.mjs`.
- `react-dom` e seus tipos: dependências/peers do framework e das ferramentas de teste, mesmo sem import nos componentes.
- Os arquivos `store.mjs` em pastas diferentes: são adaptadores de bot, autenticação e finanças; não são a mesma implementação repetida.
- `web/public/_headers`: é exigido pela verificação do export e serve aos assets Cloudflare. A configuração Vercel tem papel separado.
- Os arquivos novos dentro de `web/app/(dashboard)/`: substituem as páginas antigas e preservam a barra ao navegar. Não apagar por aparecerem como novos no Git.

## 2. Manter: identidade, documentação útil e recuperação

| Grupo | Classificação |
| --- | --- |
| `design/GUIA-VISUAL.md`, `design/AUDITORIA-VISUAL.md`, `design/README.md` | Referências atuais de identidade e aplicação |
| `design/auditoria/2026-11-02/` | Capturas vinculadas ao relatório, cerca de 372 KB; documentação, não arquivos descartáveis soltos |
| `design/zelumi/conceitos/` | Exportações escolhidas de logo e símbolo, nos dois temas |
| `design/zelumi/telegram/` | Avatares finais documentados |
| Fontes e licenças em `design/zelumi/fonts/` e `web/app/fonts/` | Originais de design e cópias usadas pelo build; duplicação intencional |
| `README.md`, `docs/DECISOES.md`, `CLOUDFLARE.md`, `docs/VERCEL.md`, `docs/BOT.md` | Desenvolvimento, decisões, publicação e recuperação operacional |
| `docs/archive/sites-hosting.json` | Histórico do protótipo já arquivado e referenciado; não é configuração ativa. Benefício mínimo em apagá-lo |
| `.git/` | Histórico e estado do trabalho; não é cache de aplicação |

Foram encontradas cinco duplicações exatas entre fontes/assets: símbolo claro e favicon; duas fontes; duas licenças. Todas têm justificativa de origem/distribuição. Não há recomendação de apagá-las sem reorganizar também seus consumidores e referências.

## 3. Regeneráveis: candidatos a liberar espaço local

Tamanhos aproximados observados antes da limpeza; podem crescer com o uso. O estado após a aprovação está na seção 8.

| Caminho | Tamanho | Condição de limpeza |
| --- | --- | --- |
| `node_modules/` | 216 MB | Reinstalar com `npm ci`; afeta comandos do bot/Worker/testes enquanto ausente |
| `web/node_modules/` | 513 MB | Reinstalar com `npm --prefix web ci`; afeta o site enquanto ausente |
| `web/.next/` | 178 MB | Build/cache do Next; regenerar com `npm run web:build` |
| `web/.next-local/` | 218 MB | Cache do desenvolvimento atual; encerrar o servidor antes de remover |
| `web/out/` | 2 MB | Exportação estática; regenerar antes de usar/publicar os assets |
| `build/` | 180 KB | Saída gerada de verificações do Worker |
| `web/tsconfig.tsbuildinfo` | 236 KB | Cache incremental do TypeScript |
| `.wrangler/logs/` | 1,6 MB | Logs operacionais antigos, após conferir se ainda são necessários ao diagnóstico |
| `dev/.wrangler/` | 212 KB | Foram observados artefatos temporários do Wrangler; conferir o conteúdo e encerrar o servidor antes de limpar |

Somente dependências e diretórios gerados do Next/export/build somam aproximadamente **1,1 GiB** regenerável. Eles já estão fora do Git. Não é necessário removê-los para manter o repositório organizado.

Depois de limpar `.next`, gerar novamente os arquivos antes de depender da checagem de tipos: o `next-env.d.ts` atual referencia tipos gerados. O caminho conhecido para regeneração é `npm run web:build`.

Não remover pastas internas isoladas de `node_modules` para tentar podar dependências: os lockfiles e o npm controlam essa árvore.

## 4. Proteger: não tratar como cache

| Caminho/grupo | Motivo |
| --- | --- |
| `data/` — cerca de 392 KB | Bancos locais, exportações e backups de transição |
| `.wrangler/state/` — cerca de 1,9 MB | Banco persistido do ambiente local anterior |
| `.wrangler/local-dev/` — cerca de 9,8 MB | D1 persistido da conta de teste e certificados do ambiente local |
| `.wrangler/auth/` — cerca de 68 MB | Autenticação/ferramentas de login; não é equivalente aos logs |
| Arquivos locais de ambiente e cópias de recuperação | Credenciais e suporte a recuperação; manter fora do Git |

A pasta `.wrangler/` inteira tem aproximadamente 81 MB, mas mistura autenticação, estado, certificados, logs e temporários. **Não recomendar sua exclusão completa.** Estar no `.gitignore` não significa ser inútil.

A inspeção de arquivos de ambiente, bancos e autenticação ficou restrita a presença/tamanho; seus conteúdos e credenciais não foram lidos para esta varredura.

## 5. Materiais de execução avaliados para retirada

### Planos internos recentes

Estes quatro arquivos não são usados pela aplicação nem pelo build:

- `docs/superpowers/plans/2026-11-02-local-dev.md`
- `docs/superpowers/plans/2026-11-02-sidebar.md`
- `docs/superpowers/plans/2026-11-02-identidade-visual.md`
- `docs/superpowers/plans/2026-11-02-auditoria-visual.md`

Eram notas de execução reintroduzidas durante os ajustes recentes; a retirada aprovada foi concluída conforme a seção 8. `docs/DECISOES.md` e `docs/GITHUB.md` registram que planos auxiliares haviam sido retirados por preferência do usuário. A recomendação é retirar esses planos do conjunto permanente após preservar qualquer decisão exclusiva no README, guia, relatório e registro de decisões. O ganho é organização, não espaço.

### Materiais locais de trabalho

`.superpowers/` ocupa cerca de 1,9 MB e guarda estudos, notas, briefs e registros de ferramentas. Não participa da execução do produto e já está ignorado. Pode ser arquivado ou limpo após conferir se há trabalho ou registros ainda úteis. Não foi tratado como fonte descartável automaticamente, pois é material local sem garantia de recuperação pelo Git.

### Ferramenta opcional

`web/components.json` configura o gerador shadcn/ui. Não participa da execução ou build atuais, mas preserva o fluxo de manutenção declarado pelo projeto. Só remover se esse gerador for abandonado; manter por enquanto tem custo desprezível.

## 6. Ajustes de documentação identificados e concluídos

- O README foi unificado: `npm run dev` é a orientação principal e `cf:dev` permanece como alternativa documentada.
- `docs/GITHUB.md` passou a distinguir as capturas oficiais da auditoria dos estudos antigos e descreve o ambiente local atual.
- As decisões dos planos retirados foram preservadas no README, guia, auditoria e registro de decisões.

## 7. Estado do Git no início da varredura

- 117 caminhos rastreados; 114 ainda existentes e três caminhos antigos de páginas marcados como removidos.
- 29 arquivos novos não rastreados, antes deste inventário, incluindo código necessário, tokens, testes e documentação.
- As três páginas antigas foram movidas para o grupo `(dashboard)`; a indicação de remoção não significa perda da funcionalidade.
- Alterações não consolidadas não devem ser apagadas com comandos de restauração/limpeza genéricos.

Na etapa inicial de inventário, nenhuma exclusão, alteração de dependência, reinstalação ou limpeza de cache foi executada. A verificação foi por inventário, tamanhos, hashes de fontes/assets não privados, imports, scripts e referências; não exigiu executar testes ou build porque o código da aplicação não foi alterado.


## 8. Limpeza executada após aprovação

O usuário aprovou as recomendações. Foram preservadas as decisões úteis nos documentos permanentes antes de retirar as notas de execução.

- Quatro planos de `docs/superpowers/plans/` removidos do conjunto permanente.
- `.superpowers/` antigo e 172 logs antigos arquivados e retirados dos caminhos originais; cinco logs recentes preservados no momento da seleção.
- Removidos `web/.next/cache/`, `web/.next/dev/`, `build/` e `web/tsconfig.tsbuildinfo`, todos separados do servidor ativo.
- Dependências instaladas, `.next-local/`, `web/out/` e temporários do Wrangler ativo mantidos para evitar reinstalação ou interrupção do desenvolvimento.
- README unificado em torno de `npm run dev`; guia GitHub atualizado para o conteúdo e os comandos atuais.

Arquivo privado de recuperação: `data/manutencao/2026-11-02-limpeza-notas-logs.tar.gz`. Permissão do arquivo: somente o proprietário. Ele guarda as notas/logs retirados, está dentro de `data/` ignorada pelo Git e não deve ser publicado.

Liberação líquida medida nos itens selecionados, descontando o arquivo de recuperação e os caches recriados pela verificação: **169.6 MiB**. A limpeza não tentou retirar todos os diretórios regeneráveis: dependências e caches em uso continuam necessários para o trabalho local.

Validação final: hashes de 110 arquivos de código/configuração preservados; 19 arquivos de dados/ambiente monitorados sem alteração; links locais válidos; checagem TypeScript e 33 testes de interface aprovados. O site respondeu 200, a API anônima de sessão respondeu 401 esperado e a saúde do Worker respondeu 200. O cache incremental do TypeScript foi recriado pela checagem, como esperado.

## 9. Consolidação de nomes

Os artefatos privados da transição, o SQLite anterior, as credenciais desativadas e o arquivo de manutenção foram movidos para `../zelumi-backups/`, fora do projeto, com acesso restrito ao proprietário. A descrição da seção 8 registra o local original do arquivo de recuperação; sua localização atual está no backup externo. O guia do bot atual é `docs/BOT.md`. O banco local padrão agora é `data/zelumi.sqlite`, independente do banco publicado. A migração autorizada dos identificadores remotos para Zelumi está descrita em `docs/NOMES-INFRAESTRUTURA.md`; a publicação do proxy atualizado na Vercel ainda exige a revisão correspondente.
