# Zelumi — dados reais e parcelas mensais

Data: 02/11/2026. Estado: desenho aprovado explicitamente pelo usuário. Plano correspondente: [dados financeiros](../plans/2026-11-02-zelumi-dados-financeiros.md). As escolhas técnicas são do implementador dentro do funcionamento aprovado.

## Objetivo e alcance

Conectar Visão geral e Lançamentos aos registros reais do Telegram, preservando os estudos visuais aprovados, login, Perfil e temas. Mostrar parcelas nos meses correspondentes, implementar busca/filtros, detalhes, edição e exclusão e alinhar `/mes` no bot.

Sem recadastrar compras, criar outro banco/bot ou contratar serviços. O cadastro inicial continua pelo Telegram. Sem criação de compras pelo site, edição isolada de parcelas, marcação de pagamento, regras de fatura, lembretes ou categorias personalizadas nesta etapa.

## Abordagens

**Proposta: API no Worker sobre os registros e cronogramas existentes no D1.** O backend devolve somente os dados da sessão e calcula os recortes mensais. O mesmo critério atende site, bot publicado e SQLite local. Índices e consultas limitadas evitam enviar todo o histórico ao navegador.

Alternativa considerada: materializar uma tabela por parcela. Facilita alguns índices, mas exige migrar e manter até 120 linhas extras por compra e tratar importação/rollback. Deixar para medições que demonstrem necessidade. Outra alternativa, calcular tudo no navegador, exigiria transferir o histórico inteiro e manter outro cálculo para o bot. A proposta mantém a stack e a fonte financeira já escolhidas.

## Regras dos valores e meses

- Inteiros positivos em centavos, com o limite atual de R$ 1 bilhão por lançamento; agregados precisam permanecer inteiros seguros, sem arredondamento silencioso por overflow.
- De 1 a 120 parcelas, preservando o total exato. R$ 1.000 em 12 gera quatro parcelas de R$ 83,34 e oito de R$ 83,33, como o cálculo atual.
- Primeira parcela no mês da compra por padrão. Campo opcional `installmentStartMonth` (`YYYY-MM`) permite ajustar o início de compras parceladas sem mudar a data da compra.
- O dia de referência continua sendo o dia da compra, limitado ao último dia do mês. Usar uma função compartilhada para fevereiro, ano bissexto e passagem de ano.
- À vista entra integralmente no mês da data da compra. Proposta do implementador: receitas que já tenham sido cadastradas em parcelas seguem o mesmo cronograma mensal, sem somar novamente seu total.
- Visão geral soma ocorrências do mês: receitas, despesas, despesas parceladas, despesas à vista e resultado (receitas menos despesas). Não chamar de saldo bancário nem inferir pagamento/vencimento.

## Edição e exclusão

O usuário escolheu **editar a compra inteira e recalcular todas as parcelas**, incluindo meses anteriores. Informar esse alcance no formulário antes de salvar. Categoria também pertence à compra inteira.

Formulário: descrição, tipo, categoria, valor total, data da compra, quantidade de parcelas e mês inicial quando parcelado. Mostrar prévia do cronograma e soma. Converter para à vista remove o início independente e usa a data da compra.

Manter categorias atuais: receita em `Receitas`; despesa em `Alimentação`, `Transporte`, `Casa`, `Saúde` ou `Outros`. Não criar gerenciamento de categorias.

Excluir remove a compra e todas as parcelas, após confirmação com descrição, total e alcance em todos os meses. Repetição após resposta perdida deve reconciliar ausência do registro.

Edição/exclusão usa a versão vista ao abrir os detalhes. Alteração concorrente devolve conflito, preserva o texto digitado para comparação e oferece recarregar; não sobrescreve a nova versão automaticamente. Formulários financeiros não são persistidos em localStorage.

## Coerência com o bot

- `/mes` usa parcelas do mês atual no fuso `America/Sao_Paulo`, com os mesmos totais do site e rótulo `Resultado do mês`. A contagem corresponde às ocorrências daquele mês.
- Proposta para `/hoje` e `/resumo`: preservar compras/receitas cuja data é hoje pelos valores integrais. Explicar que essa consulta usa data da compra e que `/mes` usa parcelas; o dia de parcela não é vencimento real.
- `/ultimos` continua listando compras inteiras com total, quantidade e data. Atualizar ajuda: site e bot compartilham os registros e `/mes` distribui parcelas.
- Edição no Telegram preserva o mês inicial ajustado quando data e parcelamento são mantidos. Data explicitamente alterada por hoje/ontem volta a usar o novo mês por padrão. Tornar à vista remove o início independente.
- Edição iniciada no bot antes de alteração pelo site detecta a versão obsoleta e informa conflito. Não interpretar o texto dessa edição como compra nova. Perguntas pendentes antigas continuam compatíveis e sem duplicação.

## Armazenamento, busca e dados antigos

`cloud_records.body` permanece a fonte financeira, com IDs/owners, data da compra, original de mensagem e cronograma preservados. O frontend não implementa um segundo cálculo de parcelas.

Usar migração aditiva para índices/metadados necessários. Agregar no D1 expandindo JSON de cronograma somente após filtro por owner e faixa mensal; considerar índices de mês inicial/final. Não carregar todo o histórico para somar no Worker. Medir com dados sintéticos incluindo 120 parcelas e muitos registros antigos antes de publicar.

Busca: normalização Unicode NFD, remoção de marcas combinantes e minúsculas; substring literal, sem interpretar `%`, `_`, aspas ou barras como operadores. Proposta: coluna auxiliar de busca mantida nas novas escritas, normalizando registros antigos em lotes limitados. Backfill condiciona a gravação ao corpo ainda ser o observado, sem alterar valores financeiros. Invalidação por trigger na mudança de descrição deve proteger inclusive escritores antigos em rollback.

