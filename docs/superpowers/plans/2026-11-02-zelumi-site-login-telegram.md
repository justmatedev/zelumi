# Zelumi: site e login Telegram — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar a base Next.js do Zelumi com entrada real pelo Telegram, Perfil e sessão protegida, preservando o bot e os dados atuais.

**Architecture:** Next.js exportado em `web/out/`, servido com Workers Static Assets no endereço atual. O Worker valida o Login Widget clássico por HMAC, mantém perfis e sessões no D1 e compartilha o ID Telegram com os lançamentos existentes. Esta entrega não conecta as telas financeiras a dados reais.

**Tech Stack:** Node >=22.16.0, Next.js App Router, React, TypeScript, Tailwind CSS, componentes shadcn/ui personalizados, Worker ESM, Web Crypto e Cloudflare D1. Reaproveitar Wrangler instalado; não instalar biblioteca de OIDC/JWT.

**Spec:** `docs/superpowers/specs/2026-11-02-zelumi-hospedagem-autenticacao-design.md` (revisão Login Widget clássico de 02/11/2026).

## Global Constraints

- Cadastro aberto no site e no bot, sem lista de IDs ou aprovação manual.
- Cada usuário deve acessar apenas seus próprios registros, com validação no backend.
- Next.js App Router com `output: 'export'` e `trailingSlash: true`; saída em `web/out/`.
- Cookie `__Host-zelumi_session`: token aleatório de pelo menos 256 bits; `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, sem Domain; validade absoluta de 7 dias.
- Fluxo de login: 10 minutos; payload Telegram: idade máxima de 5 minutos e tolerância futura de 30 segundos; corpo máximo de 16 KiB.
- Início de login: 5 tentativas por janela fixa de 10 minutos por identificador HMAC de rede; sem IP bruto no banco ou logs.
- `APP_ORIGIN=https://financeiro-testes-bot.miudo.workers.dev`; `TELEGRAM_BOT_USERNAME=financeiro_lab_482_bot`. Token do bot somente no servidor.
- Preservar webhook, segredo, D1, cron, `cloud_records.owner`, `dist/` e o Site antigo em `.openai/hosting.json`. Migração nova e aditiva; sem reimportar dados.
- Não ativar plano pago. Não implementar lembretes, regras de fatura, endpoints financeiros ou parcelas mensais nesta entrega.
- Usar a identidade aprovada: Manrope, Inter, logo Conversa, laranja queimado, temas Claro/Escuro/Sistema. Referência: `design/zelumi/dashboard-preview.html` e `account-preview.css`.
- Não mostrar compras fictícias em uma conta real. Visão geral e Lançamentos devem informar que a conexão dos dados está em preparação.

## Review Focus

- Login sem username e com caracteres especiais no nome deve funcionar sem HTML injetado; não buscar fotos externas (tarefas 1 e 3).
- Duas abas, callbacks concorrentes e uma assinatura reapresentada em outro fluxo não podem produzir sessões adicionais (tarefa 2).
- Widget bloqueado, autorização interrompida ou erro D1 deve permitir nova tentativa sem criar falsa autenticação (tarefas 2 e 3).
- Logout, expiração e falha de rede ao consultar sessão devem ter estados distintos e não reapresentar dados de uma sessão encerrada (tarefas 2 e 3).
- Falha da configuração/limpeza de autenticação não pode impedir webhook, cron de mensagens ou servir erro HTML em `/api` (tarefas 2 e 4).

---

## Arquivos e limites

| Arquivos | Responsabilidade |
| --- | --- |
| `cloudflare/auth/telegram.mjs` | Verificação estrita do payload e assinatura Telegram |
| `cloudflare/auth/crypto.mjs` | Valores aleatórios, hashes, HMAC com separação de domínio, comparação segura |
| `cloudflare/auth/store.mjs` | Perfis, fluxos, aceite atômico, sessões, rate limit e limpeza D1 |
| `cloudflare/auth/routes.mjs` | Cookies, Origin, JSON, CSRF, erros e contratos HTTP |
| `cloudflare/migrations/0002_web_auth.sql` | Tabelas aditivas e índices de expiração |
| `cloudflare/worker.mjs` | Despacho auth/API/assets e manutenção independente no cron |
| `tests/telegram-auth.test.mjs`, `tests/web-auth.test.mjs` | Criptografia e integração com D1 local |
| `web/` | Pacote Next.js, páginas, componentes, fontes e testes de interface |
| `scripts/cloudflare.mjs`, `package.json`, `wrangler.jsonc` | Build, assets, verificação e deploy conjunto |
| `scripts/check-web-export.mjs` | Verificação da exportação e de arquivos públicos |
| `README.md`, `CLOUDFLARE.md`, `docs/DECISOES.md` | Operação e estado real da entrega |

