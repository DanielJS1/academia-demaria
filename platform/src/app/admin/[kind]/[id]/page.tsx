import { ResourceEditor } from "@/components/editors";
export default async function Page({ params }: { params: Promise<{ kind: string; id: string }> }) { const { kind, id } = await params; return <ResourceEditor kind={kind} id={id}/>; }
