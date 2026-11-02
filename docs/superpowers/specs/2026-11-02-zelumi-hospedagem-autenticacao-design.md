# Zelumi — hospedagem e autenticação do painel

Data: 02/11/2026. Estado: direção aprovada para planejamento; detalhes técnicos abaixo são escolhas do implementador. Cadastro aberto no site e no bot e uso do Login Widget clássico aprovados explicitamente. Esta revisão substitui a proposta anterior de OIDC.

## 1. Objetivo e alcance

Fechar a arquitetura de hospedagem e de login do novo painel, preservando o bot publicado e os registros existentes. O usuário escolheu Next.js, TypeScript, Tailwind CSS, shadcn/ui e login exclusivamente pelo Telegram; aprovou os estudos de Entrada, Visão geral, Lançamentos e Perfil conforme registrado em [DECISOES.md](../../DECISOES.md).

Este desenho cobre a base do site, a publicação estática, autenticação, sessão e identidade para acesso ao banco. Não especifica ainda os endpoints financeiros, a migração para parcelas mensais ou as regras de editar uma compra versus editar uma parcela. Esses itens são dependências da conexão completa do painel aos dados e serão detalhados antes de sua implementação.

O objetivo desta fase não é publicar uma tela com valores fictícios como se fossem reais. Após a base, qualquer área de dados que ainda não esteja conectada deve apresentar seu estado explicitamente, sem dados de demonstração misturados a uma conta real.

## 2. Situação atual

- `cloudflare/worker.mjs` atende `/telegram/webhook` e `/health`; o cron reenvia respostas pendentes.
- O Worker `financeiro-testes-bot` está publicado em `https://financeiro-testes-bot.miudo.workers.dev`.
- D1 `financeiro-testes`, já vinculado em `wrangler.jsonc`, guarda compras e receitas em `cloud_records`. A coluna `owner` é o ID numérico do usuário Telegram, convertido em texto.
- O bot identifica o remetente da conversa privada e evita duplicações por `update_id`, com controle de versão por usuário. A restrição anterior por `TELEGRAM_ALLOWED_USER_IDS` foi retirada conforme a nova política de cadastro aberto.
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

Usar **Login Widget clássico oficial**, no modo callback JavaScript (`data-onauth`), com verificação HMAC-SHA-256 no Worker. O usuário aprovou esse caminho após configurar o domínio pelo `/setdomain`. A documentação atual denomina este método legado; OIDC é uma possibilidade futura, não parte desta implementação.

Não solicitar telefone, e-mail ou permissão adicional de envio de mensagens (`data-request-access`) para realizar o login. O botão incorporado é o oficial do Telegram e tem opções de aparência limitadas; preservar o restante do desenho aprovado sem criar uma imitação do botão.

### Preparação externa

Já concluída pelo usuário: domínio `financeiro-testes-bot.miudo.workers.dev` vinculado ao bot `@financeiro_lab_482_bot`, com resposta “Success! Domain updated.”. Não cadastrar a URL de callback como domínio. Não é necessário obter Client ID ou Client Secret para esse método.

Configuração pública no Worker: `APP_ORIGIN=https://financeiro-testes-bot.miudo.workers.dev` e `TELEGRAM_BOT_USERNAME=financeiro_lab_482_bot`. Reaproveitar `TELEGRAM_BOT_TOKEN`, já armazenado como segredo do Worker. Validar antes da publicação que o username corresponde ao mesmo token, usando `getMe` sem imprimir credenciais.

### Fluxo

1. A entrada faz `POST /auth/telegram/start`, JSON, com Origin exatamente igual a `APP_ORIGIN`. O Worker cria um fluxo de 10 minutos, cookie temporário `__Host-zelumi_login` HttpOnly e desafio CSRF independente retornado no JSON. Guardar hashes dos valores no D1; substituir o fluxo anterior desse navegador ao reiniciar.
2. O frontend monta o widget oficial com o username retornado e mantém o desafio somente em memória. O callback do widget envia os dados para `POST /auth/telegram/callback`, em JSON, com o desafio em `X-CSRF-Token`. Não utilizar callback por query string nem aceitar identidade via GET.
3. O Worker exige Origin exato, JSON, corpo de no máximo 16 KiB, cookie de fluxo válido e desafio correspondente. Não permitir CORS externo. Essa vinculação ao navegador é necessária porque a assinatura clássica do Telegram não contém state ou nonce da aplicação.
4. Validar tipos e campos obrigatórios (`id`, `first_name`, `auth_date`, `hash`) e opcionais documentados (`last_name`, `username`, `photo_url`), rejeitando arrays, objetos, campos desconhecidos e coerções ambíguas. Canonicalizar números seguros para texto, preservar os valores textuais assinados, ordenar campos sem `hash`, unir com `\n`, calcular HMAC-SHA-256 com chave SHA-256 do token do bot e comparar em tempo constante.
5. Aceitar `auth_date` com idade de até 5 minutos e tolerância futura de 30 segundos. A idade é verificada pelo relógio do servidor. Rejeitar ID inválido ou assinatura inválida antes de criar perfil ou sessão.
6. Consumir o fluxo e registrar uso único da assinatura em lote atômico no D1 junto com perfil e sessão. Concorrência ou retorno repetido não pode criar outra sessão. Uma assinatura já aceita é bloqueada mesmo em outro fluxo durante sua janela de validade.
7. Criar/atualizar somente o perfil do ID Telegram validado, sem lista de usuários ou aprovação manual. Usar sempre texto React para apresentação; não carregar `photo_url` externo nesta fase.
8. Criar a sessão da aplicação, remover o cookie temporário e devolver sucesso. O frontend navega para o destino fixo `/visao-geral/`. Não aceitar destino de retorno arbitrário.