### Task 1: Validação Telegram sem dependência do frontend

**Files:** criar `cloudflare/auth/telegram.mjs`, `cloudflare/auth/crypto.mjs`, `tests/telegram-auth.test.mjs`.

**Interfaces:**
- `verifyTelegramPayload(payload, { botToken, nowMs }) -> Promise<{ owner, firstName, lastName, username, payloadHash }>`; lança erro tipado sem dados sensíveis. `owner` é ID decimal canônico; opcionais são `null`.
- `randomToken() -> string`, `hashToken(token) -> Promise<string>`, `deriveCsrf(token, botToken, purpose) -> Promise<string>`, `constantTimeEqual(a, b) -> boolean`. `purpose` diferencia login, sessão e rede.

- [ ] **1. Teste falhando:** criar fixtures assinadas com `node:crypto` e token falso, independentemente do código testado. Verificar: ID 11 vira `'11'`, username ausente vira `null`, nome com `<>&` é preservado como texto e caracteres Unicode não mudam a assinatura. Testar assinatura alterada, campos desconhecidos, hash inválido, arrays/objetos, ID zero/fracionário/inseguro/não canônico e timestamps inválidos. Fixar limites: 300 s atrás aceito, 301 rejeitado; 30 s adiante aceito, 31 rejeitado.
- [ ] **2. Executar:** `node --test tests/telegram-auth.test.mjs`; confirmar falha por módulo ausente antes de implementar.
- [ ] **3. Implementar:** Web Crypto para SHA-256/HMAC, comparação segura e parser estrito conforme seção 5 da spec. Nunca incluir `hash` na string assinada; incluir opcionais presentes mesmo quando vazios. Não usar regras de Telegram Web Apps, cujo segredo derivado é diferente. `payloadHash` identifica a assinatura aceita para bloquear replay; não é credencial de sessão.
- [ ] **4. Verificar:** repetir o comando; todos os casos passam e erros não contêm token/payload. Revisar diff e registrar somente os arquivos desta tarefa em commit, sem incluir mudanças históricas alheias.

### Task 2: Sessões e rotas com D1 real local

**Files:** criar `cloudflare/auth/store.mjs`, `cloudflare/auth/routes.mjs`, `cloudflare/migrations/0002_web_auth.sql`, `tests/web-auth.test.mjs`; modificar `cloudflare/worker.mjs`, `.dev.vars.example` e ajuste mínimo de configuração local se necessário.

**Interfaces:**
- `handleAuth(request, env, { nowMs }) -> Promise<Response | null>`; `null` somente fora dos prefixos `/auth` e `/api`. Rotas desconhecidas nesses prefixos retornam 404 JSON; métodos indevidos, 405 com Allow.
- `cleanupAuth(db, nowMs) -> Promise<void>`; independente da fila de mensagens.
- `AuthStore(db)`: `startFlow({ flowHash, csrfHash, expiresAt, nowMs, networkKey })`, `acceptLogin({ flowHash, csrfHash, profile, payloadHash, sessionHash, sessionExpiresAt, nowMs, attemptId })`, `getSession(sessionHash, nowMs)`, `deleteSession(sessionHash)`, `cleanup(nowMs)`. Início aplica rate limit atômico; aceite devolve sucesso apenas se um fluxo vivo foi consumido.
- Tabelas: `web_users(owner PRIMARY KEY, first_name, last_name, username, created_at, updated_at)`; `web_sessions(token_hash PRIMARY KEY, owner, created_at, expires_at)`; `web_auth_flows(token_hash PRIMARY KEY, csrf_hash, created_at, expires_at)`; `web_auth_accepts(flow_hash PRIMARY KEY, payload_hash UNIQUE, attempt_id UNIQUE, created_at)`; `web_auth_limits(network_key, window_start, count, PRIMARY KEY(network_key, window_start))`. Índices por expiração/criação e owner de sessões. Timestamps em milissegundos; nenhum token bruto.

