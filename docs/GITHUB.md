# Repositório do Zelumi no GitHub

## Conteúdo do repositório

Usar um único repositório **privado chamado `zelumi`**, com o conteúdo desta pasta diretamente na raiz. Incluir `web/`, `dev/`, `bot/`, `cloudflare/`, `finance/`, `tests/`, `scripts/`, `docs/`, `design/` e `shared/`, além das configurações e dos dois `package-lock.json`.

O interpretador compartilhado fica em `shared/parser.mjs`. O protótipo antigo em `dist/` foi retirado, junto com seu comando `npm start`; use `npm run dev` para o ambiente completo com conta de teste; `npm run web:dev` inicia apenas a interface. O build do site é `web/out/`, que é gerado e ignorado.

A pasta local e os textos ativos usam Zelumi. O SQLite local padrão usa `data/zelumi.sqlite`. Worker, subdomínio e D1 usam Zelumi. A publicação Vercel deve incluir o destino atualizado do proxy. O bot definitivo é `@zelumi_bot` e o site principal é `https://usezelumi.vercel.app`, conforme [BOT.md](./BOT.md) e [VERCEL.md](./VERCEL.md). Conferir [NOMES-INFRAESTRUTURA.md](./NOMES-INFRAESTRUTURA.md) antes de alterar os destinos de produção.

Os estudos visuais descartáveis antigos foram retirados: prévias HTML/CSS/JS, comparações exploratórias, gerador dos conceitos e logos não escolhidos. Manter em `design/` os quatro SVGs escolhidos, fontes/licenças, avatares finais, [guia visual](../design/GUIA-VISUAL.md), [relatório de auditoria](../design/AUDITORIA-VISUAL.md) e suas capturas de referência. Essas capturas oficiais fazem parte da documentação atual e não são os estudos descartáveis antigos.

Planos internos e notas de execução não fazem parte do conteúdo permanente. Os quatro planos recentes foram retirados na limpeza aprovada e preservados em arquivo privado dentro de `data/manutencao/`; as decisões úteis permanecem no README, guia, auditoria e [DECISOES.md](./DECISOES.md). Materiais de desenvolvimento que já estavam em commits antigos continuam recuperáveis pelo histórico.

## O que fica somente na máquina

O `.gitignore` exclui `.env`, `.dev.vars`, autenticação/estado do Wrangler, bancos locais, dependências, builds, logs, certificados/chaves privados e artefatos locais da Vercel. Os exemplos `.env.example` e `.dev.vars.example` são rastreados; contêm campos vazios ou valores fictícios.

Guardar exportações financeiras e backups na pasta ignorada `data/`. Migrações em `cloudflare/migrations/` são código e devem ser enviadas; arquivos SQL com dados exportados não devem ser colocados nessa pasta.

IDs de recursos e URLs em `wrangler.jsonc` são configuração do piloto, não credenciais. Um clone não obtém acesso ao D1 remoto sem autorização na conta Cloudflare. Para usar outra infraestrutura, configurar seus próprios recursos antes de publicar.

A configuração do protótipo anterior do Sites foi movida de `.openai/hosting.json` para [docs/archive/sites-hosting.json](./archive/sites-hosting.json), preservando seu identificador original. É um registro histórico, não uma configuração de publicação ativa. O diretório `dist` mencionado nesse registro foi retirado; para recuperar o protótipo completo, use os commits anteriores. Arquivar a configuração local não exclui nem atualiza o Site remoto.

## Configuração do repositório remoto

O repositório atual já está configurado, conforme a seção abaixo. As instruções seguintes servem somente se for necessário preparar outro remoto.

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
git check-ignore .env .dev.vars .wrangler data node_modules web/node_modules web/.next web/.next-local web/out
```

`git diff --cached` mostra o que entrará no próximo commit, não todos os arquivos de commits anteriores. A primeira revisão também deve considerar o histórico que será enviado.

Após instalar dependências, as verificações do projeto são:

```sh
npm ci
npm --prefix web ci
npm test
npm run web:build
npm --prefix web run typecheck
npm --prefix web test
```

`npm test` usa bancos locais e Telegram simulado. O primeiro build gera os tipos referenciados pelo Next.js; as etapas seguintes conferem tipos e testes, além da exportação já verificada no build. Com os tipos gerados, `npm run web:check` também reúne essas verificações. Não depende de `.env`, login Cloudflare, conta Telegram real ou dados financeiros da produção. O emulador D1 precisa poder abrir portas locais.

## Depois do primeiro envio

O repositório privado [justmatedev/zelumi](https://github.com/justmatedev/zelumi) está conectado como `origin`, com branch principal `main`. A integração Git da Vercel publica o frontend a cada atualização da branch principal. O Worker da Cloudflare continua sendo publicado separadamente por `npm run cf:deploy`; push no GitHub não atualiza esse backend. Não foi criado workflow ou armazenado segredo em GitHub Actions. Veja [a configuração da Vercel](./VERCEL.md).

Renomear o repositório ou arquivos não remove os nomes antigos dos commits. Antes de tornar o código público, revisar também documentação, configurações e histórico. Se decidir começar um histórico público novo, preservar uma cópia privada do desenvolvimento e planejar a troca separadamente, sem apagar o trabalho atual.

## Registro histórico da preparação

Na revisão local de 02/11/2026, foram verificados os caminhos rastreados e 197 blobs alcançáveis pelo histórico Git existente. Não foram encontrados caminhos privados conhecidos, valores das credenciais locais comparadas ou padrões de token Telegram/GitHub e chave privada pesquisados. Nenhum valor de credencial foi impresso ou acrescentado à documentação.

Essa revisão corresponde ao estado preparado nesta etapa; novas alterações precisam ser conferidas antes de futuros envios.

Uma cópia temporária dos arquivos rastreados, com os ajustes desta preparação, foi instalada usando os dois lockfiles, sem `.env`, dependências ou autenticação locais. Passaram 66 testes de backend/D1, 15 testes da interface, tipos, build e verificação dos 52 arquivos exportados. Os lockfiles não foram alterados pela instalação. Nenhum deploy ou envio ao GitHub foi feito nesta preparação.
