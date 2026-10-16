import { Knowledge } from "@/components/knowledge";
export default async function Page({ searchParams }: { searchParams: Promise<{ aba?: string; busca?: string; tipo?: string; pagina?: string; material?: string }> }) {
  const { aba, busca, tipo, pagina, material } = await searchParams;
  return <Knowledge initialTab={aba === "anotacoes" || aba === "biblioteca" || aba === "consulta" || aba === "materiais" ? aba : undefined}
    initialSearch={typeof busca === "string" ? busca : ""} initialSource={typeof tipo === "string" ? tipo : undefined}
    initialPage={Number(pagina)} initialMaterialId={typeof material === "string" ? material : undefined} />;
}