- [ ] **1. Teste falhando:** seguir o padrão `getPlatformProxy({ persist:false, remoteBindings:false, envFiles:['.dev.vars.example'] })` de `tests/cloudflare.test.mjs`, aplicar ambas as migrações e usar relógio/token falsos. Exercitar start → callback → session → logout, novo usuário, owner existente com registros intactos, nomes iguais/IDs diferentes e mudança de username. Asserções: status esperados, cookies protegidos, hashes no D1 e perfil mínimo sem tokens. Capturar cookies de cada resposta explicitamente, sem supor cookie jar no fetch de Node.
- [ ] **2. Executar:** `node --test tests/web-auth.test.mjs`; confirmar falha pela ausência das rotas.
- [ ] **3. Implementar armazenamento:** emitir fluxo/token/CSRF com 32 bytes aleatórios; invalidar o fluxo anterior apresentado pelo mesmo navegador. Usar D1 batch transacional para rate limit e para aceite. No aceite, inserir recibo por SELECT condicionado a fluxo/CSRF/validade; alterações de perfil, inserção de sessão e exclusão de fluxo são condicionadas ao mesmo `attemptId`. Unicidade de fluxo e payload deve abortar/rejeitar concorrência sem escrita parcial. Não fazer leitura seguida de gravação desprotegida. Limpar recibos após 24h e outros objetos ao vencer; rate limit usa o início da janela fixa. Testar rollback por falha de um statement.
- [ ] **4. Implementar HTTP:** Origin igual à configuração, JSON estrito, corpo limitado por leitura incremental, sem CORS, erros genéricos, `no-store`. Cookie temporário `__Host-zelumi_login` com as mesmas flags da sessão e Max-Age=600. CSRF do fluxo exigido no callback; CSRF de sessão derivado do token bruto com HMAC/segredo do servidor e retornado somente por `/api/session`. Não aceitar sessão via body/header/query. Logout exige sessão, Origin, JSON `{}` e CSRF; após logout repetir com cookie revogado devolve 401 e apaga o cookie. Configuração ausente retorna 503 sem afetar `/health` ou webhook.
- [ ] **5. Cobrir falhas:** adicionar casos de Origin ausente/hostil, content-type inválido, corpo maior de 16 KiB, cookie/CSRF ausente, callback GET, fluxo expirado, assinatura repetida no mesmo/outro fluxo e callbacks concorrentes. Asserções: nenhum perfil/sessão extra; apenas uma sessão no vencedor; usuário A nunca vira B por ID enviado fora do payload assinado. Testar sessão expirada, cookie duplicado malformado, quinta tentativa aceita/sexta 429 e início da janela seguinte. Login inválido não cria sessão nem devolve stack. Falha D1 retorna 503; nova tentativa usa fluxo novo. Não limpar um fluxo recém-criado de outra aba ao rejeitar callback antigo.
- [ ] **6. Integrar no Worker:** despachar auth antes de assets, preservar lógica do webhook e manter limpezas do cron em blocos de erro independentes. Testar reenvio da fila mesmo quando cleanupAuth lança, além de auth indisponível com webhook válido funcionando.
- [ ] **7. Verificar:** `npm test`; todos os testes novos e existentes passam no D1 local. Confirmar migração aditiva e arquivos selecionados antes do commit.

### Task 3: Next.js com Entrada e Perfil reais

**Files:** criar `web/package.json`, `web/package-lock.json`, `web/next.config.ts`, `web/tsconfig.json`, `web/postcss.config.mjs`, `web/components.json`; `web/app/{layout.tsx,page.tsx,globals.css,not-found.tsx}`, páginas `web/app/{visao-geral,lancamentos,perfil}/page.tsx`; `web/components/{brand,theme-provider,app-shell,session-provider,telegram-login,profile}.tsx`, `web/components/ui/{button,card}.tsx`, `web/lib/{api,utils}.ts`, `web/public/brand/`, `web/app/fonts/`, `web/tests/{login,session,profile}.test.tsx`; modificar `.gitignore`.

