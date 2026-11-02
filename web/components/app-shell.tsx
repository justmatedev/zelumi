'use client';
import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {useEffect,type ReactNode} from 'react';
import {LayoutDashboard,ArrowLeftRight,UserRound,ArrowUpRight} from 'lucide-react';
import {Brand} from '@/components/brand';
import {useSession} from '@/components/session-provider';
import {Button} from '@/components/ui/button';
const items=[{href:'/visao-geral/',label:'Visão geral',icon:LayoutDashboard},{href:'/lancamentos/',label:'Lançamentos',icon:ArrowLeftRight},{href:'/perfil/',label:'Perfil',icon:UserRound}];
export function AppShell({children}:{children:ReactNode}) {
 const session=useSession(),router=useRouter(),path=usePathname();
 useEffect(()=>{if(session.status==='anonymous')router.replace('/');},[session.status,router]);
 if(session.status!=='authenticated')return <main className="access-state"><Brand/><div role="status"><h1>{session.status==='error'?'Não foi possível carregar sua conta':'Carregando seu espaço…'}</h1><p>{session.status==='error'?'Confira sua conexão e tente novamente.':'Um momento, estamos conferindo seu acesso.'}</p>{session.status==='error'&&<Button onClick={()=>void session.refresh()}>Tentar novamente</Button>}</div></main>;
 const title=items.find(i=>path.replace(/\/$/,'')===i.href.replace(/\/$/,''))?.label||'Zelumi';
 return <div className="app-shell"><aside className="sidebar"><Brand/><p className="nav-caption">SEU ESPAÇO</p><nav aria-label="Principal">{items.map(({href,label,icon:Icon})=><Link key={href} href={href} aria-current={title===label?'page':undefined} className={title===label?'nav-item active':'nav-item'}><Icon size={19}/>{label}</Link>)}</nav><div className="sidebar-note"><span>Uma mensagem.<br/>Tudo mais organizado.</span><a href="https://t.me/financeiro_lab_482_bot" target="_blank" rel="noreferrer">Abrir o Telegram <ArrowUpRight size={15}/></a></div><span className="sidebar-foot">zelumi · no seu ritmo</span></aside><div className="app-main"><header className="app-header"><span className="breadcrumb">Seu espaço <span>/</span> <strong>{title}</strong></span><Link href="/perfil/" className="header-profile" aria-label="Abrir perfil"><UserRound size={17}/><span>{session.user?.firstName}</span></Link></header><main className="page-content">{children}<footer className="page-footer"><span>Menos esforço para acompanhar suas finanças.</span><span>zelumi · no seu ritmo</span></footer></main></div></div>;
}
