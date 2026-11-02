# Zelumi na Cloudflare — site e bot

## Publicação atual

- Worker: `https://financeiro-testes-bot.miudo.workers.dev`
- Saúde/configuração: `https://financeiro-testes-bot.miudo.workers.dev/health`
- D1: `financeiro-testes`, já vinculado em `wrangler.jsonc`.
- Webhook registrado em 02/11/2026. Dois lançamentos locais foram importados.
- Segredos configurados no Worker; valores permanecem fora deste documento.
- Site e autenticação publicados em 02/11/2026, versão `e40e45aa-a2b5-4d95-a19c-4788c9f66ba5`; migração aditiva `0002_web_auth.sql` aplicada.
- Rotas públicas/protegidas e widget oficial conferidos em produção. Teste com a conta Telegram real e `/hoje` após esse deploy aguardam confirmação do usuário. CPU por requisição não foi medida.

O bot local deve permanecer parado enquanto o webhook estiver ativo. As etapas abaixo documentam a configuração e servem para manutenção; não é necessário recriar o banco ou o bot.

## Atualização com site e autenticação

O novo site fica no mesmo endereço do bot. `web/out` contém a exportação Next.js e é servido por Workers Static Assets. `/auth/*`, `/api/*`, `/health` e `/telegram/webhook` passam pelo Worker antes dos assets. Rotas inexistentes da API retornam JSON 404.

Entrada usa o Login Widget clássico oficial, já autorizado pelo `/setdomain` no BotFather. A configuração pública está em `APP_ORIGIN` e `TELEGRAM_BOT_USERNAME`, no `wrangler.jsonc`. O token do bot continua sendo segredo no Worker; não há Client ID/Client Secret nessa integração. O deploy confere que o username corresponde ao token por `getMe`.

Uma migração **aditiva** (`0002_web_auth.sql`) cria perfis, fluxos de login, recibos de uso único, sessões e rate limit. Não altera os lançamentos ou o owner existente. Sessões duram sete dias e usam cookie HttpOnly/Secure; o D1 guarda somente hashes dos tokens. CSRF, origem, validade da assinatura e uso único são verificados no servidor. O widget clássico precisa de `eval` e é carregado em um iframe com CSP própria; essa permissão não é habilitada no painel principal.

Para atualizar o piloto existente, após validar o código:

```sh
npm ci
npm --prefix web ci
npm test
npm run cf:check
npm run cf:versions
npm run cf:db:pending
npm run cf:db:migrate
npm run cf:deploy
```

`cf:check`, `cf:dev` e `cf:deploy` geram o frontend antes de usar o Wrangler. Nenhum dado real nem segredo é necessário no build. O pacote é verificado para impedir inclusão de arquivos privados conhecidos. `cf:deploy` não altera o webhook e não reimporta dados. Os segredos já configurados são preservados; não é necessário repetir `cf:secrets` em cada atualização.

Após publicar, abrir o endereço e entrar pelo Telegram. Conferir nome/username no Perfil, aparência e saída da sessão. Visão geral e Lançamentos mostram conexão pendente; esta entrega não apresenta dados financeiros fictícios como registros da conta. Enviar `/hoje` pelo Telegram com programa local desligado confirma também o bot. Testes automatizados usam D1 local e identidade assinada falsa; não substituem esse teste humano externo.

### Rollback

Antes de publicar, registrar o ID de versão atual retornado por `npm run cf:versions`. Se for necessário voltar, usar Wrangler `rollback ID_DA_VERSAO` com a mesma autenticação local dos scripts. As tabelas novas permanecem no D1; não apagar tabelas nem tentar desfazer a migração de banco. A versão anterior do bot ignora essas tabelas. O rollback de código também restaura os assets da versão selecionada; uma versão anterior ao site continuará atendendo somente o bot. Não trocar o webhook.

A medição de CPU/requisições e de linhas lidas/escritas precisa ser acompanhada no painel Cloudflare após uso real. A implementação não ativa Workers Paid nem comprova folga na franquia apenas pelos testes locais.

