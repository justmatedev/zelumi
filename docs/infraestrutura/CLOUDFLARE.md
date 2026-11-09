# Backend e bot na Cloudflare

## Configuração

| Recurso | Valor |
| --- | --- |
| Worker | `zelumi-bot` |
| Backend | `https://zelumi-bot.zelumi.workers.dev` |
| Saúde | `https://zelumi-bot.zelumi.workers.dev/health` |
| Webhook | `https://zelumi-bot.zelumi.workers.dev/telegram/webhook` |
| D1 | `zelumi`, binding `DB` |
| Bot Telegram | `@zelumi_bot` |
| Origem autorizada | `https://usezelumi.vercel.app` |
| Fuso | `America/Sao_Paulo` |

A configuração está em [apps/api/wrangler.jsonc](../../apps/api/wrangler.jsonc). O Worker atende autenticação, API financeira, webhook e fila de respostas. O site fica na [Vercel](VERCEL.md), que encaminha `/auth` e `/api` ao backend. O Worker também recebe os arquivos estáticos de `apps/web/out/`.

As migrações SQL em [apps/api/migrations/](../../apps/api/migrations/) são necessárias para criar e atualizar o esquema do D1. Preservar seus arquivos e a verificação de identidade do bot vinculada ao banco.

## Acesso e variáveis

Executar os comandos na raiz do projeto:

```sh
npm ci
npm run cf:login
npm run cf:whoami
```

`cf:login` mostra o link de autorização no terminal. A autenticação local do Wrangler fica em `.wrangler/auth/`, fora do Git.

O arquivo `.env`, criado a partir de `.env.example`, fornece as credenciais aos scripts de manutenção. Os segredos do Worker são:

- `TELEGRAM_BOT_TOKEN`: token do bot.
- `TELEGRAM_WEBHOOK_SECRET`: autenticação do webhook.
- `VERCEL_PROXY_SECRET`: identificação do proxy Vercel; deve ter o mesmo valor nos dois serviços.

`APP_ORIGIN`, `TELEGRAM_BOT_USERNAME` e `BOT_TIMEZONE` ficam na seção `vars` da configuração. O deploy confere se o username corresponde ao token por `getMe`.

Para cadastrar ou atualizar segredos a partir do `.env`, usar `npm run cf:secrets`. O script gera o segredo do webhook se estiver ausente e inclui o segredo do proxy quando ele estiver definido. Alterar `.env` não sincroniza os serviços automaticamente; não é necessário reenviar segredos em toda publicação.

## Publicar

```sh
npm run check
npm run cf:check
npm run cf:versions
npm run cf:db:pending
```

`cf:check` gera o site, verifica a exportação e executa um dry-run do Worker, sem publicar. O build não requer credenciais reais do Telegram.

Se houver migrações de esquema pendentes para a revisão que será publicada, aplicá-las antes do deploy:

```sh
npm run cf:db:migrate
```

Publicar o backend:

```sh
npm run cf:deploy
```

O deploy recompila o site, preserva os segredos cadastrados e não registra o webhook nem importa dados. Um push ao GitHub não publica o Worker.

Após publicar, conferir `/health`, login no domínio autorizado, Perfil e lançamentos, além de `/hoje` e `/mes` no Telegram. O login deve encontrar os registros da mesma identidade Telegram. Para conferir escrita, usar um lançamento de teste identificado pelo próprio usuário.

## Webhook e operação

Consultar o estado do webhook:

```sh
npm run cf:webhook:status
```

Para registrar o webhook no backend configurado:

```sh
npm run cf:activate -- https://zelumi-bot.zelumi.workers.dev
```

A ativação verifica `/health`, usa um segredo, mantém mensagens pendentes e limita a conexão do webhook a uma. Se houver outro destino registrado, o script interrompe a operação. O bot local deve permanecer parado enquanto o webhook desse mesmo bot estiver ativo.

O D1 armazena lançamentos, perguntas, sessões e respostas pendentes. Updates são deduplicados e as alterações são transacionais. Falhas temporárias de envio ficam na fila, com novas tentativas por cron a cada cinco minutos. Uma resposta pode reaparecer se o processo cair depois de enviá-la e antes de registrar a entrega; o lançamento financeiro permanece único.

