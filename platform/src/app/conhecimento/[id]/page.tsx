import { CommunityArticle } from "@/components/community/community-article";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CommunityArticle id={id} />;
}

