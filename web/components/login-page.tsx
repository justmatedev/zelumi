'use client';
import {useCallback,useEffect} from 'react';
import {useRouter} from 'next/navigation';
import {Check,LockKeyhole,MessageCircle,ShieldCheck} from 'lucide-react';
import {Brand,Symbol} from '@/components/brand';
import {useSession} from '@/components/session-provider';
import {TelegramLogin} from '@/components/telegram-login';
import {LocalLogin} from '@/components/local-login';
import {Button} from '@/components/ui/button';
export function LoginPage(){
 const {status,refresh}=useSession(),router=useRouter();
 useEffect(()=>{if(status==='authenticated')router.replace('/visao-geral/');},[status,router]);
 const onSuccess=useCallback(()=>{void refresh().then(()=>router.replace('/visao-geral/'));},[refresh,router]);
 return <main className="login-page"><header className="login-header"><Brand/><span>Seu dinheiro, com mais clareza.</span></header><div className="login-layout"><section className="login-story"><p className="eyebrow">MENOS ESFORÇO. MAIS CLAREZA.</p><h1>Suas finanças<br/>começam com<br/><span>uma conversa.</span></h1><p>Registre pelo Telegram, acompanhe pelo Zelumi.<br/>Um jeito mais leve de cuidar do seu dinheiro.</p><div className="conversation-example"><p className="example-label">É TÃO SIMPLES QUANTO ENVIAR UMA MENSAGEM</p><div className="example-sent">pão 10 <span>✓✓</span></div><div className="example-received"><span className="example-check"><Check size={20}/></span><div><strong>Despesa registrada</strong><p>Pão · R$ 10,00</p></div></div><span className="example-note">Exemplo de registro pelo bot</span></div><div className="story-foot"><MessageCircle size={16}/><span>Pequenos registros. Uma visão mais clara.</span></div></section><section className="login-form" aria-labelledby="login-title"><span className="login-emblem"><Symbol/></span><p className="eyebrow">BEM-VINDO AO ZELUMI</p><h2 id="login-title">Seu espaço financeiro.</h2><p>Entre com sua conta do Telegram para acessar seu painel e acompanhar suas finanças.</p>{status==='anonymous'?(process.env.NODE_ENV==='development'&&process.env.NEXT_PUBLIC_LOCAL_DEV==='1'?<LocalLogin onSuccess={onSuccess}/>:<TelegramLogin onSuccess={onSuccess}/>):status==='error'?<div><p role="alert" className="error-message">Não foi possível conferir seu acesso. Tente novamente.</p><Button onClick={()=>void refresh()}>Tentar novamente</Button></div>:<p role="status" className="login-progress">{status==='authenticated'?'Abrindo seu espaço…':'Conferindo seu acesso…'}</p>}<p className="login-help">Sem criar outra senha.<br/>Use a mesma conta com que você conversa com o bot.</p><div className="login-divider"/><div className="login-private"><ShieldCheck size={19}/><span>Seus registros ficam na sua conta.<br/>Só você tem acesso às suas informações.</span></div><div className="login-security"><LockKeyhole size={12}/> Autenticação pelo Telegram</div></section></div><footer className="login-footer"><span>Feito para acompanhar a vida real.</span><span>zelumi · no seu ritmo</span></footer></main>;
}
