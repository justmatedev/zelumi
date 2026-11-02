# Zelumi: dados reais e parcelas mensais — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar as telas financeiras ao D1, com parcelas mensais, busca/filtros, detalhes, edição/exclusão da compra inteira e o mesmo resumo mensal no bot.

**Architecture:** A compra em `cloud_records.body` continua sendo a fonte financeira. Um índice auxiliar por compra guarda busca normalizada e cronograma validado; SQL expande esse JSON para agregar/paginar as ocorrências sem transferir o histórico ao navegador. As escritas usam sessão/CSRF, versão do registro, recibo idempotente e o controle de concorrência do bot.

**Tech Stack:** Node >=22.16.0, Worker ESM + D1, SQLite local, Next.js/TypeScript/Tailwind/componentes shadcn já instalados; nenhuma nova plataforma ou biblioteca de gráficos/banco.

**Spec:** `docs/superpowers/specs/2026-11-02-zelumi-dados-financeiros-design.md`, aprovado pelo usuário em 02/11/2026.

## Global Constraints

- Editar a compra inteira e recalcular todas as parcelas, incluindo meses anteriores; excluir a compra remove todas as parcelas.
- Valores inteiros positivos em centavos, máximo `100000000000` por compra; agregados devem ser inteiros seguros. De 1 a 120 parcelas, sem perder centavos.
- Datas reais entre anos 1900 e 9990; início padrão no mês da compra e início ajustável quando parcelado; dia limitado ao último dia do mês.
- `/mes` e site usam as parcelas de cada mês; `/hoje` e `/resumo` mantêm valores integrais pela data da compra, com explicação explícita.
- Receitas já parceladas seguem o cronograma mensal. Resultado não é saldo bancário; cronograma não implica pagamento ou vencimento.
- Categorias existentes: `Receitas` para receita; `Alimentação`, `Transporte`, `Casa`, `Saúde`, `Outros` para despesa.
- Nome novo/editado até 200 caracteres, busca até 100, página padrão20/máximo50; histórico antigo válido não é descartado por nome maior que o novo limite.
- Cadastro inicial pelo Telegram; sem criar compras pelo site, editar parcela isolada, lembretes, fatura, pagamentos ou categorias personalizadas.
- Owner somente da sessão; recurso de outro owner é404; Origin, JSON, corpo máximo16KiB e CSRF obrigatórios em PUT/DELETE; respostas financeiras `no-store`.
- Preservar IDs, dados, webhook/segredos/D1/cron e Sites antigo. Migração aditiva; não reimportar dados nem ativar plano pago.
- Manter stack, identidade visual e temas aprovados. Não guardar dados financeiros/formulários/credenciais em localStorage.

## Review Focus

- Históricos antigos, importações e escritores após rollback não podem deixar busca ou parcelas incompletas sem aviso (tarefas1–2).
- Uma edição pendente no Telegram não pode substituir silenciosamente uma correção feita no site nem virar compra nova (tarefas2–3).
- Resposta de escrita perdida e reenvio concorrente precisam produzir uma única alteração, sem afetar registros de outra sessão (tarefas3–4).
- Mudança do histórico entre páginas ou resposta de busca atrasada não pode misturar resultados de consultas diferentes (tarefas3–4).
- Expiração/logout enquanto uma consulta ou modal está aberto deve ocultar os dados da conta e impedir resposta antiga de restaurá-los (tarefas3–4).

---

## Mapa de arquivos

