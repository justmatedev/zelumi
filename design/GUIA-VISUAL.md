# Guia visual do Zelumi

Versão 1.1 · consolidada e auditada em 02/11/2026 a partir da identidade aprovada e dos ajustes revisados no site.

O escopo, os achados e as limitações da revisão estão no [relatório de auditoria visual](AUDITORIA-VISUAL.md).

Este é o guia de referência para criar e alterar interfaces do Zelumi. Ele reúne a identidade da marca e os padrões atuais do produto. Preserva a direção escolhida: clareza financeira com uma aparência acolhedora, organizada e próxima.

## 1. Onde está cada definição

| Referência | Responsabilidade |
| --- | --- |
| Este guia | Regras de aplicação e composição das telas |
| [tokens.css](../web/app/tokens.css) | Valores compartilhados de cor, tipografia, espaço e dimensões |
| [globals.css](../web/app/globals.css) | Estilos e adaptações de cada componente |
| [Componentes da interface](../web/components/ui/) | Implementação reutilizável de botões e cards |
| [Decisões do projeto](../docs/DECISOES.md) | Histórico das aprovações e decisões de produto |
| [Arquivos da marca](zelumi/conceitos/) | Logos e símbolos escolhidos |

Os tokens contêm os valores executados pelo site; o guia explica seu uso. Ao mudar um padrão, atualizar os dois na mesma alteração. Se houver divergência, conferir a última decisão aprovada e reconciliar os arquivos antes de criar outra variação. O histórico não substitui este guia para construir telas novas.

## 2. Personalidade e marca

- Acolhedor e organizado, sem excesso de elementos decorativos.
- Números fáceis de ler e comparar; a informação vem antes do enfeite.
- Laranja queimado como assinatura, com creme, café e carvão quente.
- Formas suaves, bordas finas e sombras discretas.
- Escrita simples, próxima e sem julgamento sobre a situação financeira da pessoa.

A marca escolhida é **Conversa**: balão com a letra Z, acompanhado de **zelumi** em minúsculas. Manter proporções, desenho e cores; não redesenhar a marca com um ícone semelhante.

| Aplicação | Arquivo/componente |
| --- | --- |
| Exportação original clara | [Logo claro](zelumi/conceitos/02-conversa-light.svg) |
| Exportação original escura | [Logo escuro](zelumi/conceitos/02-conversa-dark.svg) |
| Símbolo isolado | [Claro](zelumi/conceitos/02-conversa-simbolo-light.svg) / [Escuro](zelumi/conceitos/02-conversa-simbolo-dark.svg) |
| Marca horizontal e símbolo no site | [Brand e Symbol](../web/components/brand.tsx) |
| Favicon | [Símbolo SVG](../web/public/brand/simbolo.svg) |
| Telegram | [Avatar claro](zelumi/telegram/avatar-1024.png) / [Avatar escuro](zelumi/telegram/avatar-dark-1024.png) |

No site, a marca horizontal segue a variante monocromática de `Brand`: símbolo original em SVG e nome em Manrope, ambos na cor `--accent`. Os arquivos de conceito preservam a exportação original, que também contém lettering bicolor. A variante em uso no produto é a referência para as telas; não substituir uma pela outra sem atualizar esta regra. O símbolo não foi redesenhado nesta revisão.

Usar a marca horizontal na entrada e na navegação expandida. Usar o símbolo isolado na barra recolhida, favicon e avatar. Não distorcer, acrescentar efeitos, trocar a fonte ou usar outra cor principal. A composição ilustrativa de conversa da entrada conserva seus próprios detalhes de balão.

## 3. Cores e temas

| Papel / token | Claro | Escuro |
| --- | --- | --- |
| Fundo `--bg` | `#FAF7F2` | `#191715` |
| Superfície `--surface` | `#FFFFFF` | `#25211E` |
| Destaque `--accent` | `#B94B24` | `#F29B73` |
| Destaque para texto sobre fundo suave `--accent-ink` | `#AD431E` | `#F29B73` |
| Texto sobre botão principal `--on-accent` | `#FFFAF6` | `#291A11` |
| Texto no painel de entrada `--story-ink` | `#706257` | `#C6B7AA` |
| Fundo de destaque `--accent-soft` | `#F9EADE` | `#38281F` |
| Texto principal `--ink` | `#302721` | `#F5EDE5` |
| Texto secundário `--muted` | `#75685D` | `#C6B7AA` |
| Texto discreto `--subtle` | `#75685D` | `#B8A99B` |
| Bordas `--border` | `#E7DDD3` | `#403730` |
| Receita/positivo `--green` | `#3E6B52` | `#A6C7AD` |
| Fundo positivo `--green-soft` | `#EAF3EB` | `#29362B` |
| Painel da entrada `--story` | `#F0E2D3` | `#2E241E` |
| Borda da entrada `--story-border` | `#E8D6C3` | `#4C372A` |

