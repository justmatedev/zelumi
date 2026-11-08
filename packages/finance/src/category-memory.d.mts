export function normalizeCategoryDescription(description:string):string;
export function chooseLocalCategory(input:{type:string;description:string;manual?:string|null;terms?:{phrase:string;category:string}[]}):{category:string;source:string;needsAI:boolean};
export function suggestTerms(associations:{description_key:string;category:string;source?:string}[]):{phrase:string;category:string;examples:number}[];
