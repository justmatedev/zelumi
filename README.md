# Zelumi

O padrão atual de marca e interface está no [Guia visual do Zelumi](./design/GUIA-VISUAL.md), com valores compartilhados em [tokens.css](./web/app/tokens.css). As decisões de produto, stack e telas ficam em [docs/DECISOES.md](./docs/DECISOES.md), que preserva o histórico das aprovações.

Gerenciamento financeiro com registros rápidos pelo Telegram. O bot funciona em Cloudflare Workers + D1; o site usa Next.js, TypeScript, Tailwind e componentes shadcn/ui personalizados. O interpretador do bot usa regras, sem IA.

O guia do [repositório no GitHub](./docs/GITHUB.md) descreve o repositório privado, arquivos incluídos/excluídos e a validação sem credenciais reais.

Os lançamentos usam [13 categorias prontas de despesas e Receitas](./docs/CATEGORIAS.md). O bot reconhece palavras completas e expressões específicas; descrições sem correspondência ou com categorias conflitantes ficam em Outros. A categoria pode ser corrigida no editor do painel.

A configuração do endereço `usezelumi.vercel.app`, com site na Vercel e backend na Cloudflare, está em [docs/VERCEL.md](./docs/VERCEL.md).

## Organização do repositório

Este é um único repositório para o produto inteiro. Ao enviar ao GitHub, use esta pasta como raiz do repositório `zelumi`, incluindo `web`, `bot`, `cloudflare`, `scripts`, `tests` e `docs`.

| Pasta | Conteúdo |
| --- | --- |
| `web/` | Site Next.js: Entrada, Visão geral, Lançamentos, Perfil e componentes |
| `dev/` | Conta fictícia e configuração isolada do desenvolvimento local |
| `bot/` | Conversas, comandos, Telegram API e armazenamento SQLite local |
| `cloudflare/` | Worker, autenticação, API financeira, D1, migrações e fila de respostas |
| `finance/` | Modelo compartilhado, validação, projeções e consultas mensais |
| `tests/` | Testes de backend e do bot; interface em `web/tests/` |
| `scripts/` | Build, verificações, migração local e publicação |
| `docs/` | Decisões e instruções para GitHub; configuração histórica em `archive/` |
| `design/` | Logos escolhidos, fontes e licenças da identidade visual |
| `shared/` | Interpretador de mensagens e cálculo de parcelas usados pelo bot e site |

`.env`, `.dev.vars`, `.wrangler`, `data`, `node_modules`, `.next`, `.next-local` e `web/out` são locais/gerados e ficam fora do Git. Envie os dois `package-lock.json`, `.env.example`, `.dev.vars.example` e as migrações SQL. Credenciais do Wrangler nunca devem ir para o GitHub. Para conferir o conteúdo e preparar novos envios, seguir [docs/GITHUB.md](./docs/GITHUB.md).

## Desenvolver o site localmente

Requisitos: Node.js 22.16 ou superior, npm e OpenSSL (normalmente já disponível no Linux).

Na pasta principal `zelumi`, na primeira vez:

```sh
npm ci
npm --prefix web ci
npm run dev
```

Nas próximas vezes, execute somente `npm run dev`. O comando aplica as migrações locais automaticamente, cria uma conta de teste com cinco lançamentos fictícios no mês do primeiro uso e inicia Next.js e API. Abra **https://localhost:3000** e clique em **Entrar com conta de teste**. Aceite o aviso do certificado autoassinado de desenvolvimento. Use exatamente `localhost`, pois a origem das operações é validada.

Alterações nas telas aparecem ao salvar; alterações da API são recarregadas pelo Wrangler. `Ctrl+C` encerra os dois servidores. Se uma porta estiver ocupada, encerre o servidor anterior; são usadas 3000 (site) e 8788 (API interna).

