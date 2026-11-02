# Zelumi — decisões do projeto

Atualizado em 02/11/2026. Este documento reúne as decisões da conversa e diferencia o produto planejado do código que já está em funcionamento. Ao mudar uma decisão com o usuário, atualizar este registro.

## Produto e nome

- Nome escolhido: **Zelumi**.
- Objetivo: gerenciamento financeiro pessoal com registro rápido de receitas e despesas pelo Telegram e acompanhamento visual pelo site.
- Telegram: entrada cotidiana de lançamentos, perguntas sobre informações faltantes, correção, desfazer e consultas.
- Site: visão mensal, consulta e gerenciamento dos lançamentos reais do mesmo usuário.
- “Miúdo” e “Financeiro — Testes” são nomes anteriores/provisórios. A pasta `miudo`, identificadores de infraestrutura e textos antigos ainda existem; a escolha de Zelumi não significa que já foram renomeados.
- Disponibilidade de marca, domínio e usernames de Zelumi ainda não foi verificada. Não apresentar exclusividade como confirmada.
- A assinatura “suas finanças em poucas palavras” foi sugerida, mas não foi escolhida explicitamente como slogan definitivo.

## Stack definida

| Parte | Decisão | Situação |
| --- | --- | --- |
| Interface do novo site | Next.js + TypeScript | Base implementada e publicada; dados financeiros pendentes |
| Estilização | Tailwind CSS | Implementado no site |
| Componentes | shadcn/ui, personalizados | Button e Card implementados |
| Backend e bot | Cloudflare Workers | Bot implementado e publicado |
| Banco de dados | Cloudflare D1 | Em uso pelo bot; site ainda não conectado |
| Autenticação do site | Apenas Telegram nesta fase | Widget clássico + sessão implementados; confirmação humana pendente |
| Operação inicial | Priorizar franquias gratuitas e acompanhar consumo | Sem compromisso de gratuidade ilimitada |

Next.js exporta arquivos estáticos em `web/out`, servidos junto da API no Worker existente. Site e bot ficam no mesmo repositório e no mesmo domínio Cloudflare. Não utiliza adaptador de SSR, vinext ou OpenNext.

Zod foi sugerido para validação, mas nenhuma biblioteca de validação, autenticação, gráficos ou acesso aos dados foi escolhida definitivamente.

## Acesso e dados

- Única forma de login escolhida: Telegram. E-mail/senha e outros provedores ficam fora desta fase.
- Cada usuário deve acessar apenas seus próprios registros, com validação no backend.
- Cadastro aberto no site e no bot, sem lista de IDs ou aprovação manual. O usuário pode divulgar o link individualmente, mas qualquer pessoa que chegar ao serviço pode entrar pelo Telegram. Cada pessoa vê somente seus próprios dados.
- O site usa o Login Widget clássico oficial do Telegram, perfil interno e sessão protegida. Validação, cookies e vínculo pelo ID numérico estão implementados; o teste humano da autorização externa ainda deve ser confirmado.
- Token do bot, segredo do webhook e futuras credenciais de login permanecem no servidor; nunca em arquivos públicos.

## Telas aprovadas para a primeira versão

### Visão geral

- Seletor de mês, permitindo consultar o atual e meses futuros.
- Receitas do mês.
- Despesas do mês: gastos à vista e parcelas atribuídas ao período.
- Resultado do mês: receitas menos despesas; não chamar de saldo bancário.
- Despesas por categoria.
- Últimos lançamentos, com identificação de parcelas, como “2/10”.

### Lançamentos

- Histórico dos lançamentos.
- Busca pelo nome da compra em destaque: o usuário informou que esse é seu principal modo de procurar um gasto.
- Filtros por período, tipo, categoria e parcelamento como apoio; detalhes visuais ainda em avaliação.
- Edição e exclusão de registros.

### Perfil

- Conta Telegram vinculada. A indicação do vínculo fica no Perfil; não exibir bolinha de status ou texto de vínculo no cabeçalho.
- Opção de sair.

## Regra aprovada de compras parceladas — implementação pendente

