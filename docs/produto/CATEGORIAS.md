# Categorias prontas

O bot, a API e o painel compartilham 13 categorias de despesas e a categoria Receitas. A lista é fixa; não há cadastro de categorias personalizadas.

## Categorias

| Categoria | Exemplos de reconhecimento |
| --- | --- |
| Alimentação | mercado, padaria, Uber Eats |
| Transporte | Uber, táxi, ônibus |
| Casa | aluguel, conta de água, energia elétrica |
| Saúde | farmácia, médico, plano de saúde |
| Educação | faculdade, escola, curso, material escolar |
| Lazer | cinema, show, teatro, jogos |
| Compras | roupas, calçados, notebook, celular |
| Assinaturas | Netflix, Spotify, assinatura de software |
| Cuidados pessoais | cabeleireiro, barbeiro, manicure, cosméticos |
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
- Novos lançamentos e mensagens reenviadas para edição no bot passam pelas regras do catálogo. Registros salvos mantêm sua categoria até uma edição explícita; editar apenas o nome no painel mantém a categoria escolhida.
- Todas as categorias aparecem nos filtros e no editor do painel.

A classificação usa regras locais, sem IA. Não há subcategorias, aprendizagem com correções ou recategorização em massa.

## Exemplos no bot

`Netflix 39,90` → Assinaturas; `curso 120` → Educação; `veterinário 80` → Pets; `IPVA 300` → Impostos e taxas. Para corrigir manualmente, abra o registro no painel e escolha Editar → Categoria. No bot, editar exige reenviar a operação e executa a classificação novamente.

A lista é pronta e compartilhada entre contas. Novas palavras e categorias exigem uma atualização do catálogo no código. Um termo reconhecido não representa compreensão geral da mensagem: detalhes não cadastrados podem continuar em Outros.
