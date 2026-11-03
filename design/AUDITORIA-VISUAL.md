# Auditoria visual do Zelumi

Data: 02/11/2026 · referência: [Guia visual v1.1](GUIA-VISUAL.md).

## Resultado

A auditoria encontrou e corrigiu divergências de rótulos, foco, contraste, números e estados vazios. A navegação, os componentes e as adaptações verificadas estão alinhados ao guia no escopo abaixo. O resultado não significa cobertura de toda combinação possível de conteúdo, navegador ou tecnologia assistiva.

A identidade principal foi preservada. Os ajustes de cor são variantes de leitura sobre fundos específicos; o laranja da marca continua o mesmo. O guia foi atualizado junto com os tokens e a implementação.

## Escopo e método

| Área | Verificação |
| --- | --- |
| Visão geral, Lançamentos e Perfil | Claro/escuro, 320, 390, 760, 1068 e 1280 px; texto em 100% e 200%: 60 combinações |
| Entrada e 404 | Claro/escuro, desktop de 1280 px e celular de 320 px |
| Estados e diálogos | 62 verificações de carregamento, vazio, erro, recuperação, filtros, detalhes, edição, confirmação de exclusão, estado ocupado, conflito e menu móvel |
| Tipografia | Fontes, tamanhos mínimos, texto ampliado, nomes longos e valores altos |
| Contraste | Textos renderizados das cinco telas, incluindo o botão no tema escuro antes da hidratação |
| Teclado | Foco em busca e editor, seletor de mês, menu modal, Escape e retorno de foco; dicas da barra e navegação persistente |
| Código | Tokens, variantes da marca, componentes compartilhados, estados e regras responsivas |
| Regressões | Testes da interface, tipos, build e exportação estática |

A conferência em navegador usou Brave/Chromium em perfil isolado, com dados fictícios locais. A ampliação de texto foi exercitada alterando a raiz para 200%, além da emulação de larguras móveis. Foi acrescentado um ensaio de zoom integral emulado: largura CSS de 1280 para 640 px e densidade de 1× para 2×. Nele, número e legenda do gráfico mantiveram 20/12 px CSS e dobraram seu tamanho físico, sem rolagem horizontal. Essas emulações não substituem uma rodada em aparelhos físicos.

As falhas de rede e os conflitos de edição foram simulados no navegador. Requisições financeiras de escrita foram interceptadas: nenhum lançamento foi editado ou excluído para executar a auditoria. O botão de confirmação de exclusão foi inspecionado sem executar a exclusão.

## Achados e correções

| Achado | Correção | Evidência |
| --- | --- | --- |
| Busca identificada apenas por placeholder/aria-label | Rótulo visível “Buscar pelo nome”, associado ao campo e preservado após preenchê-lo | Teste de regressão e inspeção no navegador |
| Foco dependia do navegador ou de borda de 1 px | Anel de 3 px nos controles; busca e mês mostram foco no contêiner; lançamentos mantêm sua exceção de 2 px | Teclado no navegador e estados claro/escuro |
| Texto da navegação ativa tinha contraste de aproximadamente 4,4:1 no tema claro | Token `--accent-ink` para texto sobre fundo de destaque suave | Medição antes/depois dos estilos renderizados |
| Textos de apoio do painel da entrada tinham contraste de aproximadamente 4,3:1 | Token `--story-ink`, sem alterar o fundo ou a cor principal da marca | Medição nos temas claro/escuro |
| Botão escuro podia ter texto claro sobre laranja claro antes da hidratação, aproximadamente 2,1:1 | Token `--on-accent` definido também na preferência do dispositivo | Reprodução sem `data-theme` e medição posterior |
| Valores do gráfico/legenda/cronograma não tinham algarismos tabulares explícitos | Aplicação de `tabular-nums` nos valores financeiros restantes | Estilos computados e inspeção do componente |
| Mês vazio sugeria alterar filtros que não existem nessa tela | Mensagem contextual na Visão geral; busca mantém orientação sobre nome/filtros | Teste de regressão e resposta vazia simulada |
| Título da tela de acesso/404 usava um tamanho isolado | Tokens de título de página, incluindo a adaptação móvel | Conferência de 404 e estado de acesso |
| Grupo financeiro poderia disputar espaço com descrições ampliadas | Colunas com espaço reservado; valores extensos podem quebrar de linha, preservando o grupo | Nomes longos, valores no limite, 320–1280 px e texto em 200% |
| Total do gráfico ultrapassava o círculo com texto em 200% | Diâmetro e tipografia internos responsivos ao card, com quebra de valores extensos | Conteúdo dentro do círculo em 320 px com texto ampliado |
| Guia misturava exportações originais e marca horizontal do produto | Variante monocromática já usada em `Brand` explicitada; exportações originais identificadas como tais | Guia e componente conferidos sem redesenhar a marca |
| CSS acumulava regras obsoletas e declarações substituídas | Remoção de 22 regras antigas/desnecessárias e 89 declarações superadas; formatação para leitura | Comparação de estilos e conferência das capturas |