**Interfaces:**
- `SessionProvider` expõe estados `loading | authenticated | anonymous | error`, perfil, `csrfToken`, `refresh()` e `logout()`. `api.ts` usa fetch same-origin com `credentials:'same-origin'` e `cache:'no-store'`; diferencia 401 de falha temporária.
- `TelegramLogin` chama start por ação da pessoa; monta um único script/widget oficial, instala callback exclusivo, envia payload com CSRF e navega para `/visao-geral/` somente após sucesso do Worker. Limpa callback/script ao desmontar. Um novo clique reinicia o fluxo.
- Scripts do pacote web: `dev`, `build`, `typecheck` e `test`. Testes com Vitest/Testing Library e DOM simulado; não invocam Telegram real.

- [ ] **1. Preparar pacote e testes falhando:** resolver versões estáveis compatíveis de Next/React/TypeScript, Tailwind 4 e utilitários dos componentes shadcn pelas fontes oficiais; gravar versões resolvidas no lock. Instalar somente no pacote `web/`, sem create-next-app sobre o projeto existente. Usar fontes locais já licenciadas. Testar que 401 mostra entrada, 503 mostra erro/tentar novamente, callback não navega antes do sucesso, callback cancelado não cria usuário fictício e logout limpa estado. Executar `npm --prefix web test -- --run` e confirmar falhas dos componentes ausentes.
- [ ] **2. Implementar componentes:** portar a referência visual aprovada para React/TS/Tailwind; usar Button/Card shadcn personalizados sem gerar catálogo desnecessário. Campos do perfil são renderizados como texto, opcionais sem username são tratados, foto usa iniciais locais. Montar widget oficial em área compatível com o botão incorporado, sem sobreposição enganosa. Se script não carregar ou fluxo expirar, explicar e permitir reinício. Não renderizar o modal de login fictício da prévia.
- [ ] **3. Implementar páginas:** Entrada real, navegação compartilhada, Perfil autenticado com nome, username opcional, vínculo Telegram, tema e logout. Visão geral/Lançamentos mostram mensagem explícita de dados ainda não conectados, sem totais, gráficos ou compras fictícias. Redirecionar 401 para entrada e limpar qualquer perfil anterior; falha de rede preserva estado de erro sem fingir logout. Não armazenar sessão/CSRF/payload em localStorage. Preferência de tema é a única persistência local; Claro/Escuro/Sistema com mudança do sistema refletida e tratamento para armazenamento bloqueado.
- [ ] **4. Verificar:** `npm --prefix web run typecheck`, `npm --prefix web test -- --run`, `npm --prefix web run build`; exportação produz as quatro páginas e 404 sem segredo/banco no build. Conferir teclado/foco, tema, nome com caracteres especiais, widget bloqueado e larguras 390 e 1440. Automatizar somente os comportamentos de sessão/login; revisar visualmente a apresentação. Selecionar os arquivos para commit.

### Task 4: Assets, publicação e validação externa

**Files:** modificar `wrangler.jsonc`, `scripts/cloudflare.mjs`, `package.json`, `.dev.vars.example`, `README.md`, `CLOUDFLARE.md`, `docs/DECISOES.md`; criar `scripts/check-web-export.mjs`, `web/public/_headers`; ampliar `tests/web-auth.test.mjs` e `tests/cloudflare.test.mjs` se necessário.

**Interfaces:**
- Scripts raiz: `web:dev`, `web:build`, `web:check`; `cf:check` e `cf:deploy` executam build web antes do Wrangler. Bot continua podendo executar testes sem segredos reais.
- Assets `{ directory:'./web/out', binding:'ASSETS', run_worker_first:['/auth','/auth/*','/api','/api/*','/telegram/webhook','/health'] }`, com tratamento HTML de exportação e 404 real, sem fallback SPA. Confirmar sintaxe na versão instalada do Wrangler.
- Headers: `X-Content-Type-Options:nosniff`, `Referrer-Policy:no-referrer`, proteção contra embedding externo e política de permissões restrita. CSP deve permitir script/iframe oficiais Telegram e scripts de hidratação necessários ao Next export; verificar origens pelo widget oficial, não adivinhar nem bloquear o login. Não usar `unsafe-eval` em produção. Auth/API aplicam headers no Worker; assets em `_headers`. Não inserir no payload estático tokens de runtime.

