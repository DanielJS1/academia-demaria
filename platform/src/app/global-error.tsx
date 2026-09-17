"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "sans-serif", margin: 0, padding: 32, background: "#f8fafc", color: "#0f172a" }}>
        <div style={{ maxWidth: 480, margin: "64px auto", padding: 32, background: "#fff", borderRadius: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0" }}>
          <h1 style={{ fontSize: 20, marginBottom: 12 }}>Não foi possível carregar a página</h1>
          <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.5, marginBottom: 20 }}>
            Ocorreu uma instabilidade temporária. Clique no botão abaixo para tentar recarregar.
          </p>
          <button
            onClick={() => reset()}
            style={{ padding: "10px 20px", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
