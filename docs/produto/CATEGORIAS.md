# Categorias prontas

O bot, a API e o painel compartilham 13 categorias de despesas e a categoria Receitas. A lista é fixa; não há cadastro de categorias personalizadas.

## Categorias

| Categoria | Exemplos de reconhecimento |
| --- | --- |
| Alimentação | mercado, padaria, Uber Eats, sorvete |
| Transporte | Uber, táxi, ônibus |
| Casa | aluguel, conta de água, energia elétrica |
| Saúde | farmácia, médico, plano de saúde |
| Educação | faculdade, escola, curso, material escolar |
| Lazer | cinema, show, teatro, jogos |
| Compras | roupas, calçados, notebook, celular, cabide |
| Assinaturas | Netflix, Spotify, assinatura de software |
| Cuidados pessoais | cabeleireiro, barbeiro, manicure, cortar cabelo |
| Pets | veterinário, pet shop, ração |
| Viagens | passagem aérea, hotel, hospedagem |
| Impostos e taxas | IPTU, IPVA, imposto de renda, tarifa bancária |
| Outros | Sem correspondência ou com conflito entre categorias |

Receitas reúne as entradas.

## Comportamento

- Categorias e regras ficam em [categories.mjs](../../packages/finance/src/categories.mjs), compartilhadas por interpretador, validação da API e painel.
- O reconhecimento ignora acentos e maiúsculas, respeitando palavras completas e variações explicitamente cadastradas. Uberlândia não é identificado como Uber.
- Expressões específicas são reconhecidas antes dos termos gerais: Uber Eats → Alimentação; ração para cachorro → Pets; material escolar → Educação; plano de saúde → Saúde; seguro viagem → Viagens; assinatura de jogos → Assinaturas.
- Os termos internos dessas expressões não geram outra classificação, mas outras despesas na mesma descrição continuam sendo consideradas. Uber Eats e táxi → Outros; mercado e farmácia → Outros; mercado e padaria → Alimentação.
- Sem correspondência reconhecida, o lançamento fica em Outros. Marcas ambíguas como Amazon ou Google isoladamente não determinam a categoria.
- Registros salvos mantêm sua categoria. Renomear no painel não executa categorização. No bot, editar a mesma descrição e tipo preserva a categoria manual ou de origem antiga desconhecida; descrever outra compra executa a classificação.
- Todas as categorias aparecem nos filtros e no editor do painel. A lista de categorias é fixa; as associações pessoais não criam novas categorias.

## Memória da conta

No editor, “Lembrar categoria para esta descrição” grava uma associação pessoal ao salvar. A opção é marcada após uma mudança explícita de categoria e pode ser desmarcada para corrigir só aquela compra. Alterar apenas nome, valor ou data não ensina. Uma escolha explícita de Outros também é lembrada e impede substituição por IA.

Descrições normalizadas ignoram caixa, acentos, pontuação, espaços e as palavras funcionais removidas pelo interpretador. Valores e datas são campos separados; números significativos, como iPhone 15 e Xbox 360, permanecem na chave. A associação pertence somente à conta atual. Excluir uma compra não apaga sua memória.

Perfil → Categorias aprendidas permite paginar, editar e esquecer descrições e termos. Uma regra por termo só é ativada por confirmação da pessoa. Sugestões usam pelo menos três descrições manuais distintas com a mesma categoria e sem evidência conflitante; repetição da mesma descrição e resultados da IA não contam. São examinadas até 1.000 associações manuais recentes, com até 20 sugestões. Cada conta pode cadastrar até 200 termos.

Termos pessoais respeitam palavras completas e priorizam a expressão mais específica no trecho correspondente. Outros trechos ainda são analisados: uma regra para Bambi não resolve “Bambi e farmácia” como Alimentação. Sem uma associação exata para a descrição inteira, despesas de categorias diferentes continuam em Outros.

Correção, memória e recibo são confirmados juntos, com versão, sessão e idempotência. Editar um lançamento não muda associações antigas para outro nome. Uma edição recusada não ensina nada. O histórico não é recategorizado nem usado como confirmação humana automaticamente.

## Classificação no Worker

A ordem é: associação pessoal da descrição → termos pessoais junto das regras gerais → regras gerais → cache IA válido → Workers AI → Outros. Receitas permanecem em Receitas. Conflitos, pagamentos de fatura e transferências não são resolvidos por IA; o produto não ganhou tratamento contábil para esses pagamentos.

A IA é automática para todas as contas quando habilitada na configuração operacional, com binding disponível e plano Free verificado. Não há botão de IA no Perfil. A descrição necessária e as categorias permitidas podem ser enviadas à Cloudflare; valor, data, ID Telegram e histórico não são enviados. Prompts e respostas não entram em logs.

A consulta tem prazo de dois segundos, saída de até 64 tokens e uma tentativa. Resposta inválida, abstenção, indisponibilidade ou limite mantêm a categoria local. O cache por conta e versão de modelo/prompt dura até 30 dias e nunca é confirmação para criar termos pessoais. O resultado da IA pode estar errado e pode ser corrigido no editor.

Os limites iniciais são 200 tentativas diárias globais e 20 por conta, reservadas atomicamente. A cota diária da plataforma esgotada suspende consultas até a próxima meia-noite UTC; erro temporário usa pausa de 60 segundos. O dia UTC renova às 21h de Brasília. Consultar [configuração e gratuidade](../infraestrutura/CLOUDFLARE.md#categorização-com-workers-ai).

No bot SQLite local, a classificação segue somente o catálogo local; memória do D1 não é sincronizada com esse banco. Desenvolvimento fictício e testes não fazem consultas reais à IA por padrão.

## Exemplos

`Sorvete Bambi 3` → Alimentação; `cabide 12,98` → Compras; `pente para máquina cortar cabelo 37,78` → Cuidados pessoais. Depois de corrigir “Bambi da esquina” no painel e lembrar Alimentação, repetir essa descrição com outro valor reutiliza a memória sem IA.

## Procedência interna

A procedência da categoria é armazenada internamente para preservar decisões manuais e distinguir memória, regras, cache e inferência. O painel e as confirmações do Telegram mostram a categoria sem exibir essa procedência. Registros antigos podem não distinguir consulta à IA de reutilização de cache. Esses metadados não são um relatório de consumo.
