import { ExternalLink } from "lucide-react";
import { ResourceHero } from "./resource-hero";
const products = [
  { name: "DOC-Windows", logo: "/doc-windows-logo.png", href: "https://www.demaria.com.br/website/listareleases/doc-windows", description: "Novidades, melhorias e correções do DOC-Windows." },
  { name: "DOC-Backup", logo: "/doc-backup-logo.png", href: "https://www.demaria.com.br/website/listareleases/doc-backup", description: "Melhorias e correções do sistema de backup." },
];
export function Releases() {
  return <div className="kb-resource-page"><ResourceHero title="Releases">Confira o que mudou nas versões dos sistemas DeMaria.</ResourceHero><div className="kb-resource-content kb-releases-content"><div className="kb-release-grid">{products.map(product => <a className="kb-product-card" key={product.name} href={product.href} target="_blank" rel="noopener noreferrer">
    <div className="kb-product-logo"><img src={product.logo} alt={`Logo ${product.name}`} width="2134" height="2134"/></div><div className="kb-product-copy"><h2>{product.name}</h2><p>{product.description}</p><span className="kb-release-action">Consultar releases<ExternalLink size={17} aria-hidden="true"/></span><span className="sr-only"> (abre o site oficial em nova aba)</span></div>
  </a>)}</div><p className="kb-release-note">Os releases são consultados no site oficial da DeMaria.</p></div></div>;
}
