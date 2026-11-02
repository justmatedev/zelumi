import type {Metadata} from 'next';
import localFont from 'next/font/local';
import {ThemeProvider} from '@/components/theme-provider';
import {SessionProvider} from '@/components/session-provider';
import './globals.css';
const manrope=localFont({src:'./fonts/Manrope-wght.ttf',variable:'--font-manrope',display:'swap',weight:'200 800'});
const inter=localFont({src:'./fonts/Inter-wght.ttf',variable:'--font-inter',display:'swap',weight:'100 900'});
export const metadata:Metadata={title:{default:'Zelumi — seu espaço financeiro',template:'%s · Zelumi'},description:'Registre pelo Telegram, acompanhe pelo Zelumi. Um jeito mais leve de cuidar do seu dinheiro.',robots:{index:false,follow:false},icons:{icon:'/brand/simbolo.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR" suppressHydrationWarning><body className={`${manrope.variable} ${inter.variable}`}><ThemeProvider><SessionProvider>{children}</SessionProvider></ThemeProvider></body></html>;}
