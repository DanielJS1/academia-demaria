import { Knowledge } from "@/components/knowledge";
export default async function Page({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const { aba } = await searchParams;
  return <Knowledge initialTab={aba === "anotacoes" ? "anotacoes" : undefined} />;
}