- Mostrar o valor de cada parcela no seu respectivo mês, como uma visão mensal de compromissos.
- Exemplo: compra de R$ 1.000 em 10 parcelas aparece como R$ 100 por mês durante 10 meses.
- Primeira parcela no mês da compra, com possibilidade de ajustar o mês inicial.
- Despesas à vista entram integralmente no mês correspondente.
- Preservar o valor total da compra no histórico, junto com o andamento das parcelas e seus meses.
- Não somar o valor integral da compra novamente ao total mensal quando suas parcelas já estão sendo contabilizadas.
- O comportamento deve ser consistente entre o site e o resumo mensal do bot.
- Preservar a soma exata dos centavos ao distribuir parcelas.
- Fechamento e vencimento de fatura ficam para depois. Esta fase não implementa um ciclo real de cartão de crédito.

**Situação atual:** o bot calcula e armazena o cronograma, mas os resumos ainda somam o valor integral na data da compra. A mudança para parcelas mensais foi aprovada na conversa e ainda precisa ser implementada e testada. O detalhamento do comando diário também precisa ser alinhado a essa mudança.

Sintaxes já implementadas no interpretador:

| Mensagem | Interpretação atual |
| --- | --- |
| `google 1000 x12` | Total de R$ 1.000 em 12 parcelas |
| `google 12x 80` | 12 parcelas de R$ 80, total de R$ 960 |
| `notebook 3000 em 10x` | Total de R$ 3.000 em 10 parcelas |

## Identidade visual aprovada

- Estilo: acolhedor, organizado e com personalidade; evitar aparência financeira excessivamente tradicional.
- Temas: **claro e escuro**, ambos desenhados desde o início.
- Cor principal: **laranja queimado**. Violeta/lavanda foi rejeitado como cor principal.
- Tipografia: **Manrope para títulos e marca; Inter para textos e valores**.
- Formas suaves, cantos levemente arredondados, sombras discretas e destaque para a leitura dos números.
- Diferenciar receitas, despesas e alertas com rótulos/sinais além da cor. A paleta semântica desses estados ainda precisa ser definida.

Paleta-base aceita; contrastes finais devem ser validados nas telas:

| Elemento | Claro | Escuro |
| --- | --- | --- |
| Fundo | Creme `#FAF7F2` | Carvão quente `#191715` |
| Cards | Branco `#FFFFFF` | Marrom grafite `#25211E` |
| Cor principal | Laranja queimado `#B94B24` | Laranja suave `#F29B73` |
| Texto | Café escuro `#302721` | Creme claro `#F5EDE5` |
| Bordas | Areia `#E7DDD3` | Cinza quente `#403730` |

O site acompanha o tema do dispositivo e oferece Claro/Escuro/Sistema no Perfil. A preferência é salva somente neste navegador; credenciais não vão para localStorage.

## Logo e símbolo escolhidos

**Opção 2 — Conversa:** balão de conversa com a letra Z, acompanhado de “zelumi” em minúsculas, com Manrope.

- Laranja queimado no tema claro; laranja suave no escuro.
- Símbolo isolado para foto do bot, favicon e espaços pequenos.
- A escolha define a direção visual; ajustes ópticos e exportações finais podem ser feitos ao aplicá-lo.
- A marca foi aplicada no novo site e no favicon. A foto e o nome do bot ainda são provisórios.

Arquivos:

- [Logo claro](../design/zelumi/conceitos/02-conversa-light.svg)
- [Logo escuro](../design/zelumi/conceitos/02-conversa-dark.svg)
- [Símbolo claro](../design/zelumi/conceitos/02-conversa-simbolo-light.svg)
- [Símbolo escuro](../design/zelumi/conceitos/02-conversa-simbolo-dark.svg)
- [Comparação dos estudos](../design/zelumi/comparacao.png)

As opções 1 (Z contínuo) e 3 (Horizonte) foram exploradas; a opção escolhida foi a 2.

## Fora do escopo atual

- **Lembretes de contas:** ideia descartada pelo usuário para esta etapa. Não reintroduzir como próximo passo sem nova solicitação.
- Fechamento/vencimento de fatura e ciclo completo de cartões: adiado.
- Novos provedores de login: fora desta fase.
- IA, leitura de comprovantes, áudios e integração bancária: não fazem parte da implementação aprovada para a primeira versão do site.

## O que já funciona

