# Zelumi — decisões do projeto

Atualizado em 02/11/2026. Este documento reúne as decisões da conversa e diferencia o produto planejado do código que já está em funcionamento. Ao mudar uma decisão com o usuário, atualizar este registro.

### Controles próprios em todo o painel — 02/11/2026

Ajuste posterior solicitado pelo usuário: a sombra compartilhada dos menus e calendários passou a usar preto translúcido, com menor deslocamento e dispersão. A derivação anterior de `--ink` produzia um halo claro no tema escuro. Guia e token foram corrigidos juntos.

O usuário aprovou padronizar os controles de todo o painel após apontar o menu nativo azul e o seletor de mês em inglês no editor. Foram criados campos, menus, tipo segmentado, controles numéricos, calendários, seletor de mês e botões de ícone compartilhados, com a identidade existente. Editor, filtros, busca, Visão geral e ações compactas da navegação usam esses componentes. Os cartões de tema do Perfil permanecem no padrão próprio existente.

Radix Select/Popover e React DayPicker fornecem interação e acessibilidade, sem importar aparência pronta. Cores, fontes, raios, foco e seleção seguem tokens do Zelumi. Datas e meses são exibidos em português, com validação de limites. Guia, tokens e estilos foram atualizados juntos; layout compartilhado, operações financeiras e temas são preservados. Implementação local, sem publicação nesta entrega.

Verificação: 46 testes de interface, 92 de backend/D1, TypeScript, build e exportação passaram. Firefox verificou os temas claro/escuro em 320, 390, 760, 1068 e 1280 px, textos longos, valor alto, menus no diálogo nativo, digitação e setas, Escape e retorno de foco. A revisão independente identificou entradas inválidas de ano, corrigidas com regressões antes/depois. Nenhuma compra real foi alterada nos testes.

### Categorias prontas mais completas — 02/11/2026

O usuário escolheu ampliar as categorias prontas compartilhadas e aprovou a implementação descrita em [Categorias](./CATEGORIAS.md). A lista passa a ter 13 categorias de despesas e Receitas, acrescentando Educação, Lazer, Compras, Assinaturas, Cuidados pessoais, Pets, Viagens e Impostos e taxas.

Bot, validação da API, filtros e editor do painel compartilham o catálogo. A classificação usa palavras completas e expressões específicas, ignora acentos e maiúsculas e retorna Outros em conflitos entre categorias. Registros existentes não são recategorizados automaticamente. A limpeza da descrição foi corrigida para preservar palavras acentuadas, como saúde. Implementação local; publicação não faz parte desta entrega.

Verificação: 92 testes de backend/D1 e 34 de interface passaram, junto com build estático, TypeScript e conferência da exportação. A revisão independente não encontrou problemas relevantes pendentes. Nenhum dado real foi alterado.

## Produto e nome

- Nome escolhido: **Zelumi**.
- Objetivo: gerenciamento financeiro pessoal com registro rápido de receitas e despesas pelo Telegram e acompanhamento visual pelo site.
- Telegram: entrada cotidiana de lançamentos, perguntas sobre informações faltantes, correção, desfazer e consultas.
- Site: visão mensal, consulta e gerenciamento dos lançamentos reais do mesmo usuário.
- A identidade ativa é Zelumi, com bot `@zelumi_bot` e banco local padrão `data/zelumi.sqlite`. A migração dos identificadores remotos está descrita em [NOMES-INFRAESTRUTURA.md](./NOMES-INFRAESTRUTURA.md).
- Username `@zelumi_bot` criado e validado, e endereço `usezelumi.vercel.app` publicado. Disponibilidade jurídica da marca e de domínio próprio não foi verificada; não apresentar exclusividade como confirmada.
- A assinatura “suas finanças em poucas palavras” foi sugerida, mas não foi escolhida explicitamente como slogan definitivo.

## Stack definida

