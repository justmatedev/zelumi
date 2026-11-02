# Primeiro envio do Zelumi ao GitHub

## Conteúdo do repositório

Usar um único repositório **privado chamado `zelumi`**, com o conteúdo desta pasta diretamente na raiz. Incluir `web/`, `bot/`, `cloudflare/`, `finance/`, `tests/`, `scripts/`, `docs/`, `design/` e `dist/`, além das configurações e dos dois `package-lock.json`.

A pasta `dist/` contém o protótipo antigo e o interpretador que o bot ainda reutiliza; não deve ser excluída como se fosse apenas um build. O build do novo site é `web/out/`, que é gerado e ignorado.

Os nomes antigos em arquivos/configurações/documentação permanecem por enquanto, conforme combinado. A renomeação oficial do bot e dos endereços será uma etapa separada. Não reescrever o histórico para este primeiro envio privado.

Os estudos visuais descartáveis foram retirados da versão atual: capturas PNG, prévias HTML/CSS/JS, comparações, gerador dos conceitos e logos não escolhidos. `design/` mantém os quatro SVGs da opção 02 e as fontes com suas licenças. A documentação técnica e o protótipo em `dist/` foram preservados. Os arquivos removidos continuam nos commits anteriores e, mantendo o histórico, também serão enviados ao repositório privado.

## O que fica somente na máquina

O `.gitignore` exclui `.env`, `.dev.vars`, autenticação/estado do Wrangler, bancos locais, dependências, builds, logs, certificados/chaves privados e artefatos locais da Vercel. Os exemplos `.env.example` e `.dev.vars.example` são rastreados; contêm campos vazios ou valores fictícios.

Guardar exportações financeiras e backups na pasta ignorada `data/`. Migrações em `cloudflare/migrations/` são código e devem ser enviadas; arquivos SQL com dados exportados não devem ser colocados nessa pasta.

IDs de recursos e URLs em `wrangler.jsonc` são configuração do piloto, não credenciais. Um clone não obtém acesso ao D1 remoto sem autorização na conta Cloudflare. Para usar outra infraestrutura, configurar seus próprios recursos antes de publicar.

`.openai/hosting.json` identifica o protótipo anterior do Sites, preservado no histórico. Não é necessário para a publicação atual na Cloudflare; não alterar sua identidade como parte do primeiro envio ao GitHub.

## Criar o repositório remoto

No GitHub, criar `zelumi` com visibilidade **Private** e sem inicializar README, `.gitignore` ou licença: esses arquivos, quando aplicáveis, devem vir do projeto local. Isso evita um histórico remoto independente já no primeiro envio.

Se o repositório já existir, usar o existente. Não apagar conteúdo remoto nem forçar o envio para contornar divergências; comparar o que existe antes de integrar.

Depois de criar, copiar somente a URL HTTPS ou SSH do repositório para configurar o remoto e fazer o primeiro push. Não enviar senha, token ou chave privada pelo chat. A escolha da branch remota inicial (`main`) deve ser feita nessa etapa, preservando as branches e o histórico locais; não é necessário apagar `.git` ou executar `git init` novamente.

## Conferir antes de enviar

Na raiz do projeto:

```sh
git status --short
git remote -v
git diff --cached --stat
git diff --cached
git check-ignore .env .dev.vars .wrangler web/node_modules web/.next web/out
```

`git diff --cached` mostra o que entrará no próximo commit, não todos os arquivos de commits anteriores. A primeira revisão também deve considerar o histórico que será enviado.

Após instalar dependências, as verificações do projeto são:

```sh
npm ci
npm --prefix web ci
npm test
npm run web:check
```

`npm test` usa bancos locais e Telegram simulado. A verificação de frontend inclui tipos, testes, build estático e conferência de exportação. Não depende de `.env`, login Cloudflare, conta Telegram real ou dados financeiros da produção. O emulador D1 precisa poder abrir portas locais.

## Depois do primeiro envio

O GitHub armazenará o código e seu histórico. O site continuará publicado no Worker existente: push no GitHub, sozinho, não executa deploy neste projeto. Não foi criado workflow de publicação automática ou armazenado segredo em GitHub Actions.

Renomear o repositório ou arquivos não remove os nomes antigos dos commits. Antes de tornar o código público, revisar também documentação, configurações e histórico. Se decidir começar um histórico público novo, preservar uma cópia privada do desenvolvimento e planejar a troca separadamente, sem apagar o trabalho atual.

## Preparação realizada

Na revisão local de 02/11/2026, foram verificados os caminhos rastreados e 197 blobs alcançáveis pelo histórico Git existente. Não foram encontrados caminhos privados conhecidos, valores das credenciais locais comparadas ou padrões de token Telegram/GitHub e chave privada pesquisados. Nenhum valor de credencial foi impresso ou acrescentado à documentação.

Essa revisão corresponde ao estado preparado nesta etapa; novas alterações precisam ser conferidas antes de futuros envios.

Uma cópia temporária dos arquivos rastreados, com os ajustes desta preparação, foi instalada usando os dois lockfiles, sem `.env`, dependências ou autenticação locais. Passaram 66 testes de backend/D1, 15 testes da interface, tipos, build e verificação dos 52 arquivos exportados. Os lockfiles não foram alterados pela instalação. Nenhum deploy ou envio ao GitHub foi feito nesta preparação.
