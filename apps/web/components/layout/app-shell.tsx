'use client';
import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {useEffect,type ReactNode} from 'react';
import {UserRound} from 'lucide-react';
import {Sidebar,MobileMenu,navigationItems,useSidebarPreference} from '@/components/layout/sidebar';
import {Brand} from '@/components/brand';
import {useSession} from '@/features/auth/providers/session-provider';
import {Button} from '@/components/ui/button';
export function AppShell({children}:{children:ReactNode}) {
 const session=useSession(),router=useRouter(),path=usePathname(),sidebar=useSidebarPreference();
 useEffect(()=>{if(session.status==='anonymous')router.replace('/');},[session.status,router]);
 if(session.status!=='authenticated')return <main className="access-state"><Brand/><div role="status"><h1>{session.status==='error'?'Não foi possível carregar sua conta':'Carregando seu espaço…'}</h1><p>{session.status==='error'?'Confira sua conexão e tente novamente.':'Um momento, estamos conferindo seu acesso.'}</p>{session.status==='error'&&<Button onClick={()=>void session.refresh()}>Tentar novamente</Button>}</div></main>;
 const title=navigationItems.find(i=>path.replace(/\/$/,'')===i.href.replace(/\/$/,''))?.label||'Zelumi';
 return <div className="app-shell" data-sidebar-collapsed={sidebar.collapsed}><Sidebar path={path} collapsed={sidebar.collapsed} onToggle={sidebar.toggle}/><div className="app-main"><header className="app-header"><div className="header-navigation"><MobileMenu path={path}/><span className="breadcrumb"><span className="breadcrumb-parent">Seu espaço</span><span className="breadcrumb-separator">/</span> <strong>{title}</strong></span></div><Link href="/perfil/" className="header-profile" aria-label="Abrir perfil"><UserRound size={17}/><span>{session.user?.firstName}</span></Link></header><main className="page-content" key={session.csrfToken}>{children}<footer className="page-footer"><span>Menos esforço para acompanhar suas finanças.</span><span>zelumi · no seu ritmo</span></footer></main></div></div>;
}
