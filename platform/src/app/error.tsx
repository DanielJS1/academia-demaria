"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <section className="panel" style={{ padding: 32 }}><h1>Não foi possível abrir esta tela</h1><p>Seus dados salvos no navegador permanecem disponíveis. Tente carregar novamente.</p><button className="btn" onClick={reset}>Tentar novamente</button></section>;
}
