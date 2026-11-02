# Bot Zelumi

- Nome: **Zelumi**.
- Username: **@zelumi_bot**.
- ID: `9056845961`.
- Site: https://usezelumi.vercel.app.
- Produção: webhook e Cloudflare D1; token e segredo ficam somente no servidor.
- SQLite local padrão: `data/zelumi.sqlite`, separado do D1 e inicialmente vazio.

A integração atual já foi validada com login real e consulta `/hoje`. Não é necessário repetir a troca de bot. As credenciais, bancos e notas da transição concluída foram preservados em backup privado externo ao projeto.

## Proteção dos dados

Manter a verificação de identidade do bot e a migração `0004_bot_transition.sql`: impedem que uma configuração incompatível processe mensagens ou acesse dados. São proteções permanentes, sem dependência de um bot anterior específico.

Não iniciar o processo local com o token de produção enquanto seu webhook estiver ativo. Para desenvolver o site, usar `npm run dev`, que fornece conta e registros de demonstração isolados. Um bot de desenvolvimento separado precisa de token e banco próprios.

## Manutenção

Seguir [CLOUDFLARE.md](../CLOUDFLARE.md) para publicar e verificar a configuração. Um rollback deve preservar a compatibilidade entre token, username e identidade vinculada ao D1. Não restaurar um dump sobre lançamentos posteriores nem apagar tabelas para reverter código.

A atualização dos nomes dos recursos remotos segue [NOMES-INFRAESTRUTURA.md](./NOMES-INFRAESTRUTURA.md).