| Parte | Decisão | Situação |
| --- | --- | --- |
| Interface do novo site | Next.js + TypeScript | Telas financeiras e dados reais implementados e publicados |
| Estilização | Tailwind CSS | Implementado no site |
| Componentes | shadcn/ui, personalizados | Button e Card implementados |
| Backend e bot | Cloudflare Workers | Bot implementado e publicado |
| Banco de dados | Cloudflare D1 | Compartilhado pelo bot e pela API financeira do site |
| Autenticação do site | Apenas Telegram nesta fase | Widget clássico + sessão publicados e confirmados pelo usuário |
| Operação inicial | Priorizar franquias gratuitas e acompanhar consumo | Sem compromisso de gratuidade ilimitada |

Next.js exporta arquivos estáticos em `web/out`, servidos junto da API no Worker existente. Site e bot ficam no mesmo repositório e no mesmo domínio Cloudflare. Não utiliza adaptador de SSR, vinext ou OpenNext.

Zod foi sugerido para validação, mas nenhuma biblioteca de validação, autenticação, gráficos ou acesso aos dados foi escolhida definitivamente.

## Acesso e dados

- Única forma de login escolhida: Telegram. E-mail/senha e outros provedores ficam fora desta fase.
- Cada usuário deve acessar apenas seus próprios registros, com validação no backend.
- Cadastro aberto no site e no bot, sem lista de IDs ou aprovação manual. O usuário pode divulgar o link individualmente, mas qualquer pessoa que chegar ao serviço pode entrar pelo Telegram. Cada pessoa vê somente seus próprios dados.
- O site usa o Login Widget clássico oficial do Telegram, perfil interno e sessão protegida. Validação, cookies e vínculo pelo ID numérico estão implementados; o usuário confirmou o login real e a identificação correta no Perfil.
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

## Compras parceladas — regra implementada

- Mostrar o valor de cada parcela no seu respectivo mês, como uma visão mensal de compromissos.
- Exemplo: compra de R$ 1.000 em 10 parcelas aparece como R$ 100 por mês durante 10 meses.
- Primeira parcela no mês da compra, com possibilidade de ajustar o mês inicial.
- Despesas à vista entram integralmente no mês correspondente.
- Preservar o valor total da compra no histórico, junto com o andamento das parcelas e seus meses.
- Não somar o valor integral da compra novamente ao total mensal quando suas parcelas já estão sendo contabilizadas.
- O comportamento deve ser consistente entre o site e o resumo mensal do bot.
- Preservar a soma exata dos centavos ao distribuir parcelas.
- Edição no site atua na compra inteira e recalcula todas as parcelas; sem edição isolada de uma parcela nesta versão. Decisão confirmada pelo usuário após a conexão inicial do site.
- Fechamento e vencimento de fatura ficam para depois. Esta fase não implementa um ciclo real de cartão de crédito.

**Situação atual:** `/mes` e o site usam as parcelas de cada mês, preservando centavos e o valor total nos detalhes. `/hoje` e `/resumo` mantêm valores integrais pela data da compra, com explicação na resposta. Site permite editar a compra inteira e ajustar seu mês inicial; a exclusão afeta todas as parcelas.

Sintaxes já implementadas no interpretador:

| Mensagem | Interpretação atual |
| --- | --- |
| `google 1000 x12` | Total de R$ 1.000 em 12 parcelas |
| `google 12x 80` | 12 parcelas de R$ 80, total de R$ 960 |
| `notebook 3000 em 10x` | Total de R$ 3.000 em 10 parcelas |

## Identidade visual aprovada

O padrão de aplicação atual foi consolidado no [Guia visual do Zelumi](../design/GUIA-VISUAL.md), com [tokens compartilhados](../web/app/tokens.css). Esta seção preserva a direção aprovada; consultar o guia para construir novas telas e manter os ajustes recentes de leitura, componentes e navegação.

- Estilo: acolhedor, organizado e com personalidade; evitar aparência financeira excessivamente tradicional.
- Temas: **claro e escuro**, ambos desenhados desde o início.
- Cor principal: **laranja queimado**. Violeta/lavanda foi rejeitado como cor principal.
- Tipografia: **Manrope para títulos e marca; Inter para textos e valores**.
- Formas suaves, cantos levemente arredondados, sombras discretas e destaque para a leitura dos números.
- Diferenciar receitas, despesas e alertas com rótulos/sinais além da cor. O padrão atual usa verde para receitas/positivo e o destaque da marca para despesas/ações; os estados e as restrições de uso estão no guia visual. Uma paleta adicional de alertas exige definição e validação próprias.

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
- A marca foi aplicada no novo site e no favicon. O bot definitivo usa nome Zelumi e username `@zelumi_bot`; o usuário confirmou a foto com o símbolo da versão escura aplicado ao perfil.

