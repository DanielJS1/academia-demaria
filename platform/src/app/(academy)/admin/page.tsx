import { Admin } from "@/components/admin";
export default async function Page({ searchParams }: { searchParams: Promise<{ aba?: string }> }) { const query = await searchParams; return <Admin key={query.aba || "cursos"} initialTab={query.aba}/>; }