- Bot real no Telegram por webhook, hospedado em Cloudflare Workers com D1.
- Registro por texto com regras, sem IA; perguntas, edição, desfazer e resumos.
- Data de envio da mensagem para interpretar compras enviadas antes do processamento.
- Isolamento por usuário, deduplicação de updates e fila persistente de respostas.
- Publicação registrada em [CLOUDFLARE.md](../CLOUDFLARE.md); o usuário confirmou resposta real com o programa local desligado.
- Site anterior em HTML/JS, com conversa simulada e dados locais no navegador. Ele não é o novo painel Next.js e não está conectado ao D1.

## Próxima etapa combinada

Confirmar o login Telegram com a conta real no domínio publicado e a continuidade do bot. Depois, detalhar a API financeira e a distribuição de parcelas por mês para conectar Visão geral e Lançamentos. A base do site está publicada, mas essas páginas ainda apresentam conexão pendente. Não iniciar funcionalidades apenas porque foram citadas como possibilidades.

## Prévia visual da Visão geral

Foi criada uma prévia independente em [design/zelumi/dashboard-preview.html](../design/zelumi/dashboard-preview.html), com dados fictícios, temas claro/escuro, comparação lado a lado, seletor de mês e detalhes de parcelas. As capturas estão na mesma pasta. É um estudo visual descartável para revisão, não a implementação Next.js nem uma conexão com o D1. A organização visual e as cores adicionais de categorias ainda aguardam avaliação do usuário. Nenhuma alteração foi publicada no bot ou no site existente nesta etapa.

### Revisão da prévia de Lançamentos

A prévia foi ampliada com busca por nome sem diferenciar maiúsculas/acentos, filtros combináveis, contagem de resultados, paginação e estado vazio. Como proposta para avaliação, a busca começa em todos os meses e permite limitar o período. O usuário confirmou a prioridade de busca pelo nome, mas ainda não aprovou o desenho dos controles nem o período padrão. A demonstração continua usando dados fictícios, independente da implementação do site e do bot.

### Aprovação da busca e ajuste do cabeçalho

O usuário aprovou a prévia de Lançamentos com a busca e os filtros apresentados. Também decidiu retirar do cabeçalho a bolinha verde e o texto de conta vinculada. O vínculo com Telegram deve ser informado no Perfil, sem sugerir presença online ou sincronização dos dados. O indicador foi removido da prévia.

### Prévia de Entrada e Perfil

Foram acrescentadas as duas telas ao estudo visual. Entrada com logo, exemplo de conversa e um único botão “Entrar com Telegram”. Perfil com conta fictícia, vínculo Telegram apenas nessa tela, preferência Claro/Escuro/Sistema e ação de sair. A preferência visual da demonstração fica salva no navegador. O botão de entrada informa que se trata de uma simulação antes de abrir o painel; sair retorna à tela de entrada. Não existe autenticação real nessa prévia.

A avaliação abrange os temas claro/escuro e a apresentação no celular. O usuário aprovou as telas de Entrada e Perfil apresentadas. A autenticação e a sessão continuam simuladas: a aprovação visual não significa que a integração real já foi implementada.

### Aprovação de Entrada e Perfil

O usuário confirmou que gostou das duas telas. Manter como referência o desenho apresentado, com logo e entrada exclusiva pelo Telegram; no Perfil, conta vinculada, preferência Claro/Escuro/Sistema e saída da sessão. A etapa seguinte é fechar as decisões técnicas pendentes antes da implementação real.

## Desenho técnico de hospedagem e autenticação

A arquitetura de Next.js estático na Cloudflare com autenticação/sessão/API no Worker foi aceita e implementada após aprovação do usuário. O desenho está registrado em [hospedagem e autenticação](./superpowers/specs/2026-11-02-zelumi-hospedagem-autenticacao-design.md), com revisão independente do desenho e do código.

Como escolhas técnicas propostas, o desenho coloca os assets e a API no mesmo endereço do Worker atual e define sessão de sete dias com cookie protegido. A proposta original de OIDC com PKCE foi substituída pelo Login Widget clássico na revisão abaixo, preservando o vínculo pelo ID numérico do Telegram; a exigência inicial de lista de usuários também foi substituída por cadastro aberto. Os endpoints financeiros e a migração para parcelas mensais continuam pendentes de detalhamento.

### Cadastro automático no site e no bot

