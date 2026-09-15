import { Classroom } from "@/components/classroom";
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aula?: string; previa?: string }> }) { const { id } = await params; const query = await searchParams; return <Classroom id={id} initialLesson={query.aula} preview={query.previa === "1"}/>; }
