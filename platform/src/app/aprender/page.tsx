import { Catalog } from "@/components/catalog";
export default async function Page({ searchParams }: { searchParams: Promise<{ busca?: string }> }) { const query = await searchParams; return <Catalog key={query.busca || "catalog"} initialSearch={query.busca}/>; }