| Arquivos | Responsabilidade |
| --- | --- |
| `finance/model.mjs`, `finance/model.d.mts` | Validação, normalização e contratos puros compartilhados |
| `dist/parser.mjs` | Cronograma canônico existente, ampliado para mês inicial |
| `finance/version.mjs`, `finance/sql.mjs` | Versão SHA256 do corpo bruto e SQL comum, somente servidor |
| `cloudflare/finance/{projection,store,routes}.mjs` | Preparo limitado do histórico, leitura/escrita atômica e HTTP |
| `cloudflare/migrations/0003_finance.sql` | Índice auxiliar, invalidação e recibos de operação |
| `bot/{store,engine}.mjs`, `cloudflare/store.mjs` | Resumo mensal, índice em transação e conflito de edição pendente |
| `cloudflare/auth/{http,session,routes}.mjs` | Extrair/reutilizar segurança existente sem mudar o login |
| `web/lib/{api,finance}.ts`, `web/hooks/use-finance.ts` | Contratos de transporte, consultas com cancelamento e reconciliação |
| `web/components/finance/` | Resumo, histórico, filtros, tabela, detalhes e formulário |
| `tests/helpers/d1.mjs`, `tests/{finance-model,finance-storage,finance-api}.test.mjs` | Domínio e integração SQLite/D1 |
| `web/tests/{finance-queries,finance-editor}.test.tsx` | Corridas, erros, edição e estado de sessão |

## Contratos compartilhados

`EditFields = { description, type, category, amount, date, installments, installmentStartMonth: string|null }`. `type` é `receita|despesa`; os valores são centavos. PUT envia `{ expectedVersion, record: EditFields }`; DELETE envia `{ expectedVersion }`. Campo desconhecido, inclusive owner/original/id, é inválido.

`RecordDetail = { id:string, version:string, ...EditFields, schedule:Array<{ date:string, amount:number }> }`. `version` é SHA256 hexadecimal do texto bruto persistido, calculado somente no servidor. O original de mensagem fica preservado no corpo e fora do payload editável.

`Entry = { recordId:string, installment:number, installments:number, date:string, month:string, amount:number, totalAmount:number, description:string, type, category }`. Chave visual: `recordId:installment`. Histórico ordenado por data de ocorrência DESC, sequência da compra DESC e número da parcela DESC.

`GET overview?month=YYYY-MM` devolve `{ month, snapshot, income, expense, installmentExpense, cashExpense, result, count, categories:Array<{ category,amount }>, recent:Entry[] }`, com recent no máximo10.

`GET entries` aceita somente `month` opcional (omitido=todos), `q`, `type`, `category`, `parts=all|yes|no`, `page` (a partir1), `pageSize` e `snapshot` opcional. Devolve `{ items:Entry[], total, page, pageSize, snapshot, categories:string[] }`. Páginas seguintes incluem snapshot; alteração do estado do owner devolve409 `HISTORY_CHANGED`, para voltar à primeira página com aviso.

Erros financeiros têm `{ error, code }`; manter compatibilidade com mensagens dos endpoints de login. Códigos especiais: `HISTORY_PREPARING` (503+Retry-After1), `HISTORY_INVALID` (503, sem retry automático), `RECORD_CHANGED`, `HISTORY_CHANGED`, `OPERATION_KEY_REUSED` (409). Nenhuma resposta inclui o corpo bruto ou SQL.

### Task 1: Modelo comum, cronograma e validação

**Files:** criar `finance/model.mjs`, `finance/model.d.mts`, `finance/version.mjs`, `tests/finance-model.test.mjs`; modificar `dist/parser.mjs`, `tests/parser.test.mjs`.

**Interfaces:** no módulo puro `model.mjs`: `validateEdit(value) -> EditFields`, `readStored(body:string) -> normalized record` (conserva cronograma válido ou recupera apenas se ausente), `normalizeSearch(text) -> string`. No módulo servidor `version.mjs`: `recordVersion(body) -> string` e `buildProjection(body) -> { version, searchName, scheduleJson, firstMonth, lastMonth }`, importando as funções puras. Reusar `schedule(record)` do parser, aceitando `installmentStartMonth`. O módulo puro importado pelo navegador não importa Node/segredos.

