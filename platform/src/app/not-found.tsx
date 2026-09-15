import Link from "next/link";
export default function NotFound() { return <section className="empty-state"><span className="eyebrow">UM NOVO CAMINHO</span><h1>Esta página não foi encontrada.</h1><p style={{ marginTop: 12 }}>Volte ao início para continuar sua jornada.</p><Link className="button button-primary" href="/">Ir para o início</Link></section>; }
