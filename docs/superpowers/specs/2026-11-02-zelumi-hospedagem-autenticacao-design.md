# Zelumi — hospedagem e autenticação do painel

Data: 02/11/2026. Estado: proposta técnica para revisão do usuário.

## 1. Objetivo e alcance

Fechar a arquitetura de hospedagem e de login do novo painel, preservando o bot publicado e os registros existentes. O usuário escolheu Next.js, TypeScript, Tailwind CSS, shadcn/ui e login exclusivamente pelo Telegram; aprovou os estudos de Entrada, Visão geral, Lançamentos e Perfil conforme registrado em [DECISOES.md](../../DECISOES.md).

Este desenho cobre a base do site, a publicação estática, autenticação, sessão e identidade para acesso ao banco. Não especifica ainda os endpoints financeiros, a migração para parcelas mensais ou as regras de editar uma compra versus editar uma parcela. Esses itens são dependências da conexão completa do painel aos dados e serão detalhados antes de sua implementação.

O objetivo desta fase não é publicar uma tela com valores fictícios como se fossem reais. Após a base, qualquer área de dados que ainda não esteja conectada deve apresentar seu estado explicitamente, sem dados de demonstração misturados a uma conta real.

## 2. Situação atual

- `cloudflare/worker.mjs` atende `/telegram/webhook` e `/health`; o cron reenvia respostas pendentes.
- O Worker `financeiro-testes-bot` está publicado em `https://financeiro-testes-bot.miudo.workers.dev`.
- D1 `financeiro-testes`, já vinculado em `wrangler.jsonc`, guarda compras e receitas em `cloud_records`. A coluna `owner` é o ID numérico do usuário Telegram, convertido em texto.
- O bot limita o acesso pela lista `TELEGRAM_ALLOWED_USER_IDS` e evita duplicações por `update_id`, com controle de versão por usuário.
- Não existem API de sessão nem login de usuário no Worker.
- `dist/` contém o simulador antigo, publicado separadamente pelo Sites. A identidade desse Site está em `.openai/hosting.json`.
- `design/zelumi/` contém estudos HTML/JS, fontes e logos. As telas de login são simulações, sem credenciais.
- Os resumos atuais ainda usam o total da compra. A distribuição de parcelas por mês está aprovada, mas pendente de implementação.

## 3. Abordagens consideradas

### A. Next.js estático + API no Worker — caminho escolhido

O usuário aceitou seguir com Next.js estático na Cloudflare e autenticação/sessão/API no Worker. A proposta técnica é publicar os arquivos estáticos no **mesmo Worker e endereço da API**, usando Workers Static Assets.

Vantagens: reaproveita o D1 e o bot, evita dois domínios e cookies entre origens, e não requer servidor Next.js permanente ou adaptador de SSR. O frontend e a API podem ser desenvolvidos em módulos separados, apesar da publicação conjunta.

Limitação: recursos de Next.js que exigem servidor em tempo de requisição não serão utilizados. Autorização depende da API, não da proteção do HTML estático. Site e bot terão publicação conjunta; testes de regressão e rollback são necessários.

### B. Site estático em outro endereço + Worker de API

Foi considerada como alternativa de implantação da mesma stack. Separaria os deploys, mas acrescentaria CORS, tratamento de cookies entre origens ou proxy e mais configurações. Não é recomendada para este piloto, que prioriza simplicidade e custo.

### C. Next.js com renderização no servidor

Permite funcionalidades de servidor do framework, mas exigiria outra configuração de execução e avaliação de consumo. Não é o caminho proposto para o painel inicial, nem uma migração necessária para autenticação.

## 4. Organização e publicação propostas

