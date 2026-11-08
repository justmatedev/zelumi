'use client';
import {useState} from 'react';
import {Check,LogOut,Sun,Moon,Monitor} from 'lucide-react';
import {useSession} from '@/features/auth/providers/session-provider';
import {useTheme} from '@/components/theme-provider';
import {Card} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {CategoryManagement} from './category-management';
export function Profile(){
 const {user,logout,csrfToken}=useSession(),{theme,setTheme}=useTheme();const [busy,setBusy]=useState(false),[error,setError]=useState('');
 if(!user)return null;
 const fullName=[user.firstName,user.lastName].filter(Boolean).join(' '),initials=Array.from(user.firstName)[0]?.toLocaleUpperCase('pt-BR')||'Z';
 async function exit(){setBusy(true);setError('');try{await logout();}catch{setError('Não foi possível encerrar sua sessão. Tente novamente.');setBusy(false);}}
 return <><div className="page-heading"><p className="eyebrow">SEU ESPAÇO, DO SEU JEITO</p><h1>Perfil</h1><p>Sua conta e suas preferências em um só lugar.</p></div><div className="profile-content"><Card><h2>Conta Telegram</h2><p className="card-description">A mesma conta para registrar e acompanhar suas finanças.</p><div className="account-heading"><div className="avatar" aria-hidden="true">{initials}</div><div className="account-name"><strong>{fullName}</strong>{user.username&&<p>@{user.username}</p>}</div><span className="linked-label"><Check size={14}/> Telegram vinculado</span></div><dl className="account-facts"><div><dt>Nome</dt><dd>{fullName}</dd></div><div><dt>Usuário Telegram</dt><dd>{user.username?`@${user.username}`:'Não informado'}</dd></div><div><dt>Forma de acesso</dt><dd>Telegram</dd></div></dl></Card><Card><h2>Aparência</h2><p className="card-description">Escolha o tema que combina com seu momento.</p><div className="theme-options" role="group" aria-label="Preferência de tema">{([{value:'light',label:'Claro',Icon:Sun},{value:'dark',label:'Escuro',Icon:Moon},{value:'system',label:'Sistema',Icon:Monitor}] as const).map(({value,label,Icon})=><button key={value} className="theme-option" aria-pressed={theme===value} onClick={()=>setTheme(value)}><span className={`theme-swatch ${value}`} aria-hidden="true"><span className="swatch-sidebar"/><span className="swatch-content"><i/><span><b/><b/><b/></span></span></span><span className="theme-label"><span><Icon size={15}/>{label}</span>{theme===value&&<Check size={15}/>}</span></button>)}</div><p className="preference-note">{theme==='system'?'O Zelumi acompanha o tema do seu dispositivo.':'A preferência fica salva neste navegador.'}</p></Card><CategoryManagement key={csrfToken}/><Card className="session-card"><div><h2>Sua sessão</h2><p className="card-description">Encerre o acesso ao painel neste navegador.</p>{error&&<p role="alert" className="error-message">{error}</p>}</div><Button variant="outline" onClick={()=>void exit()} disabled={busy}><LogOut size={16}/>{busy?'Saindo…':'Sair da conta'}</Button></Card></div></>;
}