- [ ] **1. Escrever testes:** `schedule_month_start_keeps_purchase_date`, `rounding_preserves_total`, `legacy_schedule_is_preserved`, `missing_schedule_is_recovered`, `invalid_legacy_is_not_changed`, `unicode_search_is_literal`, `strict_edit_validation`. Fixar R$1.000/12 como `[8334×4,8333×8]`; 31/01→último dia de fevereiro; bissexto; dezembro→janeiro; receita parcelada; à vista ignora início independente. Rejeitar data impossível, ano fora1900–9990, total inseguro/zero, parcelas121, categoria/tipo incompatíveis e campos desconhecidos. Nomes `PÃO`/`pão` normalizam para `pao`; `%_` permanece literal. Corpo inválido nunca é reescrito.
- [ ] **2. Executar RED:** `node --test tests/finance-model.test.mjs`; confirmar falha pelos módulos/comportamentos ainda ausentes.
- [ ] **3. Implementar as interfaces:** manter o parser carregável pelo protótipo estático em `dist/`; não mover sua função para um caminho inacessível a `npm start`. Separar código puro compartilhável e hash servidor. Validar também quantidade/datas/centavos/soma do cronograma antigo; campos legados ausentes sem recuperação segura geram erro tipado, sem correção silenciosa.
- [ ] **4. Executar GREEN e commit:** `node --test tests/finance-model.test.mjs tests/parser.test.mjs`; todos passam. Inspecionar diff e commit somente dos arquivos desta tarefa.

### Task 2: Índice auxiliar, históricos antigos e resumo mensal do bot

**Files:** criar `finance/sql.mjs`, `cloudflare/finance/projection.mjs`, `cloudflare/migrations/0003_finance.sql`, `tests/helpers/d1.mjs`, `tests/finance-storage.test.mjs`; modificar `bot/store.mjs`, `bot/engine.mjs`, `cloudflare/store.mjs` e testes existentes de bot/Cloudflare/carregamento de migrações.

**Interfaces:**
- `prepareOwner(db, owner, { limit:20 }) -> { status:'ready'|'preparing'|'invalid' }` assíncrono no D1; equivalente síncrono no SQLite local. Repara somente índice auxiliar; não altera a compra ou `cloud_state.version`.
- `finance_projection(owner TEXT, record_id TEXT, source_version TEXT, search_name TEXT, schedule_json TEXT, first_month TEXT, last_month TEXT, PRIMARY KEY(owner,record_id))`, índice `(owner,first_month,last_month)`. Uma linha por compra, não por parcela; JSON é cache derivado e descartável, nunca outra fonte financeira.
- Triggers em UPDATE de body/id/owner e DELETE removem projeção antiga, inclusive quando escritor antigo roda após rollback. No SQLite, adaptar origem `records` e ID inteiro para chave textual. Escritores novos inserem a projeção após a escrita, dentro da mesma transação/lote.
- `finance_operations(owner, operation_key, request_hash, attempt_id UNIQUE, record_id, kind, response_json, created_at, expires_at, PRIMARY KEY(owner,operation_key))`; índice por expiração. Uso na tarefa3.
- `store.summary(owner,'YYYY-MM')` entrega totais mensais por ocorrência, ou status de preparo/erro. O resumo diário continua direto na compra. Decodificação de registros do store acrescenta `version` sem persistir esse campo no body.

- [ ] **1. Escrever testes:** resumir compra antiga parcelada em meses consecutivos, receita parcelada, início ajustado, vários owners e soma segura. Inserir45 compras sem metadados: lotes20 não mostram total parcial; terceiro preparo permite resultado integral. Simular UPDATE entre leitura de legado e inserção de projeção: a chave antiga não pode ser inserida. Escritor antigo altera body e trigger invalida; importação sem metadados é recuperável. Registro semanticamente inválido conserva body e gera status inválido. Testar SQLite e D1 reais locais.
- [ ] **2. Executar RED:** `node --test tests/finance-storage.test.mjs`; confirmar comportamento ausente antes de escrever armazenamento.
- [ ] **3. Implementar migração/preparo:** usar LEFT JOIN por owner para encontrar no máximo20 compras sem projeção; derivar metadados pela tarefa1 e inserir por SELECT condicionado a owner/id/body ainda iguais. Se sobrarem compras faltantes, responder preparing; nunca zeros parciais. Cronograma recuperado fica no cache, preservando body. Nova escrita recompõe projeção no mesmo lote com gate do recibo do bot. Shared SQL filtra owner/faixa, expande `json_each(schedule_json)` e agrega no banco; checar inteiros seguros ao ler agregados. Não usar LIKE para substring; usar `instr(search_name, ?)`, com parâmetro normalizado.
- [ ] **4. Atualizar bot e testes:** `/mes` mostra ocorrências/Resultado do mês; `/hoje` explica valores integrais por data da compra; ajuda não diz mais que o banco é separado do site. Se histórico prepara ou é inválido, enviar resposta explicativa, sem total parcial e sem prender toda a fila Telegram em retries. Pending de edição armazena versão, data, quantidade e início originais; propagar esses campos no caminho de pergunta por valor. Conflito preserva o registro, encerra a edição com aviso e não cria compra nova. Pending antigo de edição sem versão pede reinício seguro; pending antigo de compra nova continua normalmente. Preservar início ajustado somente quando data/parcelamento forem mantidos e sem hoje/ontem explícito.
- [ ] **5. Verificar e commit:** `npm test`. Incluir regressões para alteração site simulada durante pending (inclusive pergunta por valor), data explícita, perda de versão e deduplicação/outbox. Para migrações com triggers, usar separador explícito `-- statement-breakpoint` na0003 e helper que respeita esse marcador, sem cortar o BEGIN/END em cada `;`;0001/0002 continuam suportadas. Confirmar que o importador mantém owners/IDs e não precisa exportar metadados derivados. Commit da tarefa após GREEN.