Regras de uso:

- `--accent` identifica marca, ações, seleção e despesas; não pintar todos os valores de laranja. Sobre `--accent-soft`, textos pequenos usam `--accent-ink` para manter contraste. Botões principais usam `--on-accent`, inclusive antes da hidratação. Textos do painel ilustrado usam `--story-ink`.
- Receita usa sinal **+**, rótulo/ícone e verde. Despesa usa sinal **−** e rótulo/ícone; o valor principal pode permanecer em `--ink` para comparação.
- Mensagens de erro usam texto explícito, contexto e ação de recuperação. A cor sozinha não comunica erro. A implementação atual usa o destaque da marca; uma nova paleta de alertas deve ser definida e validada antes de ser introduzida.
- Superfície destacada é suave. No hover dos lançamentos, misturar **5% de `--accent` com `--surface`**; não usar o fundo geral escuro como um retângulo pesado.
- Texto secundário continua legível. Não reduzir sua opacidade para criar hierarquia.
- Validar Claro, Escuro e Sistema. Os valores de cada tema ficam juntos nos tokens, inclusive a preferência do dispositivo antes da hidratação.

### Gráficos

A sequência atual é `--chart-1` a `--chart-5`: `#B94B24`, `#6C8067`, `#D6A663`, `#96735D`, `#889B9E`. Esses tons distinguem séries; não são cores de sucesso/erro e não representam uma associação permanente entre categoria e cor. A legenda sempre apresenta nome, valor e percentual. Não depender só da cor do gráfico. O círculo e os textos internos se ajustam à largura do card; sob ampliação ou valores longos, manter o total legível dentro do círculo, permitindo quebra de linha em vez de corte. A tipografia interna usa unidades do contêiner (`cqi`) e limites mínimos: ao duplicar apenas a raiz, o tamanho acompanha o espaço do diagrama e pode crescer menos que 2×. Essa exceção não se aplica ao restante da interface; a ampliação integral do navegador deve continuar aumentando a leitura.

## 4. Tipografia e hierarquia

**Manrope:** marca e títulos. **Inter:** textos, controles, informações de apoio e valores financeiros. Usar as [fontes locais e licenças](zelumi/fonts/), carregadas no [layout do site](../web/app/layout.tsx).

| Uso | Token | Tamanho de referência |
| --- | --- | --- |
| Metadados, datas, parcelamento e rodapé | `--text-xs` | 12 px / `0.75rem` |
| Observações e informações secundárias | `--text-sm` | 13 px / `0.8125rem` |
| Descrição de card, lançamento e navegação | `--text-md` | 14 px / `0.875rem` |
| Texto base | `--text-base` | 15 px / `0.9375rem` |
| Campos e nome da conta | `--text-lg` | 16 px / `1rem` |
| Título de card | `--text-card-title` | 17 px |
| Valor central do gráfico | `--text-xl` como limite de referência | 20 px, com adaptação ao círculo |
| Título de página | `--text-page-title` / `--text-page-title-mobile` | 29 / 27 px |
| Título de diálogo | `--text-dialog-title` / `--text-dialog-title-mobile` | 24 / 22 px |
| Valor de indicador | `--text-metric` | 22–32 px, conforme a largura; no celular, regra específica atual de 29 px |

Os valores em rem consideram uma raiz de 16 px. Não fixar o tamanho da raiz nem impedir zoom. A marca e o título de apresentação da entrada têm escala própria; não usar essa exceção em textos informativos.

- Não criar texto informativo abaixo de **12 px**.
- Peso regular para leitura, 500–550 para ênfase leve, 600 para valores nos lançamentos e 650 para títulos.
- Entrelinha: `--leading-body` 1,6; `--leading-copy` 1,65; `--leading-comfortable` 1,5; `--leading-compact` 1,4; `--leading-metric` 1,25.
- Descrições de lançamentos podem quebrar de linha e não devem desaparecer em reticências.
- Metadados ficam abaixo do conteúdo principal, sem competir com o valor.
- Números financeiros usam algarismos tabulares e formato brasileiro; não substituir Inter por uma fonte decorativa ou monoespaçada.

## 5. Espaçamento, formas e dimensões

A escala preferida de espaçamento é **4, 8, 12, 16, 20, 24, 28, 32, 36, 40 e 48 px**, disponível em `--space-*`. Usar os tokens ao criar padrões novos. Ajustes ópticos existentes, como 6, 10, 18 ou 22 px, pertencem ao componente e não justificam criar outra escala global.

