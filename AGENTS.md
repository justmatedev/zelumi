# Convenções do projeto Zelumi

## Alterações visuais

- Antes de criar ou alterar uma interface, leia `design/GUIA-VISUAL.md`.
- Use `apps/web/app/tokens.css` para os valores compartilhados e os componentes existentes para marca, botões, cards, navegação e lançamentos.
- Preserve os temas claro/escuro, a hierarquia dos textos e os padrões responsivos do guia. Não introduza outra fonte, paleta ou linguagem de componentes sem uma mudança de direção solicitada pelo usuário.
- Mantenha o layout compartilhado do painel para preservar a navegação entre páginas.
- Ao alterar um padrão, atualize guia, tokens e implementação juntos. `docs/DECISOES.md` registra o histórico; o guia visual reúne as regras atuais.
- Verifique textos longos, valores altos e teclado, além de desktop/celular. Não reduza informações abaixo de 12 px para fazer um layout caber.
- Para mudanças de código, rode as verificações apropriadas descritas no README. Revisões somente de documentação pedem conferência de consistência e links, sem testes que apenas repitam seu conteúdo.

Instruções diretas do usuário têm precedência sobre estas convenções.
