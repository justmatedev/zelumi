# Bot Zelumi

- Nome: **Zelumi**.
- Username: **@zelumi_bot**.
- Site: https://usezelumi.vercel.app.
- Produção: webhook em Cloudflare Workers e armazenamento D1.
- Desenvolvimento local: long polling e SQLite em `data/zelumi.sqlite`.

## Acesso e registros

O cadastro é aberto, com identificação pelo ID numérico do Telegram e isolamento dos registros por usuário. O site usa a mesma identidade e acessa os lançamentos por API autenticada. Token do bot e segredo do webhook ficam no servidor.

Valores, datas e parcelas são interpretados por regras locais. A classificação no Worker combina memória pessoal e regras, com IA quando necessária e configurada. Categorias são compartilhadas pelo bot e pelo painel; consultar [CATEGORIAS.md](CATEGORIAS.md). A ajuda (`/ajuda`, `/start` e `/help`) fornece exemplos e o botão **Abrir meu painel**. Os demais comandos e formatos de mensagem estão no [README](../../README.md#comandos).

## Valores e parcelas

Os valores são armazenados em centavos. `/mes` e a Visão geral somam as parcelas atribuídas a cada mês; `/hoje` e `/resumo` usam os valores integrais pela data da compra. O resultado é receitas menos despesas, não saldo bancário.

A primeira parcela começa no mês da compra por padrão; o painel permite ajustar o mês inicial. A distribuição preserva a soma exata dos centavos. Edição e exclusão no painel afetam a compra inteira e todas as suas parcelas. O bot edita pela mensagem completa, preservando a data quando nenhuma outra é informada. Não há fechamento ou vencimento de fatura.

## Desenvolvimento e manutenção

Não executar long polling com o token de um bot que tenha webhook ativo. Para desenvolver o site, usar `npm run dev`, com conta fictícia e D1 isolado. Para testar um bot local, usar token e banco próprios.

Preservar a verificação de identidade vinculada ao D1 e todos os arquivos SQL em `apps/api/migrations/`. A configuração de token e username precisa corresponder à identidade do bot vinculada ao banco.

Seguir [CLOUDFLARE.md](../infraestrutura/CLOUDFLARE.md) para publicar e verificar a configuração. Ao restaurar código, preservar a compatibilidade entre token, username e identidade vinculada ao D1; não sobrescrever lançamentos com um dump nem apagar tabelas para reverter código.

## Categorias aprendidas

O Worker combina memória pessoal, termos confirmados e catálogo local. Quando necessário e configurado, consulta Workers AI com a descrição; falhas mantêm a classificação local. A confirmação do Telegram usa a mesma categoria salva. Correções durante uma consulta impedem o commit de uma classificação obsoleta. A edição da mesma descrição e tipo preserva uma categoria manual; trocar a descrição executa a classificação novamente. No bot local SQLite permanece o catálogo local. Consulte [categorias](CATEGORIAS.md).
