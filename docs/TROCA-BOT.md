# Troca para o bot definitivo Zelumi

O usuário criou **Zelumi**, username **@zelumi_bot**, e autorizou a integração ao site `https://usezelumi.vercel.app`, preservando seus lançamentos. O ID numérico do bot é diferente do username. O token novo é preparado no campo local ignorado `TELEGRAM_NEXT_BOT_TOKEN`; o token anterior permanece ativo até a troca.

## Ordem da execução

1. Conferir os dois bots por `getMe` e seus webhooks, sem expor tokens. Criar backup privado do D1 em `data/`, fora do Git.
2. Instalar uma migração aditiva que permita trocar o vínculo do banco em uma única transação: rejeitar a troca com respostas pendentes, preservar registros/projeções/perfis, limpar deduplicação e perguntas do bot anterior e revogar sessões/fluxos de login.
3. Publicar proteções contra instâncias antigas: gravação de webhook e entrega de cada resposta verificam o ID vinculado ao banco; login e API recusam tokens de outro bot.
4. Desativar o webhook antigo sem descartar updates, conferir a fila e atualizar o vínculo por comparação com o ID esperado. Guardar as credenciais anteriores em `.env.previous-bot`, ignorado pelo Git.
5. Configurar o novo token e um novo segredo de webhook na Cloudflare, atualizar username e links para `zelumi_bot`, publicar e ativar o webhook do novo bot. Preservar a chave do proxy Vercel e o D1 existentes.
6. Conferir os registros antes/depois e testar endpoints públicos, assinatura inválida e estado dos webhooks. Vincular o domínio do site ao bot novo no BotFather e validar login e `/hoje` com o usuário.

## Verificações necessárias

Testes D1 reais devem cobrir preservação dos corpos e owners, colisão de update IDs entre bots, troca recusada com outbox pendente, rollback de erro no trigger, requisição antiga que tenta gravar após a troca, cron antigo que tenta entregar uma resposta nova e sessão com token incompatível.

O bot antigo não será apagado nem terá seu token revogado. Seu webhook será desativado; um uso futuro como ambiente de testes exige banco/configuração próprios. Conversas e botões de mensagens antigas permanecem no Telegram, mas não são transferidos para a conversa nova. Cada usuário inicia a conversa com `@zelumi_bot` para usá-lo.

## Se houver falha na troca

Parar a ativação do bot novo e preservar os backups. Uma troca de volta usa a mesma comparação de IDs e requer fila vazia; não restaura automaticamente sessões ou perguntas antigas. Não restaurar um dump inteiro sobre lançamentos novos nem reimportar registros para trocar apenas o token. Credenciais, webhooks e configuração devem corresponder ao mesmo bot antes de reabrir o uso.