Não omitir compras antigas ainda sem chave de busca. Se o preparo exceder o lote da requisição, devolver estado temporário de preparação e retomar até o histórico estar pesquisável; não apresentar falsos zero resultados. O plano fixa SQL, lote e teste de concorrência. Metadados não podem ficar ligados à descrição anterior após uma escrita concorrente.

Preservar cronogramas existentes válidos. Detectar corpo sem cronograma e preparar recuperação a partir de total, quantidade e data. Não apagar ou corrigir silenciosamente totais inválidos; conservar o dado e apresentar impedimento explícito. O SQLite local usa o mesmo critério mensal e mantém transações. A importação aceita campos/metadados auxiliares ausentes.

## API, sessão e concorrência

Reutilizar a sessão publicada. Cada SQL restringe owner obtido da sessão; não aceitar owner do cliente. IDs de outro usuário retornam 404. Usar leituras consistentes no D1 (`first-primary`). Refatorar o despacho de `/api` para compartilhar validação de sessão sem reintroduzir o apagamento de cookie por GET401 atrasado.

| Rota proposta | Resultado |
| --- | --- |
| `GET /api/finance/overview?month=YYYY-MM` | Totais, categorias e ocorrências recentes do mês |
| `GET /api/finance/entries` | Ocorrências paginadas, busca/filtros, contagem e categorias disponíveis |
| `GET /api/finance/records/:id` | Compra completa, versão e cronograma |
| `PUT /api/finance/records/:id` | Substitui a compra inteira mediante versão |
| `DELETE /api/finance/records/:id` | Exclui a compra inteira mediante versão |

Propostas do implementador: nome até 200 caracteres, busca até 100, páginas com 20 ocorrências e máximo 50 por pedido. Datas reais e mês inicial entre anos 1900 e 9990 mantêm cronogramas de até 120 meses dentro de anos representáveis. Recusar datas impossíveis e campos desconhecidos. Contratos JSON/TS, ordenação e paginação estável ficam para o plano.

Respostas: 401 sem sessão; 400 entrada inválida; 403 origem/CSRF inválidos; 404 recurso ausente; 409 conflito; 503 preparo/indisponibilidade com nova tentativa. `Cache-Control: no-store`; sem SQL/stack/dados de outro owner em respostas ou logs.

PUT/DELETE exigem Origin exato, JSON, CSRF da sessão, limite de corpo e versão esperada. Impressão criptográfica do corpo financeiro pode cumprir a versão sem alterar IDs.

Escritas do site participam de `cloud_state.version`: conferir versão, aplicar alteração/exclusão, atualizar metadados e incrementar estado atomicamente. Identificar cada tentativa e não confirmar sucesso se uma condição falhar. Não criar updates Telegram artificiais nem modificar o cursor de polling para representar ações do site.

## Telas e atualização

- Reutilizar a referência visual aprovada. Mostrar dados reais, carregamento, erro ou vazio honesto; retirar as mensagens de conexão pendente somente nas áreas conectadas.
- Visão geral abre no mês atual: seletor acessível, três totais, despesas por categoria e ocorrências do mês. Gráfico acompanhado de legenda textual/valores; mês sem despesas não causa divisão por zero.
- Lançamentos abre em todos os meses: busca por nome, filtros combinados de mês, tipo, categoria e parcelamento, contagem e paginação. Uma linha por parcela (`2/12`), com seu valor/mês; detalhes mostram o total da compra. À vista tem uma linha.
- Busca aguarda breve pausa na digitação. Mudar busca/filtro retorna à primeira página. Respostas atrasadas não substituem uma busca mais nova.
- Detalhes/formulário funcionam por teclado, com foco retornando à origem ao fechar. Celular sem rolagem horizontal da página.
- Refazer leituras ao entrar na página, voltar ao foco e após editar/excluir; oferecer Atualizar. Sem WebSocket/polling permanente ou promessa de atualização instantânea em página ociosa.
- Falha de rede tem nova tentativa; 401 oculta dados e retorna à entrada. Escrita com resultado incerto consulta versão/ausência antes de repetir e explica o resultado. Não exibir números de conta anterior após saída.

## Validação e publicação

Testar centavos/limites, passagem de ano, dia31/fevereiro/bissexto, início ajustado, receita parcelada, histórico vazio, busca com acentos/caracteres SQL literais, filtros e paginação. O mesmo registro nunca soma total e parcelas ao resumo mensal.

Testar isolamento, sessões, CSRF, métodos, concorrência bot/site, edição pendente no Telegram, DELETE repetido, rollback de lote, resposta perdida e consultas fora de ordem. Testes usam dados sintéticos e não enviam mensagens ao bot real.

Antes de publicar: suíte existente, novos testes, tipos, build, dry-run e revisão independente. Migração/preparo verificáveis por contagem/invariantes, sem imprimir conteúdo financeiro. Registrar versão de rollback, conservar compras e revalidar/reconstruir metadados auxiliares ao reativar a nova versão após rollback.

Publicar no Worker existente, sem trocar webhook, banco, segredo ou plano. O usuário compara um mês/compra conhecidos entre site e bot e confirma edição/exclusão de um registro escolhido por ele. O agente não cria compras de teste na conta real sem instrução explícita. Medir consumo quando disponível e registrar a limitação caso não seja possível; sem promessa de gratuidade ilimitada.

## O que o plano precisa fixar

Após aprovação: arquivos, contratos TS/JSON, SQL/migração, lote de preparo, versão/idempotência, limites de consulta medidos, manutenção dos metadados na importação/rollback, comandos e testes. Não adicionar bibliotecas de gráficos ou acesso ao banco sem necessidade.
