// Catálogo único para o bot, a validação da API e as opções do painel.
export const expenseCategories=[
 'Alimentação','Transporte','Casa','Saúde','Educação','Lazer','Compras',
 'Assinaturas','Cuidados pessoais','Pets','Viagens','Impostos e taxas','Outros',
];
export const categories=['Receitas',...expenseCategories];

// Expressões são reconhecidas antes dos termos gerais: "Uber Eats" é
// alimentação, mas "Uber Eats e táxi" continua sendo uma descrição ambígua.
const phrases={
 'Alimentação':['uber eats'],
 'Casa':['energia eletrica','conta de agua','conta agua','conta de luz','conta luz'],
 'Saúde':['plano de saude','plano saude','seguro saude','seguro de saude','seguro de vida','seguro vida'],
 'Educação':['material escolar','materiais escolares','livro de receitas','livro receitas'],
 'Assinaturas':['assinatura de software','assinatura software','assinatura de jogos','assinatura jogos','xbox game pass','game pass','amazon prime','youtube premium','google one'],
 'Pets':['pet shop','petshop','banho e tosa','racao para cachorro','racao para gato'],
 'Viagens':['passagem aerea','passagens aereas','seguro viagem','seguro de viagem'],
 'Impostos e taxas':['imposto de renda','imposto renda','tarifa bancaria','tarifas bancarias','taxa bancaria','taxas bancarias'],
};

const terms={
 'Alimentação':['pao','paes','padaria','padarias','almoco','jantar','cafe','cafes','lanche','lanches','mercado','mercados','supermercado','supermercados','pizza','pizzas','pizzaria','restaurante','restaurantes','ifood','acai','hamburguer','hamburgueres','lanchonete','feira','acougue'],
 'Transporte':['uber','onibus','gasolina','combustivel','combustiveis','metro','taxi','taxis','estacionamento','pedagio','pedagios','etanol','diesel','transporte'],
 'Casa':['aluguel','luz','agua','internet','condominio','energia','gas','reforma','limpeza','faxina','encanador','eletricista','moveis'],
 'Saúde':['farmacia','farmacias','remedio','remedios','medicamento','medicamentos','medico','medica','consulta','consultas','dentista','exame','exames','hospital','fisioterapia','terapia','psicologo','psicologa','saude'],
 'Educação':['faculdade','escola','escolas','curso','cursos','livro','livros','universidade','mensalidade escolar','creche','educacao'],
 'Lazer':['cinema','show','shows','teatro','jogo','jogos','parque','passeio','passeios','ingresso','ingressos','lazer'],
 'Compras':['roupa','roupas','calcado','calcados','sapato','sapatos','tenis','notebook','celular','eletronico','eletronicos','computador','camiseta','camisetas','calca','calcas','vestido','vestidos'],
 'Assinaturas':['netflix','spotify','assinatura','assinaturas','streaming','globoplay','disney','icloud'],
 'Cuidados pessoais':['cabeleireiro','cabeleireira','barbeiro','barbearia','manicure','pedicure','cosmetico','cosmeticos','perfume','perfumes','salao','depilacao'],
 'Pets':['veterinario','veterinaria','racao','racoes','pet','pets'],
 'Viagens':['hotel','hoteis','hospedagem','pousada','pousadas','airbnb','viagem','viagens','aeroporto'],
 'Impostos e taxas':['iptu','ipva','imposto','impostos','tributo','tributos','iof','darf','taxa','taxas','tarifa','tarifas'],
};

const normalize=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const compile=rules=>Object.entries(rules).map(([category,words])=>[
 category,new RegExp(`(^| )(?:${words.map(normalize).sort((a,b)=>b.length-a.length).join('|')})(?= |$)`,'g'),
]);
const phraseRules=compile(phrases),termRules=compile(terms);

export function classifyExpense(description){
 let remaining=normalize(description);
 const matches=new Set();
 for(const [category,pattern] of phraseRules){
  remaining=remaining.replace(pattern,match=>{matches.add(category);return ' '.repeat(match.length);});
 }
 for(const [category,pattern] of termRules){
  pattern.lastIndex=0;
  if(pattern.test(remaining))matches.add(category);
 }
 return matches.size===1?[...matches][0]:'Outros';
}