| Elemento | Padrão atual |
| --- | --- |
| Card | Borda de 1 px, raio `--radius` 12 px |
| Espaço interno do card | 28 px; 22 px até 760 px; 20 px até 420 px |
| Card de indicador | 24 px de espaço interno |
| Botão | Raio `--radius-control` 9 px |
| Campos de filtro/formulário | Raio `--radius-xs` 7 px; busca usa `--radius-sm` 8 px |
| Ícones e linhas | Raio `--radius-sm` 8 px, com ajustes próprios da marca/ilustração |
| Diálogo | Raio `--radius-lg` 16 px; largura máxima `--dialog-max` 580 px |
| Painel da entrada | Raio `--radius-xl` 18 px |
| Botão padrão | Altura mínima `--control-height` 44 px |
| Campo de formulário | Altura mínima `--field-height` 46 px, texto de 16 px |
| Ícones de mês/paginação | `--compact-control-size` 38 px |
| Área principal | Largura máxima `--content-max` 1320 px |

Controles compactos existentes têm exceções próprias: ghost e fechamento de diálogo 40 px, menu móvel 36 px e alça da barra lateral 30 px. Não reduzir controles novos para caber mais texto; reorganizar o layout e avaliar a área de toque. Sombras são reservadas principalmente para sobreposições e dicas.

## 6. Componentes e composição

### Botões e cards

Reutilizar [Button](../web/components/ui/button.tsx) e [Card](../web/components/ui/card.tsx).

- `Button` padrão: ação principal com fundo de destaque.
- `outline`: ação secundária, borda e superfície neutras.
- `ghost`: ação auxiliar, como atualizar ou limpar filtros.
- Ícone sem texto visual exige nome acessível. Não retirar o rótulo acessível quando esconder o texto no celular.
- Card agrupa informações relacionadas. Não transformar cada texto em um card separado nem acrescentar bordas/sombras concorrentes dentro dele.

### Cabeçalho e indicadores

- Título e descrição formam o bloco esquerdo da página.
- Mês e atualizar ficam agrupados e centralizados verticalmente em relação a esse bloco quando estão na mesma linha.
- No celular os controles ficam abaixo da descrição; atualizar pode ser apenas um ícone nomeado.
- Indicadores apresentam rótulo, valor e observação. O valor tem a maior ênfase.
- Despesas mostram **“Parcelas: R$ …”** e **“À vista: R$ …”** em linhas separadas.
- Não recolocar uma faixa vazia exclusiva para atualizar entre cabeçalho e indicadores.

### Lançamentos

Usar [EntryList](../web/components/finance/entry-list.tsx) em Visão geral e Lançamentos.

```text
[ícone] Notebook de exemplo               − R$ 200,00
        Outros · 01/11/2026               Parcela 1 de 6
```

- Descrição e valor alinhados no topo; categoria/data abaixo da descrição.
- Valor e parcelamento ficam no mesmo grupo, alinhados à direita.
- Usar **“Parcela X de Y”** ou **“À vista”**, sem etiqueta solta em outra faixa.
- Separadores discretos e hover suave, com foco visível por teclado.
- A linha inteira abre os detalhes do registro; descrição completa e contexto continuam no nome acessível.
- Em cards até 300 px de largura útil, ocultar apenas o ícone decorativo para preservar espaço dos textos. Manter descrição e grupo financeiro.
- Verificar nomes longos, valores altos, receitas e despesas. Nunca sobrepor valor, parcela ou descrição. O grupo financeiro tem espaço reservado e valores muito longos podem quebrar de linha, sem truncamento, para respeitar ampliação do texto.

### Formulários, mensagens e diálogos

- Rótulos visíveis acima dos campos; placeholder não substitui rótulo.
- Campos com 16 px, alinhados e com espaço entre grupos.
- Formulário em duas colunas quando houver espaço; uma coluna até 600 px.
- Erros explicam o problema e como continuar. Avisos de edição/exclusão informam que a compra inteira e suas parcelas são afetadas.
- Diálogo permite rolagem interna em telas pequenas. Fechar, voltar, salvar e confirmar continuam acessíveis.
- Mensagem vazia corresponde ao contexto: a Visão geral orienta sobre o mês; a busca pode sugerir outro nome ou filtros.
- Telas de acesso e 404 usam os tokens de título de página.
- Estados vazio, carregando, erro e sucesso devem ser previstos usando os componentes existentes; não inventar outra linguagem visual para cada tela.

## 7. Navegação e responsividade

