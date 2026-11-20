# Demonstração pública

Endereço: [zelumi-demo.zelumi.workers.dev](https://zelumi-demo.zelumi.workers.dev).

A demonstração usa o mesmo painel do Zelumi, com entrada sem Telegram e cinco lançamentos fictícios no mês atual de São Paulo. Cada visitante recebe uma conta independente e pode editar ou excluir seus exemplos. Sair pelo Perfil e entrar novamente cria outra conta com exemplos novos. Recarregar a página preserva a sessão e as alterações.

O Worker `zelumi-demo` e o D1 `zelumi-public-demo` são exclusivos da demonstração. Não reutilizar o banco, as credenciais, o proxy ou o webhook de produção. A IA fica desativada; não há registro de mensagens pelo Telegram nesse ambiente. Os avisos pedem que o visitante não informe dados pessoais.

## Desenvolvimento e verificações

```sh
npm run demo:dev
```

Abra **https://localhost:8789**, aceite o certificado local e clique em **Explorar demonstração**. O comando prepara um D1 local em `.wrangler/public-demo/`, aplica as migrações e serve a exportação com a API. Não exige credenciais da Cloudflare ou Telegram. Use exatamente `localhost` para respeitar a origem configurada.

```sh
npm run check
npm run cf:check
npm run demo:check
```

`check` inclui os testes de isolamento, edição com CSRF, logout, limites, expiração e limpeza. `demo:check` compila a variante com `NEXT_PUBLIC_DEMO=1` e faz dry-run do Worker de demonstração, sem publicar ou alterar bancos remotos. O CI executa as três verificações.

O build da demonstração fica em `build/demo-assets/`; o pacote do dry-run fica em `build/demo-worker/`. O comando preserva a exportação normal em `apps/web/out/`, usando temporariamente `build/demo-build-backup/`. Se o processo for interrompido abruptamente, restaure esse backup antes de repetir o build. Não execute builds do site e da demonstração simultaneamente: ambos usam o compilador e a exportação de `apps/web`.

## Configuração e publicação

A configuração é [apps/api/demo/wrangler.jsonc](../../apps/api/demo/wrangler.jsonc), com entrada independente em `worker.mjs`. Confirme `vars.APP_ORIGIN` conforme a URL da conta Cloudflare; a origem precisa corresponder exatamente ao endereço HTTPS de acesso. A configuração inicial usa `https://zelumi-demo.zelumi.workers.dev`.

Na primeira publicação, com a conta Cloudflare autenticada por `npm run cf:login`:

```sh
npm run demo:db:create
npm run demo:db:migrate
npm run demo:check
npm run demo:deploy
```

`demo:db:create` cria somente o banco exclusivo e registra seu ID na configuração. Os comandos recusam o nome de banco errado, o nome de Worker de produção e o ID do D1 de produção. Antes de executar, confira o diff da configuração; mantenha o ID real versionado após a criação.

`demo:db:migrate` aplica as migrações compartilhadas e depois inicializa `demo/schema.sql`. Essa etapa cria a tabela de visitantes e os marcadores exclusivos `bot_id=999001` e `public_demo=1`; não habilita a demonstração em um banco vinculado a outro bot. O Worker recusa as rotas de API e login se os marcadores não corresponderem à configuração fictícia.

Nas atualizações, execute `demo:db:migrate` quando houver migrações novas e `demo:deploy` após as verificações. Os comandos usam explicitamente `demo/local.env`, sem carregar `.env` ou `.dev.vars` de produção. O token `999001:public_demo_only` é fictício e não autentica no Telegram. Não configure segredos reais nesse Worker.

Depois da publicação, verifique `/health` (`service: zelumi-demo`), a entrada sem Telegram, Visão geral, Lançamentos, edição e exclusão, Perfil, temas e logout. Use dois navegadores ou perfis separados para conferir o isolamento. O teste local usa o mesmo Worker e API, mas não substitui a verificação do endereço publicado.

Para divulgar, adicione o endereço verificado ao README. Para oferecer o link também na entrada da aplicação principal, configure `NEXT_PUBLIC_DEMO_URL` na Vercel e publique o frontend novamente. Deixe `NEXT_PUBLIC_DEMO` ausente na Vercel: essa flag pertence exclusivamente ao build da demonstração. O fluxo de login real permanece no site principal.

## Sessões e manutenção

As sessões duram até 24 horas, com cookie `Secure`, `HttpOnly` e `SameSite=Lax`. As alterações usam a mesma API, proteção CSRF, isolamento por conta e controle de versão do produto. O login não aceita identificação fornecida pelo visitante. Até cinco novas contas por IP podem ser iniciadas em cada janela de dez minutos; a repetição com cookie válido reutiliza a conta atual.

O cron horário remove até 100 contas vencidas por execução, incluindo sessões, registros, projeções, operações idempotentes e categorias aprendidas. O acesso expira independentemente da limpeza física. Logout revoga o acesso imediatamente, mas os dados fictícios da conta anterior aguardam essa limpeza. Monitore erros do cron e os limites de uso do D1/Workers na Cloudflare; um acúmulo acima de 100 contas vencidas por hora exige ampliar a rotina ou sua frequência.

## Publicação automática pelo GitHub Actions

O [workflow CI](../../.github/workflows/ci.yml) publica a demonstração após as verificações passarem em um push na `main`. Uma execução manual pela aba Actions, selecionando a `main`, repete o mesmo fluxo. PRs e outras branches executam apenas as verificações, sem receber credenciais de publicação.

O job **Publicar demonstração** instala as dependências do commit verificado, executa `demo:db:migrate`, executa `demo:deploy` e valida a resposta de `/health`. As migrações preservam os dados existentes; uma publicação não recria os exemplos de sessões ativas. Se uma etapa falhar, o job falha e as seguintes não são executadas. Uma falha de publicação após migrações não desfaz as migrações; mantenha-as compatíveis com a versão anterior do Worker.

As publicações são serializadas. Um novo push na `main` não cancela uma publicação em andamento. Em PRs, verificações substituídas podem ser canceladas. O frontend e a API da demonstração são publicados juntos pelo Worker exclusivo, sem atualizar o Worker do produto ou o site Vercel.

Configurar em **Settings → Secrets and variables → Actions → Repository secrets**:

| Secret | Valor |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Identificador da conta que contém `zelumi-demo` e `zelumi-public-demo` |
| `CLOUDFLARE_API_TOKEN` | API Token autorizado a publicar Workers e aplicar migrações D1 nessa conta |

O login OAuth local do Wrangler não é usado pelo Actions. Crie um API Token na Cloudflare com o modelo **Edit Cloudflare Workers**, inclua **D1 → Edit** e limite os recursos à conta do projeto. Siga a [documentação oficial de autenticação no GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/). Cadastre o token diretamente no GitHub, sem incluí-lo no código, em logs ou mensagens. Ao revogá-lo ou expirá-lo, substitua o secret antes da próxima publicação.

O job verifica a presença dos dois secrets e falha com uma mensagem de configuração quando algum está ausente. Para confirmar a ativação, execute o workflow na `main`, confira o job **Publicar demonstração** e abra o endereço público. O comando local `demo:deploy` permanece disponível para manutenção.
