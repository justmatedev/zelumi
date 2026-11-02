import {AppShell} from '@/components/app-shell';
import {PendingFinance} from '@/components/pending-finance';
export const metadata={title:'Visão geral'};
export default function Page(){return <AppShell><PendingFinance page="overview"/></AppShell>;}