### Task 3: API autenticada e escritas idempotentes

**Files:** criar `cloudflare/auth/http.mjs`, `cloudflare/auth/session.mjs`, `cloudflare/finance/store.mjs`, `cloudflare/finance/routes.mjs`, `tests/finance-api.test.mjs`; modificar `cloudflare/auth/routes.mjs`, `cloudflare/worker.mjs` e fixtures dos testes.

**Interfaces:**
- Extrair helpers HTTP existentes e `getSessionContext(request,env,nowMs) -> { owner,user,csrfToken,db }|null`, usando D1 first-primary. Login e finanças compartilham a validação; raw token não sai do servidor.
- `handleFinance(request,env,{ nowMs }) -> Response|null`; captura `/api/finance` e descendentes, inclusive erro JSON404. Auth devolve null apenas nesse prefixo para o Worker despachar finanças; demais erros e rotas de auth preservados.
- `FinanceStore`: `overview(owner,month)`, `entries(owner,filters)`, `detail(owner,id)`, `mutate({owner,id,kind,expectedVersion,record,operationKey,nowMs})`. Contratos definidos acima; IDs textuais decimais positivos de até19 dígitos ou UUID; não converter ID legado grande para Number.
- PUT/DELETE exigem `Idempotency-Key` UUID aleatório por ação; mesmo owner/chave/hash retorna resultado anterior durante24h; mesma chave e outro pedido é409. Sucesso `{ ok:true, version:string }` no PUT e `{ ok:true }` no DELETE.

- [ ] **1. Escrever testes:** login assinado falso da suíte existente→compras sintéticas→overview/history/detail→PUT/DELETE. Verificar parcelas/centavos, filtros combinados, acentos/maiúsculas/combinação Unicode, `%_` literal, defaults/limites de página e tipos inválidos. OwnerB recebe404 para ID deA e não altera nenhuma compra. Sem sessão401, mutação sem origem/CSRF403, corpo>16KiB413, métodos405, rota desconhecidaJSON404. Expansão mensal nunca soma total mais parcela.
- [ ] **2. Executar RED:** `node --test tests/finance-api.test.mjs`; confirmar inexistência dos contratos novos.
- [ ] **3. Implementar consultas e transporte:** limitar overview a10 recentes e entries a50; todos os SQL incluem owner. Overview/entries exigem preparo limitado completo do owner; `HISTORY_PREPARING` tem Retry-After1, inválido não omite registros. Detail valida somente a compra solicitada, sem bloquear o conserto de outras compras. Queries/filtros desconhecidos ou duplicados são400. `snapshot` é a versão de cloud_state lida no mesmo batch de resultado/contagem (0 se owner ainda não tem estado); validar ao paginar e devolver409 quando mudar. Categorias disponíveis seguem o owner e demais filtros, sem eliminar escolhas pelo próprio filtro de categoria. Não cachear respostas privadas nem devolver corpo bruto.
- [ ] **4. Implementar mutações atômicas:** validar sessão/origem/CSRF antes de ler recibos; hash do pedido inclui método, ID e payload canônico. Procurar recibo por owner/chave antes de buscar registro ou preparar histórico, permitindo replay do DELETE já concluído. Ler a compra; garantir cloud_state do owner com INSERT OR IGNORE (importações antigas podem não ter estado) e comparar hash bruto com expectedVersion. Inserir recibo por SELECT condicionado a body e versão atual de cloud_state; escrita, projeção e incremento de estado são condicionados ao attempt_id único do recibo no mesmo D1 batch. Gatilho que não insere recibo não confirma sucesso; devolver conflito ou reusar recibo concorrente compatível. Manter original da mensagem e remover campo de início ao tornar à vista. Não limpar pending do bot: ele verifica versão ao receber a resposta. Cleanup de recibos expirados em lotes500 no cron, com falha independente da fila do bot e da limpeza de auth.
- [ ] **5. Verificar falhas e commit:** testar dois PUTs concorrentes com a mesma chave (um efeito/incremento), replay com chave incompatível, versão antiga, disputa bot/site, DELETE repetido, resposta perdida após commit e falha em statement revertendo recibo/compra/projeção/versão juntos. Testar snapshot mudando entre páginas e 401 atrasado sem Set-Cookie; atualizações de metadados não mudam snapshot. `npm test` deve passar, com `getPlatformProxy`/DB locais e Telegram fake. Commit após GREEN.

