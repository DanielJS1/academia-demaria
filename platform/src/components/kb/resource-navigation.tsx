"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Search, Play, FileClock } from "lucide-react";

export function ResourceNavigation({ internal = false }: { internal?: boolean }) {
  const pathname = usePathname(), base = internal ? "/conhecimento/base" : "/bc";
  const home = pathname === base || (!internal && pathname === "/");
  return <nav className="kb-resource-nav" aria-label="Navegação da Base">
    {(internal || !home) && <Link href={base} aria-current={home ? "page" : undefined}>{internal ? <BookOpen size={17} aria-hidden="true"/> : <Search size={17} aria-hidden="true"/>}{internal ? "Artigos" : "Pesquisar"}</Link>}
    <Link href={`${base}/videos`} aria-current={pathname === `${base}/videos` ? "page" : undefined}><Play size={17} aria-hidden="true"/>Vídeos</Link>
    <Link href={`${base}/releases`} aria-current={pathname === `${base}/releases` ? "page" : undefined}><FileClock size={17} aria-hidden="true"/>Releases</Link>
  </nav>;
}