Arquivos:

- [Logo claro](../design/zelumi/conceitos/02-conversa-light.svg)
- [Logo escuro](../design/zelumi/conceitos/02-conversa-dark.svg)
- [Símbolo claro](../design/zelumi/conceitos/02-conversa-simbolo-light.svg)
- [Símbolo escuro](../design/zelumi/conceitos/02-conversa-simbolo-dark.svg)

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
- O site anterior em HTML/JS simulava uma conversa e usava dados locais no navegador. Seu código foi retirado após a implementação do painel Next.js; permanece recuperável pelo histórico Git.

## Próxima etapa combinada

API financeira e telas conectadas publicadas. O usuário confirmou que os lançamentos aparecem, os totais coincidem com `/mes` e a edição/exclusão funcionou em um registro de teste escolhido por ele. Não iniciar novas funcionalidades apenas porque foram citadas como possibilidades.

## Prévia visual da Visão geral

Foi criada uma prévia independente com dados fictícios, temas claro/escuro, comparação lado a lado, seletor de mês e detalhes de parcelas. Era um estudo visual descartável para revisão, anterior à implementação Next.js e sem conexão com o D1. As aprovações estão registradas abaixo. A prévia e suas capturas foram removidas na preparação para o GitHub, após a implementação do site, e permanecem no histórico Git.

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

A arquitetura de Next.js estático na Cloudflare com autenticação/sessão/API no Worker foi aceita e implementada após aprovação do usuário. O desenho e o código passaram por revisão independente; as decisões principais estão registradas nesta seção.

Como escolhas técnicas propostas, o desenho coloca os assets e a API no mesmo endereço do Worker atual e define sessão de sete dias com cookie protegido. A proposta original de OIDC com PKCE foi substituída pelo Login Widget clássico na revisão abaixo, preservando o vínculo pelo ID numérico do Telegram; a exigência inicial de lista de usuários também foi substituída por cadastro aberto. Os endpoints financeiros e a migração para parcelas mensais continuam pendentes de detalhamento.

### Cadastro automático no site e no bot

O usuário aprovou retirar a liberação manual em ambos. No bot, a identidade de uma conversa privada válida basta para começar; não é necessário fazer login no site antes. No futuro site, o primeiro login Telegram válido cria ou atualiza o perfil e encontra os registros existentes pelo mesmo ID. O cadastro aberto não muda o isolamento entre usuários, a validação do webhook ou a proteção das sessões. Esta mudança de política não aprova implicitamente outros detalhes pendentes do desenho técnico.

### Configuração do domínio Telegram e escolha de protocolo

O usuário confirmou, pela resposta “Success! Domain updated.” do BotFather, a vinculação do domínio Cloudflare então utilizado ao bot de testes então utilizado usando `/setdomain`. Essa confirmação corresponde à configuração do Login Widget clássico; não comprova cadastro OIDC nem emissão de Client ID/Client Secret. A documentação oficial distingue o widget clássico em `https://core.telegram.org/widgets/login-legacy` do fluxo OIDC em `https://core.telegram.org/bots/telegram-login`.

O desenho técnico anterior propunha OIDC. Após conferir a interface disponível, o usuário aprovou seguir com o **Login Widget clássico**, verificando no Worker os dados assinados com o token do bot já existente. Não são necessários Client ID ou Client Secret nesse método. O desenho técnico foi atualizado; não misturar validação do widget clássico, OIDC e Telegram Web Apps.

A primeira entrega implementou estrutura Next.js/TypeScript/Tailwind/shadcn, botão oficial Telegram, validação no servidor, sessão e Perfil reais. Visão geral e Lançamentos mostram conexão pendente, sem misturar dados fictícios com a conta. API financeira e parcelas mensais continuam sendo a entrega seguinte.