### Task 4: Visão geral, histórico e formulário reais

**Files:** criar `web/lib/finance.ts`, `web/hooks/use-finance.ts`, `web/components/finance/{overview,history,month-picker,entry-list,category-chart,record-dialog,record-editor}.tsx`, `web/tests/{finance-queries,finance-editor}.test.tsx`; modificar `web/lib/api.ts`, `web/components/session-provider.tsx`, `web/app/{visao-geral,lancamentos}/page.tsx`, `web/app/globals.css`, `web/next.config.ts`. Retirar `pending-finance.tsx` após ambas as páginas conectadas.

**Interfaces:** `api` aceita `method:'GET'|'POST'|'PUT'|'DELETE'`, `operationKey` e erros com code/Retry-After, mantendo compatibilidade do login. SessionProvider oferece `expire()` que invalida consultas antigas e oculta perfil/CSRF. `useFinance<T>(path)` oferece data/loading/error/refresh e cancela/invalida resposta antiga na troca de path, sessão ou desmontagem.

- [ ] **1. Escrever testes RED:** busca A atrasada não substitui B; alterar filtro volta à página1; snapshot409 reinicia histórico com aviso;401 esconde dados/modal e expira sessão; resposta após logout é ignorada. Editar compra mostra total e cronograma, aviso de todos os meses e PUT com versão/CSRF/chave. Excluir exige confirmação. Conflito mantém texto digitado e oferece recarregar. Falha/resposta perdida reutiliza a chave e reconcilia versão/ausência; nunca duplica ação nem afirma sucesso sem confirmação.
- [ ] **2. Executar:** `npm --prefix web test`; observar falhas dos componentes/comportamentos ainda ausentes.
- [ ] **3. Implementar leituras/telas:** reutilizar prévias aprovadas com dados reais; overview no mês corrente de São Paulo, totais/categorias/lista; histórico em todos os meses, busca com debounce300ms, filtros e paginação20. Revalidar ao montar/focar e após mutação; botão Atualizar. Gráfico CSS/SVG sem dependência nova e legenda acessível; vazio sem divisão por zero. Preparo de legado permite até10 tentativas transitórias de1s, depois oferece continuar manualmente; isso não é polling permanente. Não repetir HISTORY_INVALID automaticamente.
- [ ] **4. Implementar detalhes/edição:** um dialog nativo com foco/Escape/retorno à origem, modos detalhes/editar/confirmar exclusão. IDs e versions vêm da API. Importar somente funções puras da tarefa1 para a prévia de cronograma, sem duplicar algoritmo ou importar hash/SQL/segredos. Ajustar `turbopack.root` para a raiz do repositório para esses imports e os dois lockfiles intencionais. À vista remove mês independente; receita fixa categoria Receitas; valor em reais é convertido para centavos pela regra compartilhada. Guardar texto apenas em memória. Operação mantém chave UUID até reconciliar resultado; nova ação gera outra. Em rede incerta consultar detalhes e oferecer reenvio com a mesma chave, sem sobrescrever versão nova automaticamente.
- [ ] **5. Verificar e commit:** `npm --prefix web run typecheck`, `npm --prefix web test`, `npm run web:build`; export sem segredos/dados. Firefox local com token falso: desktop1440 e mobile390 em claro/escuro, abrir detalhes/editar e navegar por teclado, conferir valores e ausência de overflow. Testes da interface não chamam Telegram real. Commit após GREEN.

