import { LiveRoom } from "@/components/live/live-room";
export const metadata = { title: "Aula ao vivo" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LiveRoom key={id} id={id} />;
}
