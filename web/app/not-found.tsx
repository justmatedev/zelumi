import {Brand} from '@/components/brand';
import {Button} from '@/components/ui/button';
import Link from 'next/link';
export default function NotFound(){return <main className="access-state"><Brand/><div><p className="eyebrow">404</p><h1>Esse caminho não existe.</h1><p>Volte ao início para continuar no Zelumi.</p><Button asChild><Link href="/">Voltar ao início</Link></Button></div></main>;}