Esse ambiente usa a configuração `dev/wrangler.jsonc`, um token fictício e o D1 `zelumi-local-demo`, persistido em `.wrangler/local-dev/`. Não requer Telegram, conta Cloudflare nem arquivo `.env`. Os lançamentos podem ser editados/apagados e essas mudanças permanecem após reiniciar. O seed não recria dados apagados; as datas ficam no mês em que ele foi criado. O SQLite do bot, o D1 publicado e o banco usado pelo comando antigo `cf:dev` são separados.

O login de teste pertence a uma entrada Worker exclusiva de desenvolvimento. O build publicado continua estático e usa o login Telegram.

### Verificações

Para conferir uma instalação nova ou regenerar os tipos após limpar os caches:

```sh
npm run web:build
npm --prefix web test
npm test
```

O build inclui a checagem TypeScript e a conferência da exportação. Depois de gerar os tipos, `npm run web:check` reúne tipos, testes de interface e build novamente. Os testes usam bancos locais e Telegram simulado; o emulador D1 precisa poder abrir portas locais.

### Fluxos alternativos

- `npm run web:dev`: inicia somente o Next.js; a API pertence ao Worker e não está disponível nesse servidor isolado.
- `npm run cf:dev`: compila o frontend e serve a exportação junto ao Worker em **https://localhost:8787**, com configuração própria de autenticação. Para preparar esse banco local, executar antes `npm run cf:db:migrate:local`. Esse fluxo é útil para conferir o pacote estático, mas não substitui o modo com conta de teste para ajustar as telas.
- `npm run cf:check`: build e dry-run do Worker, sem publicar.

A configuração de exemplo do fluxo `cf:dev` usa token fictício. Copiá-la não habilita login real pelo Telegram em localhost; essa integração é validada no domínio HTTPS vinculado ao bot.

Na publicação, o site consulta os registros reais da mesma conta Telegram. Visão geral distribui as parcelas pelos meses; editar ou excluir atua sobre a compra inteira, inclusive parcelas anteriores. O desenvolvimento local usa seu próprio D1 fictício.

## Arquivos de variáveis

| Arquivo/local | Uso |
| --- | --- |
| `.env` | Credenciais reais do bot local e dos comandos de manutenção Cloudflare; ignorado pelo Git |
| `.env.example` | Modelo sem credenciais para criar o `.env` |
| `.dev.vars` | Sobrescritas do Worker local; ignorado pelo Git |
| `.dev.vars.example` | Credenciais fictícias para `cf:dev` quando `.dev.vars` não existe |
| `dev/local.env` | Arquivo sem credenciais, usado explicitamente pelo launcher para não carregar o ambiente real |
| Cloudflare Secrets | Token Telegram, segredo do webhook e chave independente do proxy em produção |
| Vercel Environment Variables | Somente `VERCEL_PROXY_SECRET` para o proxy; sem token Telegram ou segredo do webhook |

`VERCEL_PROXY_SECRET` deve ser igual na Vercel e na Cloudflare. Não usar prefixo `NEXT_PUBLIC_`: essa chave pertence ao encaminhamento no servidor, nunca ao JavaScript do navegador. Alterar `.env` sozinho não atualiza os serviços publicados.

## Cloudflare Workers + D1 (opção escolhida)

A versão para nuvem está implementada em `cloudflare/`. Ela usa webhook autenticado, D1 com deduplicação transacional, isolamento por usuário e fila persistente de respostas. O bot local permanece disponível para desenvolvimento.

Siga [CLOUDFLARE.md](./CLOUDFLARE.md) para configuração e manutenção. O banco e o webhook do piloto já existem; atualizações não exigem recriá-los ou reimportar registros. O bot local deve permanecer parado enquanto o webhook estiver ativo.

## Executar localmente no Telegram

Requer **Node.js 22.16 ou superior** (recomendado: 24 ou superior) e acesso à internet. O bot não precisa de dependências npm, domínio ou porta pública: usa long polling. Ele funciona enquanto este processo estiver ligado.

