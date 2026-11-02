# Zelumi — levantamento para conectar os dados financeiros

Estado: levantamento inicial. O usuário confirmou edição da compra inteira com recálculo das parcelas. Desenho correspondente: `2026-11-02-zelumi-dados-financeiros-design.md`.

## O que já foi aprovado

- Conectar Visão geral e Lançamentos aos registros reais do mesmo usuário Telegram.
- Contabilizar despesas parceladas pelo valor da parcela em cada mês, preservando o total em centavos.
- Primeira parcela no mês da compra, com possibilidade de ajustar o mês inicial.
- Mostrar receitas, despesas, resultado mensal, categorias e lançamentos conforme os estudos aprovados.
- Busca por nome sem distinguir acentos/maiúsculas, filtros e paginação.
- Manter consistência com o resumo mensal do bot, sem fechamento/vencimento de fatura ou lembretes.
- Usar a sessão já publicada e autorizar cada operação pelo owner derivado dessa sessão.

## Constatações do código

- `cloud_records` já guarda owner, corpo completo do lançamento e índices por usuário/data e usuário/sequência.
- O corpo contém descrição, tipo, categoria, data, valor total em centavos, quantidade e `schedule`, com valores/datas das parcelas.
- `dist/parser.mjs:schedule` preserva centavos, distribui eventual resto nas primeiras parcelas e ajusta dias inexistentes ao último dia do mês.
- O bot armazena o cronograma, mas os resumos local e D1 ainda agregam o valor integral pela data da compra.
- A edição do bot substitui a compra inteira e recalcula o cronograma. A exclusão remove o lançamento inteiro.
- O Worker controla concorrência do bot por `cloud_state.version`, recibo único por update e lote atômico. Alterações pelo site devem participar desse controle para não sobrescrever uma edição simultânea.
- A autenticação atual responde por todo o prefixo `/api`; as rotas financeiras precisam compartilhar a validação de sessão e preservar os erros JSON de rotas desconhecidas.
- As páginas financeiras ainda exibem estado de conexão pendente. Nenhum dado real foi buscado ou alterado neste levantamento.

## Pergunta enviada ao usuário

Ao editar uma compra parcelada no site, alterar a compra inteira e recalcular todas as parcelas, como o bot já faz, ou permitir alterar uma parcela isolada?

Resposta recebida: **editar a compra inteira e recalcular as parcelas**. Não implementar edição isolada de uma parcela nesta fase.

## Próximo detalhamento

Após essa definição, fechar o desenho de projeção mensal, contratos da API, edição/exclusão e conflitos, preservação de dados existentes e apresentação nas telas aprovadas. A descrição deve distinguir data da compra, mês da parcela e valor total, além de explicitar o comportamento do resumo diário sem introduzir um ciclo de fatura.
