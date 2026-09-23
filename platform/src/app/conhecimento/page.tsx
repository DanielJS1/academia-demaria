import { Knowledge } from "@/components/knowledge";
export default async function Page({ searchParams }: { searchParams: Promise<{ aba?: string; busca?: string }> }) {
  const { aba, busca } = await searchParams;
  return <Knowledge initialTab={aba === "anotacoes" || aba === "biblioteca" || aba === "consulta" ? aba : undefined} initialSearch={busca || ""} />;
}
