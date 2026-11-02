# Miúdo

Protótipo de validação do fluxo de registro financeiro por mensagens, em português brasileiro. Conversa simulada, resumo de entradas e saídas, correção, desfazer, parcelas, persistência local e exportação CSV. Sem dependências de build.

## Executar

```sh
npm start
```

Acesse http://localhost:4173. Rode `npm test` para verificar o interpretador.

## Limites explícitos

O protótipo usa regras locais; não tem integração real com Telegram, IA, autenticação, servidor de dados ou lembretes. Não recebe nem envia mensagens reais. As informações ficam em localStorage do navegador. O saldo considera o valor total das compras, incluindo parcelas futuras. O cronograma de parcelas é calculado por lançamento, com centavos distribuídos para preservar o total. Datas aceitas nas mensagens: hoje (padrão) e ontem.

Para resolver uma pergunta pendente, informe só o valor total ou envie `cancelar`. Datas, categorias e parcelas podem ser alteradas em Editar. Valores negativos e zero não são aceitos; receitas usam valor positivo e tipo receita.

## Próxima etapa: bot real

Reutilizar o contrato do interpretador no servidor e acrescentar webhook autenticado do Telegram, vínculo seguro entre usuário e conta, banco de dados, deduplicação por update_id e tratamento de respostas associado à mensagem pendente. Usar o token do bot somente no servidor. Para linguagem mais ampla, substituir ou complementar o interpretador com extração por IA e validação dos campos antes de persistir. Avaliar o comportamento com mensagens reais antes de prometer cobertura de linguagem livre.