Sessões duram sete dias e usam cookie HttpOnly/Secure; o banco guarda hashes dos tokens. A API verifica sessão, usuário, origem, CSRF e versão nas operações financeiras. O documento isolado do widget Telegram tem CSP própria; o token do bot não é entregue ao navegador.

## Desenvolvimento e recuperação

Usar `npm run dev` para site e API com conta fictícia e D1 isolado em `.wrangler/local-dev/`. O fluxo alternativo `npm run cf:dev` serve a exportação estática em `https://localhost:8787`, com persistência própria em `.wrangler/state/` e variáveis de `.dev.vars` ou `.dev.vars.example`. Preparar esse banco com `npm run cf:db:migrate:local`.

Antes de publicar, registrar a versão exibida por `cf:versions`. Ao restaurar código, manter token, username e vínculo do D1 compatíveis, preservar as tabelas e não sobrescrever lançamentos com um dump. A restauração do frontend e a do Worker são independentes; manter compatibilidade entre os contratos HTTP de ambos.

Acompanhar consumo e erros no painel Cloudflare. Testes locais não medem a utilização da franquia em produção.

## Categorização com Workers AI

As migrações 0005 e 0006 criam memória por conta, procedência, orçamento, pausa e termos confirmados. Aplicar as migrações antes de publicar o Worker que usa essas tabelas. Não há recategorização do histórico.

O binding `AI` e as variáveis ficam em `apps/api/wrangler.jsonc`:

| Variável | Uso |
| --- | --- |
| CATEGORY_AI_ENABLED | `true` permite consulta automática; `false` suspende inferência para manutenção |
| CATEGORY_AI_PLAN | `free` indica Workers Free confirmado; `unverified` bloqueia inferência enquanto o plano não foi verificado |
| CATEGORY_AI_MODEL | Modelo Cloudflare; configuração inicial `@cf/google/gemma-4-26b-a4b-it` |
| CATEGORY_AI_DAILY_LIMIT | Tentativas por dia UTC em todo o aplicativo, inicialmente 200 |
| CATEGORY_AI_USER_DAILY_LIMIT | Tentativas por dia UTC por usuário, inicialmente 20 |

A configuração versionada usa `CATEGORY_AI_PLAN=free`, correspondente ao plano Workers Free confirmado na conta do projeto. Essa variável é uma declaração operacional e não consulta o plano automaticamente: se ele mudar ou ficar desconhecido, usar `unverified` ou suspender a inferência. Antes da ativação em produção, verificar disponibilidade/licença do modelo e avaliar descrições sintéticas em português. O modelo e a versão do prompt participam da chave de validade do cache. O ambiente fictício tem IA desligada e não recebe binding AI.

O Gemma configurado usa `chat_template_kwargs.enable_thinking=false` para produzir somente a resposta final dentro dos 64 tokens. Raciocínio interno não é usado como categoria. O prazo de dois segundos é controlado pelo aplicativo; `AbortSignal` não é enviado como opção do binding, e a inferência remota pode continuar após o prazo local. Alterar o prompt ou a política de geração exige atualizar `CATEGORY_PROMPT_VERSION` para invalidar respostas anteriores no cache.

O [Workers Free oferece atualmente 10.000 neurons por dia](https://developers.cloudflare.com/workers-ai/platform/pricing/), com bloqueio no excedente. Não são 10.000 chamadas. No plano Paid, excedentes podem ser cobrados; os contadores do aplicativo não garantem custo zero nesse plano. Ao migrar a conta para Paid, suspender a inferência e rever a política de custo antes de reativar. Não adicionar créditos ou ativar plano pago como parte desta configuração.

Apenas descrições necessárias e o catálogo são enviados ao Workers AI; não registrar esse conteúdo nos logs. As [regras de dados da Cloudflare](https://developers.cloudflare.com/workers-ai/platform/data-usage/) se aplicam. Os testes usam bindings simulados; nenhum teste automatizado exige chamadas reais ou mede qualidade do modelo em produção.

Inferência abandonada por timeout pode continuar consumindo recursos no provedor; cada tentativa já consome uma reserva. Erro 3036 sinaliza cota diária esgotada e suspende até 00:00 UTC; outros erros temporários pausam por 60 segundos. O aplicativo continua registrando despesas pelas regras locais. Desligar inferência não apaga memória, cache ou lançamentos.