O código está preparado para Workers + D1. Nada é publicado por instalar as dependências ou executar os testes. A ativação usa sua própria conta Cloudflare e mantém o mesmo bot Telegram.

## 1. Conta e login

Crie uma conta em https://dash.cloudflare.com/sign-up. Não é necessário contratar um domínio ou plano pago para este teste.

Na pasta `miudo`:

```sh
npm install
npm --prefix web install
npm run cf:login
npm run cf:whoami
```

O login mostra um link no terminal sem abrir o navegador automaticamente. Copie esse link e abra no navegador em que sua conta Cloudflare está conectada (por exemplo, Firefox), mantendo o terminal aberto até concluir a autorização do Wrangler oficial. Não compartilhe credenciais no chat. O projeto guarda a autenticação em `.wrangler/auth`, ignorado pelo Git. Os scripts usam a mesma configuração de login entre os comandos.

## 2. Criar e vincular o D1

```sh
npm run cf:db:create
npm run cf:db:migrate
```

O primeiro comando cria `financeiro-testes` e atualiza o binding `DB` em `wrangler.jsonc`. O identificador `00000000-0000-0000-0000-000000000000` é apenas um marcador local; não é um banco remoto real. Os scripts bloqueiam publicação enquanto ele não for substituído pelo ID retornado pelo serviço. Se o Wrangler solicitar seleção de conta, escolha a sua conta gratuita.

Se a criação informar que já existe um banco com esse nome, encontre seu ID no painel D1 e atualize `database_id` em `wrangler.jsonc`, mantendo um único binding `DB`. Não crie bancos repetidos para contornar erros.

O segundo comando aplica `cloudflare/migrations/0001_initial.sql` ao D1 remoto. Confirme a operação solicitada pelo Wrangler.

## 3. Preservar os registros locais

Se você já cadastrou gastos que deseja manter:

1. Deixe o bot local entregar as respostas pendentes.
2. Pare `npm run bot` com Ctrl+C e mantenha-o parado durante a migração.
3. Execute:

```sh
npm run cf:export-local
npm run cf:db:import
```

O exportador lê o SQLite configurado em `.env`, sem alterar o banco, e cria `data/cloudflare-import.sql`. O arquivo tem dados financeiros e é ignorado pelo Git; não deve ser enviado pelo chat nem incluído em `dist/`.

A importação preserva IDs antigos, lançamentos, perguntas ainda válidas e identificadores de updates já processados. Assim, mensagens que o Telegram reenviar durante a troca não duplicam registros. Ela usa inserções sem sobrescrever registros existentes e é restrita ao mesmo bot. Respostas pendentes impedem a exportação para evitar perda delas.

Se preferir um teste sem registros anteriores, pule esta etapa e mantenha uma cópia do SQLite local.

## 4. Publicar e configurar os segredos

```sh
npm run cf:check
npm run cf:deploy
npm run cf:secrets
```

O deploy informa a URL `https://financeiro-testes-bot.SEUSUBDOMINIO.workers.dev`. Se a Cloudflare pedir um subdomínio workers.dev, escolha um; não é uma compra de domínio.