A navegação é compartilhada no [layout do painel](../web/app/(dashboard)/layout.tsx), com [AppShell](../web/components/app-shell.tsx) e [Sidebar](../web/components/sidebar.tsx). Não colocar outro AppShell dentro de cada página: isso recria a barra e perde seu estado intermediário ao navegar.

- Barra expandida: `--sidebar-expanded` 226 px; em telas intermediárias, `--sidebar-medium` 200 px.
- Barra recolhida: `--sidebar-collapsed` 76 px; símbolo, ícones e dicas por hover/foco. A preferência fica no navegador.
- Até **760 px**, navegação em menu modal sobre o conteúdo. Fechar por botão, Escape, toque fora ou mudança de página; devolver foco ao acionador e evitar interação com o fundo.
- Dicas podem ser dispensadas com Escape e continuam acessíveis ao mover o ponteiro sobre elas.
- Reorganizar pela largura disponível do componente, considerando a barra aberta/recolhida, e não apenas pela largura total da janela.

| Condição atual | Adaptação |
| --- | --- |
| Área de conteúdo até 850 px | Gráfico e lançamentos em uma coluna |
| Tela até 760 px | Menu móvel e espaçamentos menores |
| Tela até 600 px | Busca/filtros e formulário reorganizados; atualizar em ícone |
| Tela até 420 px | Preferências de tema em linhas e cabeçalho simplificado |
| Card de lançamentos até 300 px | Omitir ícone decorativo; preservar informações |

Breakpoints em media/container queries permanecem literais no CSS: custom properties não são usadas como condições de consultas CSS nativas. Não diminuir fontes para evitar reorganizar o layout.

## 8. Ícones, movimento e acessibilidade

- Usar o conjunto **Lucide** já instalado. A marca usa seu próprio símbolo, não um ícone genérico de conversa.
- Ícones funcionais ficam normalmente entre 15 e 21 px; fundos de ícones podem ser maiores. Não aumentar todos os ícones ao aumentar textos.
- Ícones decorativos não precisam de nome; ações com ícone precisam.
- Foco padrão visível de 3 px em links, botões, campos e resumos expansíveis; lançamentos usam 2 px com afastamento de 2 px. Busca e seletor de mês podem mostrar o anel no contêiner. Não remover foco sem oferecer substituição visível.
- Transições atuais: cerca de 150 ms para feedback e 200 ms para a barra lateral. Respeitar `prefers-reduced-motion`.
- Navegação, formulários e modais precisam funcionar por teclado. Tema e cor não podem ser a única indicação de estado.
- Conferir leitura com zoom, contraste dos textos e espaço para conteúdo real. As verificações visuais descritas aqui não equivalem a uma certificação de acessibilidade.

## 9. Escrita e informações financeiras

Usar português brasileiro, frases curtas e rótulos consistentes: **Visão geral**, **Lançamentos**, **Perfil**, **Receitas do mês**, **Despesas do mês**, **Resultado do mês**, **Atualizar**, **À vista** e **Parcela X de Y**.

- Formatar moeda com os helpers de [finance.ts](../web/lib/finance.ts); dados financeiros continuam em centavos.
- Data visível em `dd/mm/aaaa`; mês escrito por extenso no seletor.
- O resultado do mês é receitas menos despesas do período. Não apresentá-lo como saldo bancário disponível.
- Explicar quando uma edição afeta parcelas de outros meses; evitar termos vagos como “valor” quando é necessário distinguir total e parcela.
- Não usar mensagens que culpem a pessoa, excesso de exclamações ou informação técnica do backend como texto de produto.

## 10. Como manter o padrão

Antes de criar uma variação:

1. Conferir este guia e procurar um componente existente.
2. Usar os tokens compartilhados; evitar hexadecimais e tamanhos novos espalhados no JSX.
3. Se a diferença for só espaço disponível, adaptar o componente existente.
4. Se uma nova regra for necessária, registrar o motivo e atualizar guia, tokens e componente juntos. Não alterar a identidade por conta de uma única tela.
5. Validar tema claro/escuro, barra aberta/recolhida, celular, textos longos e valores altos.

Para alterações de implementação, executar os testes apropriados e o build. A suíte da interface é `npm --prefix web test`; a validação de tipos, testes e exportação pode ser feita com `npm run web:check`. Para revisão manual, usar `npm run dev` e conferir ao menos 320, 390, 760, 1068 e 1280 px.

A auditoria removeu regras obsoletas e declarações superadas e organizou o CSS para leitura. Regras em contextos responsivos distintos continuam necessárias. Mudanças futuras devem preservar o resultado visual; não eliminar regras em massa sem comparar as telas.
