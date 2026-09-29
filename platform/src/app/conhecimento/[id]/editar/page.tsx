import { ArticleEditor } from "@/components/editors/article-editor";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sugerir?: string; proposta?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  return <ArticleEditor id={id} suggest={query.sugerir === "1"} proposalId={query.proposta} />;
}