Não registrar payload de login, hashes de autenticação, desafios, cookies ou tokens em logs. Respostas de autenticação e sessão usam `Cache-Control: no-store` e não expõem esses dados em URLs. Se o widget for bloqueado pelo navegador, mostrar erro com opção de tentar novamente; não oferecer login falso nem solicitar token do bot ao usuário.

## 6. Identidade e proteção dos registros

O campo `id` do payload Telegram assinado deve ser validado como inteiro positivo seguro e convertido para a forma textual canônica usada por `cloud_records.owner`.

- Usar o ID Telegram canônico como chave única na tabela de usuários. Para o mesmo ID, atualizar somente os campos de apresentação validados, sem transferir dados ou criar outra identidade.
- Não usar `@username`, nome, foto ou um ID enviado pelo frontend como prova de identidade. Nome e username são dados de apresentação; username pode estar ausente ou mudar.
- Caso o ID obrigatório esteja ausente ou inválido, rejeitar o login, sem alternativas baseadas em nome ou username.
- Preservar `cloud_records.owner` e os registros existentes; não requer recadastro de despesas ou cópia para um novo banco.
- Toda consulta financeira futura deverá obter o owner a partir da sessão verificada e aplicar esse escopo no SQL.
- Cadastro aberto: qualquer identidade Telegram validada pode criar seu perfil automaticamente. `TELEGRAM_ALLOWED_USER_IDS` não participa da autenticação nem da autorização. A autorização de dados continua obrigatória por owner em cada operação.
- O bot também aceita usuários novos sem aprovação ou login prévio no site. No primeiro login do site, criar ou atualizar o perfil pelo mesmo ID Telegram e reconhecer os registros já existentes, sem duplicar contas. Nome e username fornecidos em callbacks ou mensagens não substituem a identidade assinada do login.

## 7. Sessões e saída

Propostas do implementador para revisão:

- Sessão da aplicação com duração absoluta de **7 dias**, sem renovação automática nesta fase.
- Cookie `__Host-zelumi_session`, com valor aleatório de pelo menos 256 bits, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, sem atributo Domain e com prazo alinhado ao servidor.
- Guardar somente o hash do token de sessão no D1, junto com usuário, criação e expiração. Derivar o desafio CSRF da sessão usando HMAC com separação de domínio e segredo do servidor, sem revelar o token de sessão. Não guardar credenciais em localStorage.
- Fluxo de login válido por **10 minutos**, com cookie temporário protegido e limpeza após sucesso, recusa ou expiração.
- Validar sessão e autorização pelo banco em cada requisição protegida; não manter cache que permita reutilizar sessão revogada.
- `POST /api/session/logout` invalida a sessão atual no D1 e apaga o cookie. Não desconecta a conta Telegram, não revoga outras sessões e não altera o uso do bot.
- GET não deve executar operações destrutivas. Logout e futuras alterações exigem Origin igual à origem configurada, JSON e token CSRF da sessão em header. Sem CORS aberto para origens externas.
- Usar a rotina agendada existente para limpar sessões e fluxos expirados. A expiração é sempre verificada na requisição, independentemente dessa limpeza.
- Requisições de início de login têm limite de 5 por janela fixa de 10 minutos por identificador de rede, em uma tabela D1. Identificador derivado por HMAC do IP confiável fornecido pela Cloudflare, com separação de domínio; não armazenar o IP bruto. No ambiente local, usar chave fixa de desenvolvimento, sem confiar em `X-Forwarded-For`. Não adicionar serviço pago.

O prazo de sessão do Zelumi é controlado pela aplicação. Logins novos dependem do Telegram; uma sessão já válida pode continuar acessando a API enquanto os serviços do Zelumi estiverem disponíveis.

## 8. Contratos mínimos desta fase