- [ ] **1. Teste falhando:** testar roteamento `/api`, `/auth`, rotas desconhecidas e assets com stub ASSETS; exigir erro JSON nos prefixos, 404 real e nenhuma interferência em webhook/health. Verificar o export com script que exige arquivos das quatro páginas, fontes/marca e ausência de `.env`, fontes backend, mapas com segredo ou conteúdo de credenciais.
- [ ] **2. Implementar configuração/build:** adicionar vars públicas de origem/username e assets; fallback `ASSETS.fetch` somente fora dos prefixos reservados. Configurar URL HTTPS local no Wrangler para testar cookies Secure; origem de desenvolvimento isolada e exemplo sem credenciais reais. Documentar que login real depende do domínio autorizado e não funcionará automaticamente em localhost. Ajustar fixtures dos testes para não depender de build prévio quando usam stub.
- [ ] **3. Verificar localmente:** `npm test`, `npm run web:check`, `npm run cf:check`. Conferir assets e navegação direta com Wrangler local, cookie seguro e headers; não adicionar mensagens sintéticas ao bot real. Executar revisão independente de autenticação, isolamento, atomicidade e regressões antes de publicação; corrigir achados e repetir somente checks afetados.
- [ ] **4. Preparar deploy revisável:** registrar versão atual do Worker por Wrangler; confirmar `getMe` corresponde ao username sem expor token; listar migrações pendentes sem ler registros financeiros. A única migração nova é `0002_web_auth.sql`. Documentar rollback do Worker mantendo tabelas aditivas e dados intactos; não reverter banco apagando tabelas. Não modificar `.openai/hosting.json`, setWebhook ou segredos já válidos.
- [ ] **5. Publicar:** `npm run cf:db:migrate`, depois `npm run cf:deploy`. A autorização desta entrega inclui publicação na Cloudflare existente, sem plano pago. Se alguma aprovação nativa bloquear, concluir verificações independentes e explicar precisamente a ação pendente; não pedir aprovação genérica antes de preparar o resultado.
- [ ] **6. Verificar produção:** GET `/`, páginas diretas, `/health`, `/api/session` sem cookie (401), webhook sem segredo (401), API desconhecida (JSON404). Conferir status do webhook sem expor URL com token. Validar consumo real/CPU de autenticação nos recursos gratuitos quando disponível; se não houver medição, registrar a limitação em vez de afirmar folga na cota.
- [ ] **7. Handoff ao usuário:** enviar link publicado para login real e pedir confirmação de que o Perfil corresponde à conta; o agente não autoriza a conta no lugar da pessoa. Solicitar `/hoje` com programa local desligado para regressão externa do bot. Registrar separadamente testes automatizados, publicação e confirmação humana. Login de ponta a ponta só está confirmado após esse teste. Atualizar documentação para refletir exatamente o que funciona e o que ainda não está conectado.

## Resultado esperado e próxima entrega

O usuário abre o endereço atual, entra pelo Telegram, vê sua conta real no Perfil, muda tema e encerra a sessão. O bot mantém operação e dados. Em seguida, detalhar e implementar a API financeira e a regra mensal das parcelas antes de preencher Visão geral/Lançamentos.

## Revisão do plano

Revisão própria: cobertura da spec conferida nas quatro tarefas; interfaces, prazos, nomes de rotas e cookies consistentes; cinco classes de falha acima atribuídas aos respectivos testes. O usuário aprovou a execução direta. Tarefas 1–3 implementadas e verificadas; tarefa 4 com roteamento/build verificados, pendente de revisão final, publicação e confirmação humana do login. Ruling da execução: widget em iframe dedicado com CSP própria, porque o script oficial usa eval; validação de mensagens por origem e janela e testes correspondentes substituem o callback global na página principal.