- Novo frontend em `web/`, com dependências e configuração próprias. Não substituir `dist/` nem mover o interpretador do bot como efeito colateral desta fase.
- Next.js App Router com `output: 'export'` e `trailingSlash: true`; saída em `web/out/`.
- Páginas: `/` (entrada), `/visao-geral/`, `/lancamentos/` e `/perfil/`.
- Dados pessoais são buscados no navegador após confirmar a sessão. Nenhum dado financeiro, perfil real ou segredo entra no HTML gerado no build.
- `wrangler.jsonc` passa a apontar os assets para `web/out`, com binding `ASSETS`. Isso não exige alterar `.openai/hosting.json` ou a audiência do protótipo antigo no Sites.
- O Worker tem precedência nas rotas `/api/*`, `/auth/*`, `/telegram/webhook` e `/health`. Incluir também `/api` e `/auth` sem barra nos casos de erro, evitando que sejam tratados como páginas.
- Arquivos estáticos são servidos pelo mecanismo de assets; em rotas de aplicação que alcancem o handler, usar `ASSETS.fetch`. Rotas de API desconhecidas devolvem erro JSON, não fallback HTML.
- Manter 404 de assets e rotas reais; não usar fallback genérico que esconda erros de API.
- Preservar o endereço e o segredo do webhook Telegram, o banco atual e seu cron. Não criar outro bot ou outro D1 nesta fase.
- Endereço inicial: o `workers.dev` atual. Domínio próprio e eventual mudança do endereço são decisões futuras; qualquer alteração exigirá atualizar os URLs autorizados no Telegram.
- Buscar permanecer no plano gratuito. A implementação não deve ativar assinatura paga. Medir uso real de requisições, CPU e D1; a arquitetura não garante gratuidade ilimitada.

## 5. Login oficial pelo Telegram

Usar **OpenID Connect, Authorization Code Flow com PKCE S256**, por redirecionamento de página inteira, sem popup ou biblioteca externa de widget no navegador nesta fase.

Escopos: `openid profile`. Não solicitar telefone, e-mail ou permissão adicional de envio de mensagens para realizar o login.

### Preparação externa

No BotFather, configurar o login do mesmo bot do piloto, registrar a origem HTTPS da aplicação e o retorno exato:

`https://financeiro-testes-bot.miudo.workers.dev/auth/telegram/callback`

Obter Client ID e Client Secret de login. O Client Secret de OIDC é uma credencial distinta do token da Bot API; não assumir que um substitui o outro. Configurá-lo no armazenamento de segredos da Cloudflare, por stdin ou pelo painel, sem imprimir valores.

### Fluxo

1. O botão da tela de entrada navega para `GET /auth/telegram/start`.
2. O Worker cria `state`, `nonce` e um verificador PKCE aleatórios, salva um fluxo de curta duração no D1 e coloca um cookie temporário HttpOnly para vinculá-lo ao navegador solicitante.
3. O Worker redireciona para a autorização do Telegram, com callback fixo e previamente cadastrado. Não aceitar destinos de retorno arbitrários fornecidos pelo navegador.
4. O Telegram devolve `code` e `state` para `GET /auth/telegram/callback`.
5. O Worker confere cookie, state, expiração e uso único. O consumo do fluxo deve ser atômico no D1, para callbacks concorrentes não reutilizarem a autorização.
6. O Worker troca o code por tokens no servidor, usando Client Secret e o verificador PKCE.
7. Validar a assinatura do ID token pelas chaves oficiais, o algoritmo esperado, emissor, audiência, validade temporal e nonce. Usar biblioteca mantida compatível com Web Crypto/Workers; não escrever um verificador JWT próprio. `jose` é a proposta técnica, sujeita à verificação de compatibilidade no plano.
8. Extrair o ID Telegram autenticado, verificar a lista de usuários liberados e criar/atualizar apenas o perfil correspondente.
9. Criar uma sessão própria da aplicação e redirecionar para `/visao-geral/`, sem levar tokens para o frontend ou para a URL final.

Dados de `code`, state, cookies e tokens não são registrados em logs. Respostas de autenticação e sessão usam `Cache-Control: no-store`.

## 6. Identidade e proteção dos registros

O campo OIDC `sub` e o ID numérico Telegram **não são intercambiáveis**. O escopo `profile` fornece o claim `id`, que deve ser validado como ID numérico positivo seguro e convertido para a forma textual canônica usada por `cloud_records.owner`.