`cf:secrets` lê o `.env` que já foi configurado para o bot local e envia dois segredos à sua conta Cloudflare pelo stdin do Wrangler, sem colocar valores nos argumentos do terminal:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`

O segredo do webhook é gerado e acrescentado ao `.env` automaticamente se ainda não existir. Ele autentica a origem das chamadas do Telegram. Não o coloque em `wrangler.jsonc`.

O fuso fica em `BOT_TIMEZONE` na seção `vars` de `wrangler.jsonc`; o padrão é `America/Sao_Paulo`. Após mudanças nesse arquivo, publique novamente. Atualizações do `.env` não são sincronizadas automaticamente: para mudar o token ou o segredo do webhook, execute `cf:secrets` novamente. Não há lista de usuários a liberar.

## 5. Trocar o recebimento para webhook

Confirme que o bot local está parado. Usando a URL real retornada pelo deploy:

```sh
npm run cf:activate -- https://financeiro-testes-bot.SEUSUBDOMINIO.workers.dev
npm run cf:webhook:status
```

O primeiro comando confere o Worker e registra o webhook no Telegram com um segredo e `max_connections: 1`. Ele preserva mensagens pendentes. Se já existir outro webhook, interrompe a operação; `--replace-webhook` só deve ser usado após conferir que a troca é desejada.

A partir dessa etapa, não rode `npm run bot` para o mesmo bot: long polling e webhook não funcionam simultaneamente.

No Telegram, teste:

- `pão 10`: salva e confirma.
- `uber`, seguido de `23,50`: pede e recebe o valor.
- **Editar**, **Desfazer**, `/hoje`, `/mes`, `/ultimos`.
- Desligue seu computador e envie outro gasto: o Worker deve continuar respondendo.

A migração só está concluída após uma resposta real ao último teste. O deploy por si só verifica publicação, não o fluxo completo do Telegram.

## Funcionamento e limites

- Worker recebe `POST /telegram/webhook` e rejeita chamadas sem o segredo correto.
- O D1 mantém lançamentos, perguntas e respostas pendentes. Não há dados financeiros na memória permanente do Worker ou no site público.
- Cada update é aplicado com chave única e versão por usuário. Todas as alterações e respostas são gravadas em um lote transacional. Em falha no D1, o endpoint retorna 503 para permitir reenvio pelo Telegram.
- Cada mensagem usa sua data de envio para interpretar hoje/ontem; resumos usam a data atual do fuso configurado. Perguntas expiram 30 minutos depois de serem processadas.
- Consultas de histórico carregam no máximo 10 lançamentos, e resumos são agregados no banco usando índice por usuário e data.
- A resposta é enviada após salvar. Falhas temporárias de envio ficam no D1 e são tentadas por um cron a cada cinco minutos. Por execução, são feitas até 10 entregas; falhas 400/403 são descartadas por serem permanentes ou callbacks expirados.
- Leases na fila evitam duas execuções enviarem simultaneamente a mesma resposta. Se houver queda após o Telegram aceitar uma resposta e antes de confirmá-la no D1, a resposta pode reaparecer; o lançamento não se duplica.
- O cron remove os identificadores de deduplicação com mais de sete dias; não apaga os lançamentos financeiros.
- O endpoint `GET /health` verifica a presença da configuração, sem expor segredos ou dados. Não comprova saúde do D1 ou entrega pelo Telegram.

Comece em **Workers Free** e acompanhe requisições, CPU e leituras/escritas do D1 pelo painel. Não há garantia de caber na franquia apenas por passar no teste local; é necessário medir CPU no ambiente publicado, especialmente o limite gratuito de 10 ms por execução. O projeto não faz upgrade de plano automaticamente. Não ative Workers Paid para concluir o tutorial.

O teste automatizado usa D1 local e chamadas Telegram simuladas. Ele cobre também autenticação do webhook, concorrência, reenvio e rollback; `cf:check` empacota o Worker sem publicar.

Referências: [Workers Free](https://developers.cloudflare.com/workers/platform/pricing/), [D1](https://developers.cloudflare.com/d1/platform/pricing/), [webhooks Telegram](https://core.telegram.org/bots/api#setwebhook).

## Cadastro aberto

O bot aceita novos usuários pela conversa privada, sem liberação manual de IDs. A identificação e os dados continuam vinculados ao remetente Telegram validado; grupos são ignorados e callbacks não acessam registros de outra pessoa. A variável antiga `TELEGRAM_ALLOWED_USER_IDS`, caso ainda exista no ambiente local ou remoto, é ignorada pelo código e não precisa ser preenchida. O login do site segue a mesma política de cadastro automático, com sessão validada no servidor.

A retirada da liberação manual do bot foi publicada em 02/11/2026 na versão `d94ae31f-0d72-4073-b51e-464adffcc8ac`. Os registros não precisaram de migração. A base do site com cadastro aberto foi publicada depois, na versão indicada no topo.