Escolhas técnicas do implementador no plano: assets no mesmo Worker/endereço, sessão de sete dias, cookie protegido, fluxo temporário de dez minutos e proteções CSRF/replay. A aparência do botão incorporado obedece às opções oficiais do Telegram, mantendo o restante da identidade visual aprovada. Não há nova configuração obrigatória a pedir no BotFather para começar essa implementação.

### Implementação da base do site — 02/11/2026

O usuário aprovou executar o plano diretamente nesta sessão, mantendo um repositório único para site, bot e API. A estrutura Next.js foi criada em `web/`, com pacote e lock próprios. O `.gitignore` exclui builds, dependências, estado do Wrangler, credenciais e bancos locais. O README explica como enviar o conteúdo da pasta atual como raiz de um futuro repositório `zelumi`; nenhum envio ao GitHub foi feito.

Entrada, Perfil, temas e saída de sessão têm implementação real, junto da autenticação HMAC no Worker e tabelas aditivas de perfil/sessão no D1. Visão geral e Lançamentos exibem conexão pendente; sem exemplos financeiros na conta. O widget oficial é incorporado em um iframe com CSP própria porque seu parser de callback exige `eval`; o painel principal não recebe essa permissão. A mensagem desse iframe é validada por origem e janela antes do envio à API. O token do bot nunca entra no frontend.

Verificação: 50 testes de backend/D1 e 9 de interface passaram, junto com tipos, build estático e dry-run do Worker. A revisão independente encontrou duas corridas de sessão, ambas reproduzidas por testes e corrigidas. Firefox verificou hidratação, layout desktop/mobile sem overflow e tema escuro. No ambiente local, uma identidade assinada somente com token falso confirmou cookies, Perfil e logout reais.

Publicado no endereço Cloudflare então utilizado, versão `e40e45aa-a2b5-4d95-a19c-4788c9f66ba5`. Migração aditiva `0002_web_auth.sql` aplicada. Páginas200, sessão anônima401 sem apagar cookies, API desconhecidaJSON404, asset inexistente404, saúde200 e webhook sem segredo401 conferidos em produção. O widget oficial carregou no Firefox pelo domínio vinculado. Webhook ativo, sem updates pendentes ou último erro de entrega.

Validação externa concluída: o usuário confirmou que entrou pelo Telegram, viu a conta correta no Perfil e recebeu a resposta de `/hoje` com o programa local desligado. CPU por requisição e folga nas cotas gratuitas não foram medidas; não houve ativação de plano pago. GitHub permanece para depois: branch `feat/zelumi-web-login` preservada, sem push ou merge.

### Entrega de dados financeiros

O usuário pediu conectar os lançamentos ao site e confirmou **editar a compra inteira e recalcular todas as parcelas**, sem edição isolada. O desenho reuniu regras, API, concorrência, busca/filtros, migração e telas. Após revisão independente, o usuário aprovou o desenho e o plano de implementação, executado diretamente na sessão. API e telas foram implementadas e a migração aditiva0003 foi aplicada; o agente não alterou valores financeiros reais para testar.

Funcionamento aprovado e implementado: cálculo mensal no servidor sobre cronogramas existentes; receitas já parceladas seguem seu cronograma; `/hoje` mantém valores integrais pela data da compra com explicação no texto, enquanto `/mes` e site usam parcelas mensais. Os formulários permitem editar a compra toda e excluir todas as suas parcelas, informando o efeito inclusive em meses anteriores.

Publicado em 02/11/2026, versão `d3edc342-66e2-43fa-b1b1-05d3578bab11`, no Worker existente. 66 testes backend/D1 e15 testes da interface passaram, junto com tipos, build/export e dry-run. A revisão independente identificou três corridas (replay, troca de conta e snapshot na importação), reproduzidas e corrigidas. Firefox verificou overview/histórico/formulário nos temas claro/escuro e celular390px, foco do diálogo, edição e exclusão usando somente usuários e dados locais fictícios.

Em produção, páginas200, endpoints financeiros anônimos401, rota inexistenteJSON404, saúde200 e webhook sem segredo401 conferidos. Webhook ativo, sem mensagens pendentes ou último erro. Validação externa concluída: o usuário confirmou lançamentos visíveis, totais iguais aos de `/mes` e edição/exclusão funcionando em um registro de teste. CPU por requisição não medida; startup não substitui essa métrica. Sem ativar plano pago ou enviar GitHub; branch `feat/zelumi-finance` preservada.

