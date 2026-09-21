import { ArticleEditor } from "@/components/editors/article-editor";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ArticleEditor id={id} />;
}
