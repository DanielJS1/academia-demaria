import Link from "next/link";
import { headers } from "next/headers";
import { ResourceNavigation } from "@/components/kb/resource-navigation";
import { KB_PUBLIC_SITE } from "@/lib/kb/public-links";
import "@/styles/kb.css";
export default async function KbLayout({children}:{children:React.ReactNode}){const publicHost=(await headers()).get("host")===new URL(KB_PUBLIC_SITE).host;return <div className="kb kb-public-site"><a className="kb-skip" href="#kb-main">Ir ao conteúdo</a><header className="kb-header"><Link href="/bc" aria-label="Base de Conhecimento DeMaria"><img src="/demaria-logo.png" alt="DeMaria" width="100" height="91"/></Link><div className="kb-header-links">{!publicHost&&<Link href="/">Academia DeMaria</Link>}<ResourceNavigation/>{!publicHost&&<Link href="/conhecimento/oficial">Área editorial</Link>}</div></header><main id="kb-main">{children}</main><footer className="kb-footer">DeMaria · Documentação oficial de produtos</footer></div>;}
