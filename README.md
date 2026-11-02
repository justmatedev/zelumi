# Zelumi

As decisões de produto, stack, telas e identidade visual estão em [docs/DECISOES.md](./docs/DECISOES.md). Esse registro distingue o que já funciona do que foi aprovado para implementação.

Gerenciamento financeiro com registros rápidos pelo Telegram. O bot funciona em Cloudflare Workers + D1; o novo site usa Next.js, TypeScript, Tailwind e componentes shadcn/ui personalizados. O interpretador do bot usa regras, sem IA.

## Organização do repositório

Este é um único repositório para o produto inteiro. Ao enviar ao GitHub, use esta pasta como raiz do repositório `zelumi`, incluindo `web`, `bot`, `cloudflare`, `scripts`, `tests` e `docs`.

| Pasta | Conteúdo |
| --- | --- |
| `web/` | Novo site Next.js: Entrada, Perfil, temas e estrutura das telas financeiras |
| `bot/` | Conversas, comandos, Telegram API e armazenamento SQLite local |
| `cloudflare/` | Worker, autenticação, D1, migrações e fila de respostas |
| `tests/` | Testes de backend e do bot; interface em `web/tests/` |
| `scripts/` | Build, verificações, migração local e publicação |
| `docs/` | Decisões, desenho técnico e plano |
| `design/` | Estudos visuais e identidade da marca |
| `dist/` | Protótipo antigo e interpretador compartilhado pelo bot; não apagar |

`.env`, `.dev.vars`, `.wrangler`, `data`, `node_modules`, `.next` e `web/out` são locais/gerados e ficam fora do Git. Envie os dois `package-lock.json`, `.env.example`, `.dev.vars.example` e as migrações SQL. Credenciais do Wrangler nunca devem ir para o GitHub. O projeto não foi enviado a um repositório remoto nesta etapa.

## Novo site: desenvolvimento

Requer Node.js >=22.16.0 e npm. Instale os dois pacotes:

```sh
npm ci
npm --prefix web ci
npm run web:check
```

`npm run web:dev` oferece desenvolvimento visual com Next.js; a API de autenticação pertence ao Worker e não estará disponível nesse servidor isolado. Para executar site + API no mesmo endereço local:

```sh
cp .dev.vars.example .dev.vars
npm run web:build
npm run cf:db:migrate:local
npm run cf:dev
```

O Wrangler usa HTTPS em `https://localhost:8787` (pode ser necessário aceitar o certificado local). A configuração de exemplo usa credenciais falsas e banco local, sem acessar registros da produção. O login real do Telegram deve ser testado no domínio HTTPS vinculado no BotFather; copiar o exemplo não autoriza localhost.

Nesta primeira entrega do site, Entrada e Perfil usam autenticação real; Visão geral e Lançamentos informam que a conexão dos dados está em preparação. Os registros financeiros reais continuam no bot. O exemplo “pão 10” da entrada é somente ilustrativo.

Verificações: `npm test` (backend, SQLite e D1 local), `npm --prefix web test` (interface), `npm run web:check` (tipos, interface, build e export) e `npm run cf:check` (build e dry-run do Worker). Os testes não enviam mensagens ao Telegram real. O emulador D1 precisa poder abrir portas locais.

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

No terminal, entre nesta pasta e copie o exemplo:

```sh
cd miudo
cp .env.example .env
```

Se o terminal já estiver em `miudo`, execute apenas o segundo comando. Abra `.env` no editor e preencha `TELEGRAM_BOT_TOKEN` com o token do BotFather. O cadastro é aberto: não é necessário liberar IDs manualmente.

```dotenv
TELEGRAM_BOT_TOKEN=TOKEN_FORNECIDO_PELO_BOTFATHER
BOT_TIMEZONE=America/Sao_Paulo
BOT_DB_PATH=./data/miudo.sqlite
```

Inicie:

```sh
npm run bot
```

No Telegram, abra o bot que você criou e toque em **Iniciar**. Qualquer pessoa pode começar pela conversa privada, sem aprovação ou cadastro de ID. A identificação é feita pelo Telegram, e cada usuário acessa apenas seus próprios lançamentos. O comando `/id` apenas informa seu identificador, se você quiser consultá-lo.

O token e o banco estão excluídos do Git por `.gitignore`. Não os coloque na pasta pública `dist/`.

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

Outros testes: `pão 2 10` pede o total; `ontem almoço 35` usa a data de ontem. Em uma pergunta sobre valor, responda só o total ou use `/cancelar`. As perguntas expiram em 30 minutos e continuam disponíveis após reiniciar dentro desse prazo.

Use **Editar** abaixo do registro e envie a mensagem completa, por exemplo `pão 12,50`. Isso substitui o registro; mantém a data anterior se você não escrever `hoje` ou `ontem`. Editar a mensagem original pelo próprio Telegram não altera o lançamento. Se quiser corrigir tipo, categoria ou parcelas, descreva novamente a operação; ainda não há editor de campos individuais no bot.

### Comandos

| Comando | Ação |
| --- | --- |
| `/start` ou `/ajuda` | Instruções e exemplos |
| `/id` | Seu identificador no Telegram |
| `/hoje` ou `/resumo` | Entradas, saídas e saldo dos lançamentos de hoje |
| `/mes` | Resumo deste mês |
| `/ultimos` | Últimos 10 registros com botões de edição e desfazer |
| `/desfazer` | Apaga o último registro criado por você |
| `/cancelar` | Cancela a pergunta ou edição pendente |

Também aceita a consulta `quanto gastei hoje?`. **Comportamento atual:** os resumos contam compras parceladas pelo valor total na data da compra. A distribuição por mês das parcelas foi aprovada e está pendente de implementação; consulte [as decisões do projeto](./docs/DECISOES.md#regra-aprovada-de-compras-parceladas--implementação-pendente). Não representam saldo bancário nem fechamento de fatura. O cronograma de parcelas é calculado e salvo, com centavos distribuídos para preservar o total.

### Dados e funcionamento

- Neste modo local, os registros ficam em `data/miudo.sqlite`, com separação pelo ID do Telegram. Na versão publicada, ficam no D1; o novo site compartilha a identidade Telegram, mas a leitura de lançamentos ainda não está conectada.
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

## Executar o site de teste

```sh
npm start
```

Acesse http://localhost:4173. Essa tela simula a conversa e mantém os dados no localStorage. Inclui resumo, edição, desfazer e exportação CSV. O bot Telegram roda separadamente com `npm run bot`.

## Verificar o código

```sh
npm test
```

Os testes cobrem interpretação de valores e parcelas, persistência após reiniciar, identidade válida, cadastro aberto, isolamento entre usuários, duplicação de updates, edição, desfazer, expiração de perguntas, transações, reenvio de respostas e tratamento de erros sem revelar o token. As chamadas Telegram são simuladas nos testes; a verificação real depende da configuração de um token válido.

## Arquivos principais

- `dist/parser.mjs`: interpretador compartilhado pelo site e pelo bot.
- `bot/engine.mjs`: conversa, comandos, autorização e fluxo de edição.
- `bot/store.mjs`: SQLite, deduplicação e fila de respostas.
- `bot/telegram.mjs`: cliente HTTP da API, com erros sem token.
- `bot/index.mjs`: configuração e processo de long polling.
