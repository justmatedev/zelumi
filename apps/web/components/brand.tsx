import Link from 'next/link';
export function Symbol({className}:{className?:string}) {
 return <svg className={className} width="44" height="44" viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M19 11H45A12 12 0 0 1 57 23V39A12 12 0 0 1 45 51H27L12 58V46A12 12 0 0 1 7 36V23A12 12 0 0 1 19 11Z" stroke="currentColor" strokeWidth="4.5" strokeLinejoin="round"/><path d="M22 24H42L22 38H42" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
export function Brand(){return <Link href="/" className="brand" aria-label="Zelumi, início"><Symbol/><span>zelumi</span></Link>;}