### Task 5: Verificação de limites, revisão e publicação

**Files:** ampliar `tests/finance-storage.test.mjs`/`tests/finance-api.test.mjs`; modificar `README.md`, `CLOUDFLARE.md`, `docs/DECISOES.md`; ajustar scripts existentes somente se necessário ao novo fluxo de migração/verificação.

- [ ] **1. Teste de custo:** semear1000 compras sintéticas, com distribuição antiga,120 parcelas e outro owner; contar chamadas/retornos no adapter D1 e inspecionar plano SQL por owner. Cada invocação deve ficar abaixo de50 chamadas D1 (batch conta uma chamada), sem histórico completo retornado ao Worker e com no máximo20 corpos na preparação/50 entradas na página. Se falhar, otimizar consulta/preparo antes de publicar; não ativar plano pago. Registrar métricas locais como locais, não prova de CPU em produção.
- [ ] **2. Verificar:** `npm test`, `npm run web:check`, `npm run cf:check`; revisar que protótipo antigo ainda carrega parser e login/cookies/cron não regrediram. Solicitar revisão independente de toda a implementação contra spec/plano e corrigir achados importantes com RED→GREEN. Não pedir ao usuário aprovação de código ainda não verificável.
- [ ] **3. Preparar/publicar:** registrar versão atual (`e40e45aa-a2b5-4d95-a19c-4788c9f66ba5`, verificar se mudou), listar migrações e confirmar que somente0003 é nova. Aplicar migração aditiva antes de deploy; triggers não alteram compras nem prejudicam código anterior. Publicar no Worker atual com scripts existentes, sem reativar webhook/reimportar/alterar segredos. Rollback mantém compras e tabelas; gatilhos invalidam caches de escritores antigos, e prepareOwner revalida ao voltar à nova versão.
- [ ] **4. Validar produção:** site/rotas,401 sem sessão, webhook sem segredo401, JSON404, status do webhook. Usar somente identidade e dados sintéticos no ambiente local; não assinar identidade fictícia com token real. Comparar contagens/invariantes remotas somente se necessário, sem imprimir dados privados. Medir CPU real quando disponível e documentar limites de medição.
- [ ] **5. Handoff:** usuário compara um mês e uma compra conhecida entre site e `/mes`; escolhe um registro próprio para testar edição/exclusão, se desejar. O agente não cria/altera gastos reais para simular esse teste. Atualizar docs separando código publicado, verificações automatizadas e confirmação humana. Manter GitHub para depois, sem push/merge não solicitado.

## Revisão própria e execução

Cobertura da spec conferida nas cinco tarefas, com contratos de owner/centavos/versão consistentes. O índice auxiliar é uma linha por compra e deriva do body; não contradiz a decisão de evitar uma segunda tabela por parcela. Os triggers invalidam inclusive após rollback; lotes condicionais evitam indexar descrição antiga. O plano não publica totais parciais durante preparo e não modifica compras em backfill.

Execução direta na sessão já escolhida; sem nova escolha de método. Documento pronto para revisão do usuário antes de implementar, conforme writing-plans. Nenhuma mudança de runtime, migração ou dado real foi feita ao escrever este plano.

Referência de limites verificada em 02/11/2026: [Cloudflare D1 limits](https://developers.cloudflare.com/d1/platform/limits/) — atualmente50 chamadas por invocação no Free; `batch()` conta uma chamada. A busca proposta usa `instr`, não padrões LIKE sujeitos a outros limites.
