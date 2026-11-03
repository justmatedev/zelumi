# Infraestrutura Zelumi

## Identificadores

| Recurso | Configuração |
| --- | --- |
| Worker | `zelumi-bot` |
| Subdomínio | `zelumi.workers.dev` |
| Backend | `https://zelumi-bot.zelumi.workers.dev` |
| D1 | `zelumi` |
| SQLite local | `data/zelumi.sqlite` |
| Bot | `@zelumi_bot` |
| Site | `https://usezelumi.vercel.app` |

O binding D1 e seu UUID estão em `apps/api/wrangler.jsonc`. O destino do proxy está em `apps/web/vercel.json`.

## Migração de 02/11/2026

O usuário autorizou uma janela de manutenção e confirmou acesso à Vercel. O serviço anterior teve gravações bloqueadas por HTTP 503 e cron suspenso antes da cópia. A fila de saída estava vazia. O backup final foi importado no D1 Zelumi; hashes e contagens confirmaram as 13 tabelas idênticas ao snapshot e à origem ainda bloqueada, incluindo os 7 lançamentos, perfis e sessões. Os segredos do Zelumi foram mantidos.

O novo Worker foi publicado, e o subdomínio da conta foi substituído por Zelumi. A API de criação de subdomínio não substitui um existente: a operação exigiu remover o vínculo do subdomínio anterior antes de registrar o novo, sem excluir Workers ou bancos.

Backup privado de configuração, código, versão e SQL: `../zelumi-backups/infra-20261102-181103/`, fora do projeto. Os recursos anteriores permanecem preservados para recuperação, com o processamento desativado, até confirmar o site publicado e o uso real do bot. O banco anterior não deve ser reaberto para gravações nem sincronizado sobre dados novos.

## HTTPS e webhook

HTTPS confirmado no endereço final e `/health` respondendo 200 com identidade `zelumi-bot`. Webhook ativado em `https://zelumi-bot.zelumi.workers.dev/telegram/webhook`, preservando updates. A confirmação retornou webhook ativo, zero updates pendentes e nenhum erro de entrega. Sessão e API financeira anônimas retornam 401; API inexistente retorna 404. Cron do Zelumi ativo a cada cinco minutos, e cron do serviço anterior suspenso. Versão publicada: `48a86744-734d-412a-97e7-deafee1f817a`.

Validação antes da migração: 85 testes backend/D1 e 33 de interface, tipos, build e export passaram. A publicação Vercel foi confirmada após o envio do usuário. Os testes reais autenticados pelo usuário ainda estão pendentes.

## Publicação Vercel confirmada

Antes desta reestruturação, o usuário publicou a revisão com o então `web/vercel.json` atualizado (atual `apps/web/vercel.json`). As verificações externas confirmaram páginas e assets 200, sessão/API anônimas 401 sem cache, API inexistente 404, origem inválida 403 e início de login 200 com bot correto, CSRF e cookie seguro. A rota de `/auth` e `/api` usa:

```text
https://zelumi-bot.zelumi.workers.dev/$1
```

A configuração remota conhecida usa Root Directory `web`; após esta reestruturação, ajustar para `apps/web` antes da próxima publicação. Como está conectado ao GitHub, a configuração precisa chegar à revisão publicada. Apenas clicar em Redeploy sobre uma revisão antiga não inclui arquivos locais. Manter `VERCEL_PROXY_SECRET` exatamente como está; não cadastrar o token Telegram na Vercel.

Validação externa concluída para publicação, proxy e webhook. Ainda cabe ao usuário entrar com sua conta e conferir identidade, lançamentos e uma consulta `/hoje` no Telegram. Somente depois retirar os recursos de recuperação anteriores.

## Referências

- [Subdomínios workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)
- [API de subdomínios](https://developers.cloudflare.com/api/resources/workers/subresources/subdomains/)