### 1. Criar o bot

1. Abra o [@BotFather oficial](https://t.me/BotFather) no Telegram.
2. Envie `/newbot` e escolha um nome e um username terminado em `bot`.
3. Guarde o token retornado. Ele será usado apenas na configuração local, nunca no navegador ou em mensagens deste chat.

### 2. Configurar e iniciar

No terminal, entre na raiz do projeto e copie o exemplo:

```sh
cp .env.example .env
```

Abra `.env` no editor e preencha `TELEGRAM_BOT_TOKEN` com o token do BotFather. O cadastro é aberto: não é necessário liberar IDs manualmente.

```dotenv
TELEGRAM_BOT_TOKEN=TOKEN_FORNECIDO_PELO_BOTFATHER
BOT_TIMEZONE=America/Sao_Paulo
BOT_DB_PATH=./data/zelumi.sqlite
```

Inicie:

```sh
npm run bot
```

No Telegram, abra o bot que você criou e toque em **Iniciar**. Qualquer pessoa pode começar pela conversa privada, sem aprovação ou cadastro de ID. A identificação é feita pelo Telegram, e cada usuário acessa apenas seus próprios lançamentos. O comando `/id` apenas informa seu identificador, se você quiser consultá-lo.

O token e o banco estão excluídos do Git por `.gitignore`. Não os coloque em `web/public/` nem em `web/out/`.

### 3. Testar na conversa real

```text
Você: pão 10
Bot: Despesa registrada — Pão · R$ 10,00
     [Editar] [Desfazer]

Você: uber
Bot: Qual foi o valor de uber?
Você: 23,50
Bot: Despesa registrada — Uber · R$ 23,50

Você: recebi 200 da venda da cadeira
Bot: Entrada registrada — Cadeira · R$ 200,00

Você: notebook 3000 em 10x
Bot: Total R$ 3.000,00, em 10 parcelas
```

Parcelas: `google 1000 x12` significa R$ 1.000 no total em 12 parcelas; `google 12x 80` significa 12 parcelas de R$ 80, totalizando R$ 960.

Outros testes: `pão 2 10` pede o total; `ontem almoço 35` usa a data de ontem. `video game xbox 360 1500` registra R$ 1.500,00 e preserva o modelo Xbox 360 na descrição; modelos numéricos de iPhone e PlayStation também são reconhecidos. `sorvete 7 04/04/2026` registra R$ 7,00 em 4 de abril de 2026. Datas explícitas usam dia/mês/ano, com ano de quatro dígitos e validação do calendário. Em uma pergunta sobre valor, responda só o total ou use `/cancelar`. As perguntas expiram em 30 minutos e continuam disponíveis após reiniciar dentro desse prazo.

Use **Editar** abaixo do registro e envie a mensagem completa, por exemplo `pão 12,50`. Isso substitui o registro; mantém a data anterior se você não escrever `hoje`, `ontem` ou uma data como `04/04/2026`. Editar a mensagem original pelo próprio Telegram não altera o lançamento. Se quiser corrigir tipo, categoria ou parcelas, descreva novamente a operação; ainda não há editor de campos individuais no bot.

### Comandos

| Comando | Ação |
| --- | --- |
| `/start` ou `/ajuda` | Instruções e exemplos |
| `/id` | Seu identificador no Telegram |
| `/hoje` ou `/resumo` | Entradas, saídas e resultado pela data da compra |
| `/mes` | Receitas, despesas e parcelas deste mês |
| `/ultimos` | Últimos 10 registros com botões de edição e desfazer |
| `/desfazer` | Apaga o último registro criado por você |
| `/cancelar` | Cancela a pergunta ou edição pendente |

Também aceita a consulta `quanto gastei hoje?`. **Comportamento atual:** `/mes` e o site somam as parcelas dos respectivos meses. `/hoje` e `/resumo` usam os valores integrais das compras/receitas cuja data é hoje. A primeira parcela começa no mês da compra por padrão; no site, é possível ajustar o mês inicial. Edição no site atua na compra inteira, incluindo meses anteriores; consulte [as decisões do projeto](./docs/DECISOES.md). Não representam saldo bancário nem fechamento de fatura. O cronograma de parcelas é calculado e salvo, com centavos distribuídos para preservar o total.

### Dados e funcionamento

- Neste modo local, os registros ficam em `data/zelumi.sqlite`, com separação pelo ID do Telegram. Na versão publicada, ficam no D1; o site compartilha a identidade Telegram e consulta os mesmos registros por API autenticada. O SQLite de desenvolvimento local é separado do D1 publicado. O banco local padrão é `zelumi.sqlite`; ele é independente dos dados publicados e começa vazio. Um banco vinculado a outro bot não deve ser reutilizado para o Zelumi.
- Cursor de atualização, alterações financeiras e respostas pendentes são persistidos em uma transação SQLite. Reenvios do mesmo `update_id` não duplicam o lançamento.
- Respostas que falham por rede ou limite de uso ficam na fila para nova tentativa. Uma confirmação pode aparecer duas vezes se o processo cair após enviá-la e antes de confirmar sua entrega localmente; o lançamento financeiro continua único.
- Conversas de grupo são ignoradas. Áudios, imagens, transferências, pagamentos de fatura e lembretes automáticos ainda não estão disponíveis.
- Use uma única instância do processo por bot e banco. O processo local precisa ficar ligado durante o teste. O piloto publicado já recebe mensagens por webhook na Cloudflare, sem manter esse processo local ativo.
- Para backup local consistente, pare o bot com Ctrl+C antes de copiar o arquivo SQLite. O banco contém seus dados financeiros em texto legível pelo processo e por quem tem acesso ao arquivo.

### Se não conectar

- **Token ausente/inválido:** confira `.env` e reinicie o processo. Não envie o token no chat.
- **Código 401/404:** confira o token do bot. Se necessário, substitua-o pelo BotFather.
- **Código 409:** encerre outra instância do mesmo bot; se houver webhook, o programa informa isso e não o remove automaticamente. Prefira criar um bot dedicado ao teste.
- **Sem rede ou código 429:** o bot aguarda e tenta novamente, respeitando `retry_after`.
- **Outro bot no mesmo banco:** configure um caminho de banco diferente, preservando os dados anteriores.

Referência: [Telegram Bot API — getUpdates](https://core.telegram.org/bots/api#getupdates).

## Verificar o código

```sh
npm test
```

Os testes cobrem interpretação de valores e parcelas, persistência após reiniciar, identidade válida, cadastro aberto, isolamento entre usuários, duplicação de updates, edição, desfazer, expiração de perguntas, transações, reenvio de respostas e tratamento de erros sem revelar o token. As chamadas Telegram são simuladas nos testes; a verificação real depende da configuração de um token válido.

## Arquivos principais

- `shared/parser.mjs`: interpretador compartilhado pelo site e pelo bot.
- `bot/engine.mjs`: conversa, comandos, autorização e fluxo de edição.
- `bot/store.mjs`: SQLite, deduplicação e fila de respostas.
- `bot/telegram.mjs`: cliente HTTP da API, com erros sem token.
- `bot/index.mjs`: configuração e processo de long polling.

## Consistência dos lançamentos

A busca não diferencia acentos/maiúsculas e pesquisa todas as parcelas. A primeira consulta pode preparar índices antigos em lotes, sem mostrar totais parciais. Alterações concorrentes entre bot e site pedem revisão da versão atual. Reenvios de edição/exclusão usam chave idempotente; em rede incerta, o site oferece verificar o resultado antes de reenviar. Uma troca de conta encerra editores e limpa consultas da conta anterior. A importação só avança a versão do histórico quando adiciona compras novas e preserva perguntas já pendentes.