| Rota | Função |
| --- | --- |
| `POST /auth/telegram/start` | Cria fluxo e retorna `{ botUsername, csrfToken }` |
| `POST /auth/telegram/callback` | Valida `{ telegram: payload }`, cria sessão e retorna `{ ok: true }` |
| `GET /api/session` | Retorna perfil mínimo da sessão e token CSRF, ou 401 se não houver sessão válida |
| `POST /api/session/logout` | Invalida a sessão atual com proteção CSRF |
| `POST /telegram/webhook` | Mantém o bot existente |
| `GET /health` | Mantém a verificação atual; não divulga configuração sensível |

`GET /api/session` retorna `{ user: { firstName, lastName, username }, csrfToken }`, com campos opcionais nulos. Não inclui registros financeiros, ID bruto de sessão ou token do bot. Todas essas respostas usam `no-store`. Falta de sessão é 401; origem/CSRF inválidos, 403; payload inválido, 400; tentativas excedidas, 429 com `Retry-After`; indisponibilidade de configuração ou D1, 503 sem detalhes internos.

Estados do frontend: carregando sessão, autenticado, não autenticado e falha temporária. Um 401 retorna à entrada. Não existe tela de espera por liberação ou rejeição por falta de convite. Um 403 em uma operação inválida ou sem proteção CSRF não deve ser apresentado como falta de aprovação de cadastro. Recusar autorização no Telegram permite tentar novamente. Erros técnicos não são apresentados como se a pessoa tivesse digitado uma senha errada.

As páginas protegidas são estruturas estáticas públicas, mas só exibem dados reais após a API validar a sessão. Isso é intencional; esconder páginas no frontend não substitui autorização.

## 9. Migrações e preservação do bot

Adicionar tabelas de usuários, sessões, fluxos de login, recibos de uso único de login e controle de tentativas em uma migração nova e aditiva. Não editar a migração inicial já aplicada, apagar tabelas ou reexecutar a importação local.

O novo roteamento deve separar os módulos de sessão e webhook. Falta de `APP_ORIGIN`, username ou tabelas de autenticação deve bloquear o login, mas não derrubar o bot ou a saúde de sua configuração atual. A limpeza de autenticação e o reenvio de mensagens no cron devem ter tratamento de falhas independente.

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
- Testes rejeitam assinatura alterada, auth_date antigo/futuro, origem/CSRF/cookie inválidos, fluxo expirado ou reutilizado, replay entre fluxos e ID ausente. Testar que um usuário novo entra sem qualquer lista de IDs.
- Um ID Telegram existente aponta para o mesmo owner e mantém seus registros. Testar nomes iguais com IDs diferentes e ID existente com username alterado.
- Duas pessoas não conseguem ler ou alterar os dados uma da outra. Não confiar em owner recebido do cliente.
- Sessão expirada, cookie ausente e logout bloqueiam o acesso aos dados protegidos; logout repetido é seguro. Novos usuários não precisam de liberação manual no site ou no bot.
- Verificar flags de cookies, ausência de tokens em URLs finais/arquivos públicos/logs e proteção CSRF das operações mutáveis.
- Bot continua registrando, editando e desfazendo gastos após a mudança de roteamento, com deduplicação e fila preservadas.
- Verificar as telas aprovadas nos temas claro/escuro e no celular.
- Concluir com login real do usuário e leitura do perfil na conta Cloudflare; testes simulados sozinhos não comprovam a integração externa.
- Medir CPU de login e das verificações de sessão no ambiente publicado antes de considerar a etapa validada na franquia gratuita. Se houver excesso, otimizar ou rever a implementação sem ativar plano pago automaticamente.

## 12. Pendências para iniciar e escolhas do plano

O domínio já está configurado e o token necessário já está no Worker. Não há nova credencial a pedir ao usuário. O login real só poderá ser confirmado após publicação, pelo próprio usuário no domínio autorizado.

Ficam para o plano de implementação: dependências estáveis compatíveis com Node >=22.16.0, layout das novas tabelas, headers compatíveis com o widget oficial e o Next estático, comandos de build/deploy, testes e rollback. Sessão de 7 dias, limiares de tempo e rate limit são escolhas técnicas do implementador, ajustáveis conforme o piloto.

O plano correspondente está em [site e login Telegram](../plans/2026-11-02-zelumi-site-login-telegram.md). A revisão independente desta mudança para widget clássico não identificou lacunas importantes para planejar a implementação. A API financeira e a distribuição mensal das parcelas precisam de seu próprio detalhamento antes de preencher o painel com registros reais.

## Referências verificadas

- [Next.js — static exports](https://nextjs.org/docs/app/guides/static-exports)
- [Cloudflare — Static Assets e run_worker_first](https://developers.cloudflare.com/workers/static-assets/binding/)
- [Telegram — Login Widget clássico](https://core.telegram.org/widgets/login-legacy)
- [Telegram — Login e OpenID Connect, alternativa futura](https://core.telegram.org/bots/telegram-login)
