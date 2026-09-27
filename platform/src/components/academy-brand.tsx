export function AcademyBrand({ compact = false }: { compact?: boolean }) {
  return <span className={`academy-brand${compact ? " academy-brand--compact" : ""}`}>
    {compact ? <img src="/academia-demaria-symbol.png" alt="" aria-hidden="true" /> : <>
      <img className="academy-brand-image" src="/academia-demaria-logo-dark.png" alt="" aria-hidden="true" />
      <span className="academy-brand-dark"><img src="/academia-demaria-symbol.png" alt="" aria-hidden="true" /><span className="academy-brand-wordmark"><span>Academia</span><strong>DeMaria</strong></span></span>
    </>}
  </span>;
}