O usuário aprovou retirar a liberação manual em ambos. No bot, a identidade de uma conversa privada válida basta para começar; não é necessário fazer login no site antes. No futuro site, o primeiro login Telegram válido cria ou atualiza o perfil e encontra os registros existentes pelo mesmo ID. O cadastro aberto não muda o isolamento entre usuários, a validação do webhook ou a proteção das sessões. Esta mudança de política não aprova implicitamente outros detalhes pendentes do desenho técnico.

### Configuração do domínio Telegram e escolha de protocolo

O usuário confirmou, pela resposta “Success! Domain updated.” do BotFather, a vinculação de `financeiro-testes-bot.miudo.workers.dev` ao bot `@financeiro_lab_482_bot` usando `/setdomain`. Essa confirmação corresponde à configuração do Login Widget clássico; não comprova cadastro OIDC nem emissão de Client ID/Client Secret. A documentação oficial distingue o widget clássico em `https://core.telegram.org/widgets/login-legacy` do fluxo OIDC em `https://core.telegram.org/bots/telegram-login`.

O desenho técnico anterior propunha OIDC. Após conferir a interface disponível, o usuário aprovou seguir com o **Login Widget clássico**, verificando no Worker os dados assinados com o token do bot já existente. Não são necessários Client ID ou Client Secret nesse método. O desenho técnico foi atualizado; não misturar validação do widget clássico, OIDC e Telegram Web Apps.

O plano está em [site e login Telegram](./superpowers/plans/2026-11-02-zelumi-site-login-telegram.md). A primeira entrega implementa estrutura Next.js/TypeScript/Tailwind/shadcn, botão oficial Telegram, validação no servidor, sessão e Perfil reais. Visão geral e Lançamentos mostram conexão pendente, sem misturar dados fictícios com a conta. API financeira e parcelas mensais continuam sendo a entrega seguinte.

Escolhas técnicas do implementador no plano: assets no mesmo Worker/endereço, sessão de sete dias, cookie protegido, fluxo temporário de dez minutos e proteções CSRF/replay. A aparência do botão incorporado obedece às opções oficiais do Telegram, mantendo o restante da identidade visual aprovada. Não há nova configuração obrigatória a pedir no BotFather para começar essa implementação.

### Implementação da base do site — 02/11/2026

O usuário aprovou executar o plano diretamente nesta sessão, mantendo um repositório único para site, bot e API. A estrutura Next.js foi criada em `web/`, com pacote e lock próprios. O `.gitignore` exclui builds, dependências, estado do Wrangler, credenciais e bancos locais. O README explica como enviar o conteúdo da pasta atual como raiz de um futuro repositório `zelumi`; nenhum envio ao GitHub foi feito.

Entrada, Perfil, temas e saída de sessão têm implementação real, junto da autenticação HMAC no Worker e tabelas aditivas de perfil/sessão no D1. Visão geral e Lançamentos exibem conexão pendente; sem exemplos financeiros na conta. O widget oficial é incorporado em um iframe com CSP própria porque seu parser de callback exige `eval`; o painel principal não recebe essa permissão. A mensagem desse iframe é validada por origem e janela antes do envio à API. O token do bot nunca entra no frontend.

Verificação: 50 testes de backend/D1 e 9 de interface passaram, junto com tipos, build estático e dry-run do Worker. A revisão independente encontrou duas corridas de sessão, ambas reproduzidas por testes e corrigidas. Firefox verificou hidratação, layout desktop/mobile sem overflow e tema escuro. No ambiente local, uma identidade assinada somente com token falso confirmou cookies, Perfil e logout reais.

Publicado em `https://financeiro-testes-bot.miudo.workers.dev`, versão `e40e45aa-a2b5-4d95-a19c-4788c9f66ba5`. Migração aditiva `0002_web_auth.sql` aplicada. Páginas200, sessão anônima401 sem apagar cookies, API desconhecidaJSON404, asset inexistente404, saúde200 e webhook sem segredo401 conferidos em produção. O widget oficial carregou no Firefox pelo domínio vinculado. Webhook ativo, sem updates pendentes ou último erro de entrega.

Pendências externas: confirmação humana de login/Perfil com a conta real e `/hoje` no bot após essa publicação, solicitadas ao usuário. CPU por requisição e folga nas cotas gratuitas não foram medidas; não houve ativação de plano pago. GitHub permanece para depois: branch `feat/zelumi-web-login` preservada, sem push ou merge.