### Preparação para GitHub — 02/11/2026

O usuário escolheu preparar primeiro um repositório privado `zelumi`, com o produto inteiro, preservando o histórico de desenvolvimento. A atualização dos nomes oficiais fica para depois. O [guia de primeiro envio](./GITHUB.md) documenta o conteúdo, exclusões, instalação e conexão futura ao remoto. Não foi configurado remoto, feito push ou criado deploy automático.

Foram ampliadas as exclusões de bancos, logs e credenciais locais e definida a normalização de texto para LF. A revisão de caminhos e conteúdo do histórico não encontrou as credenciais locais comparadas nem os padrões de segredo pesquisados. Uma cópia limpa passou instalação pelos lockfiles, 66 testes de backend/D1, 15 de interface, tipos e build/export sem credenciais reais. O código em produção não mudou nesta etapa.

Os planos, especificações e notas auxiliares foram removidos de `docs/superpowers/` a pedido do usuário. Este arquivo preserva as decisões aprovadas; os documentos completos continuam recuperáveis pelo histórico Git.

### Padronização local de nomes e código compartilhado

O usuário aprovou padronizar a pasta local como `zelumi`, atualizar os textos do bot e as instruções e separar o interpretador em `shared/parser.mjs`, com atualização dos imports. O protótipo antigo de `dist/` e seu comando `npm start` foram retirados. A configuração original do Sites foi arquivada em [archive/sites-hosting.json](./archive/sites-hosting.json), preservando a identidade anterior sem alterar o Site remoto.

O SQLite local usava o caminho disponível naquela etapa; a configuração atual é `BOT_DB_PATH=./data/zelumi.sqlite`. Os dados anteriores foram preservados em backup privado externo ao projeto. O Worker, D1, webhook, endereço publicado e username do bot continuam com os identificadores atuais. Esta preparação não publica as mudanças nem faz push ao GitHub.

Verificação após renomear a pasta: 66 testes de backend/D1 e 15 testes de interface passaram, junto com tipos, build/export e dry-run do Worker. Os links locais foram conferidos e o conteúdo do parser foi preservado integralmente na mudança de caminho. Reabrir a pasta `zelumi` no editor após a renomeação local.

### Endereço público e integração Vercel

O usuário escolheu `usezelumi.vercel.app` e já publicou o frontend pelo projeto Vercel `zelumi`, conectado ao GitHub, com Root Directory `web`. Aprovou ajustar login e API mantendo bot, D1 e webhook na Cloudflare. O [guia da Vercel](./VERCEL.md) reúne configuração, ordem de troca, validação e retorno ao endereço anterior.

As rotas em `web/vercel.json` preservam caminhos, cookies, métodos e corpos para `/auth` e `/api`, sem cache de dados autenticados. Os arquivos estáticos têm cabeçalhos próprios, com CSP isolada para o widget Telegram. Uma chave independente `VERCEL_PROXY_SECRET`, configurada somente nos servidores, permite confiar no IP de visitante encaminhado pela Vercel para separar os limites de login. Token Telegram e segredo do webhook não vão para a Vercel.

69 testes de backend/D1 e 15 de interface passaram, junto com tipos, build/export e dry-run. O limite compartilhado pelo IP do proxy foi reproduzido antes da correção. A revisão independente não encontrou problemas críticos ou importantes; o encaminhamento público ainda deve ser conferido antes da troca de `APP_ORIGIN`. O domínio precisa ser vinculado pelo usuário no BotFather após essa preparação.

Publicação realizada: o usuário confirmou a variável do proxy na Vercel e a mesma chave foi cadastrada no Worker, preservando os segredos anteriores. `1955e8d` foi enviado à `main` e a publicação Vercel concluiu com sucesso. O encaminhamento público foi validado antes de atualizar `APP_ORIGIN` para `https://usezelumi.vercel.app`; o Worker foi publicado na versão `6a9b984d-a3c0-45f3-a645-41f983c9654e`. Início de login e cookie protegido, cabeçalhos das páginas/widget, API anônima e bloqueio de origens incorretas foram conferidos em produção. Confirmação de domínio no BotFather e uso autenticado real permanecem pendentes do usuário. O bot mantém o mesmo username, webhook e banco.