- Registrar a relação entre emissor/subject OIDC e o ID Telegram em uma tabela de usuários, com unicidade de ambas as identidades.
- Para o mesmo ID Telegram, reusar o usuário existente; rejeitar uma associação conflitante, sem transferir dados automaticamente.
- Não usar `@username`, nome, foto ou um ID enviado pelo frontend como prova de identidade. Nome e username são dados de apresentação; username pode estar ausente ou mudar.
- Caso o ID obrigatório esteja ausente ou inválido, rejeitar o login; não tentar interpretar `sub` como o ID da Bot API.
- Preservar `cloud_records.owner` e os registros existentes; não requer recadastro de despesas ou cópia para um novo banco.
- Toda consulta financeira futura deverá obter o owner a partir da sessão verificada e aplicar esse escopo no SQL.
- Continuar usando `TELEGRAM_ALLOWED_USER_IDS` como autorização do piloto. Confirmar autorização no login e em cada acesso protegido; remover o ID da lista deve bloquear sessões existentes, mesmo antes de expirarem.

## 7. Sessões e saída

Propostas do implementador para revisão:

- Sessão da aplicação com duração absoluta de **7 dias**, sem renovação automática nesta fase.
- Cookie `__Host-zelumi_session`, com valor aleatório de pelo menos 256 bits, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, sem atributo Domain e com prazo alinhado ao servidor.
- Guardar somente o hash do token de sessão no D1, junto com usuário, criação, expiração e token de proteção CSRF. Não guardar token de sessão ou JWT em localStorage.
- Fluxo de login válido por **10 minutos**, com cookie temporário protegido e limpeza após sucesso, recusa ou expiração.
- Validar sessão e autorização pelo banco em cada requisição protegida; não manter cache que permita reutilizar sessão revogada.
- `POST /api/session/logout` invalida a sessão atual no D1 e apaga o cookie. Não desconecta a conta Telegram, não revoga outras sessões e não altera o uso do bot.
- GET não deve executar operações destrutivas. Logout e futuras alterações exigem Origin igual à origem configurada, JSON e token CSRF da sessão em header. Sem CORS aberto para origens externas.
- Usar a rotina agendada existente para limpar sessões e fluxos expirados. A expiração é sempre verificada na requisição, independentemente dessa limpeza.
- Requisições de início de login têm limitação de tentativas na aplicação, com ponto de partida de 5 inícios por 10 minutos por identificador de rede e armazenamento temporário. O plano deve definir uma implementação que não adicione serviço pago ou exponha identificadores em logs.

O prazo de sessão do Zelumi não depende do prazo do ID token usado no login: o token é verificado no início, e a sessão é controlada pela aplicação. Logins novos dependem do Telegram; uma sessão já válida pode continuar acessando a API enquanto os serviços do Zelumi estiverem disponíveis.

## 8. Contratos mínimos desta fase

| Rota | Função |
| --- | --- |
| `GET /auth/telegram/start` | Inicia autorização OIDC e redireciona |
| `GET /auth/telegram/callback` | Valida retorno e cria sessão |
| `GET /api/session` | Retorna perfil mínimo da sessão e token CSRF, ou 401/403 |
| `POST /api/session/logout` | Invalida a sessão atual com proteção CSRF |
| `POST /telegram/webhook` | Mantém o bot existente |
| `GET /health` | Mantém a verificação atual; não divulga configuração sensível |

`GET /api/session` retorna apenas dados necessários ao Perfil, como nome e username opcionais, além do token CSRF. Nunca retorna ID token, Client Secret, token do bot ou identificador bruto de sessão.

Estados do frontend: carregando sessão, autenticado, não autenticado, acesso não liberado e falha temporária. Um 401 retorna à entrada; um 403 informa acesso não liberado sem mostrar registros. Recusar autorização no Telegram permite tentar novamente. Erros técnicos não são apresentados como se a pessoa tivesse digitado uma senha errada.