Durante a limpeza, a inspeção das capturas detectou que a regra de ocultação da barra de desktop no celular havia sido removida junto de regras antigas. Ela foi restaurada antes do encerramento. A matriz final passou a verificar explicitamente a visibilidade da barra, além das dimensões e da rolagem horizontal. Menu móvel e navegação entre páginas foram repetidos após a correção.

## Componentes e estados conferidos

- **Marca e temas:** variante usada pelo site, símbolo original, Claro/Escuro/Sistema, cores de leitura e botão inicial.
- **Entrada:** texto principal, botão, carregamento e falha de consulta de sessão com tentativa de recuperação.
- **Visão geral:** cabeçalho, mês/atualização, indicadores, observações de despesas, gráfico, legenda, últimos lançamentos e estados carregando/vazio/erro.
- **Lançamentos:** busca rotulada, filtros, contagem, listagem, paginação pelo código/testes e estado sem registros.
- **Linhas de lançamento:** descrição completa, sinal financeiro, valor e parcela agrupados, hover, foco, valores altos e nomes longos.
- **Perfil:** conta, metadados, seleção de tema e ação de encerramento de sessão.
- **Detalhes:** título, valor total, dados do registro, cronograma e ações de editar/excluir.
- **Edição:** rótulos, tamanhos dos campos, foco, coluna única no celular, rolagem do diálogo, aviso sobre parcelas e conflito apresentado como erro.
- **Exclusão:** aviso sobre compra inteira e parcelas, confirmação e ação de voltar; sem executar exclusão.
- **Estado ocupado:** campos/ações desabilitados e Escape sem fechar um salvamento pendente; resposta simulada de conflito para concluir o teste.
- **Navegação:** barra aberta/recolhida, preferência após recarregar, permanência da mesma barra entre páginas, dicas dispensáveis, menu móvel, foco e toque fora.
- **404:** identidade, texto, título e retorno ao início.

## Validação final

- 33 testes de interface passaram, incluindo os novos testes de rótulo da busca e mensagem vazia contextual.
- Build de produção com checagem de tipos e exportação estática aprovado.
- Matriz final: nenhuma ocorrência de rolagem horizontal, texto informativo abaixo de 12 px, colisão entre descrição e grupo financeiro ou visibilidade incorreta da barra nos casos verificados.
- Valores altos e descrição longa também foram exercitados com texto em 200%.
- A amostra final de contraste não apresentou textos abaixo dos limiares utilizados na revisão.
- O CSS mantém media/container queries distintas quando elas são necessárias; a limpeza não foi uma eliminação indiscriminada de regras repetidas.

### Capturas de referência

Todos os dados exibidos nas capturas são fictícios.

- [Visão geral — escuro, 1068 px](auditoria/2026-11-02/visao-geral-escuro-1068.png)
- [Lançamentos — escuro, 320 px](auditoria/2026-11-02/lancamentos-escuro-320.png)
- [Edição — claro, 320 px](auditoria/2026-11-02/edicao-claro-320.png)
- [Entrada — claro, 1280 px](auditoria/2026-11-02/entrada-claro-1280.png)
- [Gráfico com a preferência de texto da página em 200%](auditoria/2026-11-02/grafico-texto-200.png)

## Limitações e exceções

- O widget oficial do Telegram é uma integração externa: estrutura, estados do componente e testes locais foram revisados, mas sua aparência externa e um login real no Telegram não foram homologados nesta auditoria.
- No gráfico, a escala responsiva pode crescer menos que 2× quando apenas a raiz é duplicada e o card limita o diâmetro. A captura desse caso demonstra contenção, não que cada texto interno tenha duplicado. O ensaio separado de zoom integral está descrito acima.
- Não houve teste em Safari/Firefox ou aparelhos físicos nesta rodada, nem avaliação com leitor de tela.
- Controles nativos de data/mês e seleção dependem do navegador. As amostras de tema e os balões ilustrativos têm cores próprias documentadas, sem representar outra paleta da aplicação.
- Permanecem as dimensões compactas registradas no guia: menu móvel de 36 px, alça lateral de 30 px e alguns controles de 38/40 px. Esta auditoria não declara certificação integral de acessibilidade ou cobertura de todos os critérios de tamanho de alvo.
- Estilos e informações internas da interface de desenvolvimento do Next.js não fazem parte do produto publicado.

## Como repetir a revisão

```sh
npm run dev
npm run web:test
npm run web:build
```

No ambiente local, usar a conta de teste e conferir as larguras da matriz, os dois temas, navegação por Tab/Escape, nomes longos e texto ampliado. Para comparar estados de falha, usar respostas locais simuladas; não provocar falhas ou alterações em dados de produção.

Para novas alterações, seguir o [guia visual](GUIA-VISUAL.md) e os [tokens compartilhados](../apps/web/app/tokens.css). Atualizar este relatório quando a cobertura ou os padrões mudarem.

## Referências dos critérios verificados

A revisão usou como referência contraste de 4,5:1 para texto comum e 3:1 para texto grande, respeitando as exceções para marca, decoração e controles inativos descritas pelo [W3C — contraste mínimo](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Também considerou a manutenção do conteúdo com [texto ampliado em até 200%](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html) e a presença de [foco visível por teclado](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html). Essas verificações delimitadas não equivalem a uma avaliação completa de conformidade WCAG.