### Bot definitivo — Zelumi / @zelumi_bot

O usuário criou o bot definitivo, ID numérico `9056845961`, e informou o token somente no `.env` local. A integração foi trocada de um bot de testes, preservando o mesmo D1 e os dados pelo ID do usuário Telegram. A migração `0004_bot_transition.sql` troca apenas estado operacional e vínculo; as sessões anteriores foram revogadas e é necessário entrar novamente pelo bot novo.

A conferência por SHA-256 confirmou os 7 lançamentos, projeções e perfis idênticos antes/depois. Webhook antigo desativado, token anterior preservado em backup privado externo ao projeto e novo webhook ativo no mesmo Worker, versão `5994e736-d2c5-4158-b527-3a22bee0c81b`. O usuário confirmou `/setdomain` no novo bot. 78 testes backend/D1 e 15 de interface, tipos, build/export e dry-run passaram; uma corrida de sessão encontrada na revisão foi reproduzida e corrigida. Validação externa concluída: o usuário confirmou resposta de `/hoje` no novo bot com o programa local desligado e login real no site com conta e lançamentos anteriores corretos. Procedimento e recuperação em [BOT.md](./BOT.md).

### Acesso ao painel pela ajuda do bot

O usuário aprovou acrescentar `https://usezelumi.vercel.app` e um botão de URL **Abrir meu painel** à resposta de `/ajuda`. `/start` e `/help` reutilizam a mesma resposta. O botão abre o site pelo link comum, sem integração de Mini App. A ajuda preserva perguntas de compra pendentes e não cria lançamentos. Verificação: 79 testes de backend/D1 e build/export/dry-run passaram; o teste novo detectou a ausência do acesso ao painel na versão anterior.

Publicado no Worker na versão `5fef82b1-b92e-42d5-8f23-93323aee09f3`. Webhook permaneceu ativo, sem updates pendentes ou último erro de entrega. Nenhuma compra real foi criada ou alterada para testar a ajuda.


### Limpeza aprovada e documentação atual — 02/11/2026

O desenvolvimento principal do site usa `npm run dev`, com Next.js e Worker locais, login de teste e D1 fictício persistente. `web:dev` é o modo isolado de interface e `cf:dev` permanece como alternativa de exportação estática com Worker. O README concentra as instruções atuais, sem duplicação de seções.

A identidade e os padrões atuais ficam no [guia visual](../design/GUIA-VISUAL.md); escopo, correções e capturas estão na [auditoria visual](../design/AUDITORIA-VISUAL.md). A navegação usa layout compartilhado, preferência de barra recolhida e menu modal no celular.

Após a [varredura de arquivos](./INVENTARIO-ARQUIVOS.md), o usuário aprovou a limpeza. Foram retirados os quatro planos internos de `docs/superpowers/`, materiais antigos de `.superpowers/` e logs selecionados, com recuperação privada em `data/manutencao/`. Caches antigos de build/desenvolvimento foram limpos, preservando dependências, o servidor local ativo, o D1, SQLite, backups e autenticação. Os documentos permanentes preservam as decisões dos planos removidos. Nenhum envio ao GitHub ou deploy faz parte desta limpeza.

### Consolidação dos nomes — 02/11/2026

Código e exemplos locais usam Zelumi. As credenciais e o SQLite do ambiente anterior foram retirados da pasta do projeto e preservados em backup privado externo, sem alterar o vínculo dos bancos ou reimportar dados. A etapa local foi seguida pela migração autorizada dos recursos remotos para Zelumi, descrita no guia de infraestrutura.

### Migração da infraestrutura para Zelumi

Após autorizar a janela de manutenção, o usuário confirmou acesso para publicar a Vercel. Worker `zelumi-bot`, subdomínio `zelumi.workers.dev` e D1 `zelumi` preparados e copiados com preservação integral das 13 tabelas e dos 7 lançamentos, conferida por SHA-256 antes de reabrir o processamento. Credenciais e bot permanecem os do Zelumi. Backup privado externo mantém a recuperação. O proxy local foi atualizado; a publicação Vercel e a validação real pelo usuário permanecem pendentes.