As páginas protegidas são estruturas estáticas públicas, mas só exibem dados reais após a API validar a sessão. Isso é intencional; esconder páginas no frontend não substitui autorização.

## 9. Migrações e preservação do bot

Adicionar tabelas de usuários, sessões, fluxos OIDC e controle de tentativas em uma migração nova e aditiva. Não editar a migração inicial já aplicada, apagar tabelas ou reexecutar a importação local.

O novo roteamento deve separar os módulos de sessão e webhook. Falta de credenciais OIDC deve bloquear o login, mas não derrubar o bot ou a saúde de sua configuração atual.

Os futuros endpoints de alteração de lançamentos devem compartilhar o controle de concorrência com o bot; não escrever diretamente em `cloud_records` ignorando `cloud_state.version`. O desenho dessas operações é parte da fase financeira seguinte, não deste contrato mínimo de autenticação.

## 10. Fora do alcance e impedimentos a evitar

- Sem contas por e-mail/senha, login social alternativo, telefone obrigatório ou provedor externo pago.
- Sem SSR, Server Actions ou acesso direto ao D1 pelo navegador.
- Sem renomear recursos remotos, trocar bot ou migrar de banco só para atualizar a marca.
- Sem dados reais dentro do protótipo visual ou de arquivos estáticos.
- Sem remover ou alterar o antigo Site do Sites como efeito da publicação na Cloudflare.
- Sem implementar lembretes de contas, regras de fatura ou outras funcionalidades descartadas/adiadas.

## 11. Validação e critérios de aceite

- Build exporta as páginas e os assets sem precisar de banco ou segredos durante o build.
- Rotas de auth/API/webhook alcançam o Worker; assets e navegação direta das páginas funcionam, incluindo 404 correto.
- Testes rejeitam assinatura/audiência/emissor/nonce/state inválidos, fluxo expirado ou reutilizado, ID ausente e usuário fora da lista.
- Um ID Telegram existente aponta para o mesmo owner e mantém seus registros. Testar explicitamente ID numérico diferente do `sub` OIDC.
- Duas pessoas não conseguem ler ou alterar os dados uma da outra. Não confiar em owner recebido do cliente.
- Sessão expirada, cookie ausente, logout e remoção da allowlist bloqueiam o acesso; logout repetido é seguro.
- Verificar flags de cookies, ausência de tokens em URLs finais/arquivos públicos/logs e proteção CSRF das operações mutáveis.
- Bot continua registrando, editando e desfazendo gastos após a mudança de roteamento, com deduplicação e fila preservadas.
- Verificar as telas aprovadas nos temas claro/escuro e no celular.
- Concluir com login real do usuário e leitura do perfil na conta Cloudflare; testes simulados sozinhos não comprovam a integração externa.
- Medir CPU de login e das verificações de sessão no ambiente publicado antes de considerar a etapa validada na franquia gratuita. Se houver excesso, otimizar ou rever a implementação sem ativar plano pago automaticamente.

## 12. Pendências para iniciar e escolhas do plano

O usuário precisa cadastrar os URLs e obter as credenciais de login no BotFather. Elas ainda não existem na configuração do projeto. Não solicitar que sejam coladas no chat.

Ficam para o plano de implementação: versões compatíveis das dependências, layout exato das novas tabelas, detalhe do rate limiter, estratégia de cache de chaves públicas, segurança de headers compatível com o frontend estático, comandos de build/deploy, testes e rollback. O prazo de sessão de 7 dias e o uso do mesmo endereço são propostas técnicas explícitas a revisar junto com este desenho.

Após aprovação deste documento, elaborar o plano de implementação. A API financeira e a distribuição mensal das parcelas precisam de seu próprio detalhamento antes de substituir os exemplos por registros reais no painel.

## Referências verificadas

- [Next.js — static exports](https://nextjs.org/docs/app/guides/static-exports)
- [Cloudflare — Static Assets e run_worker_first](https://developers.cloudflare.com/workers/static-assets/binding/)
- [Telegram — Login e OpenID Connect](https://core.telegram.org/bots/telegram-login)
