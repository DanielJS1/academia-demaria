import { headers } from "next/headers";
import { VideoGallery } from "@/components/kb/video-gallery";
import { channelVideos } from "@/lib/kb/channel-videos";
import { kbRobots } from "@/lib/kb/host";
export const dynamic = "force-dynamic";
export async function generateMetadata() { return { title: "Vídeos da DeMaria", robots: kbRobots((await headers()).get("host")) }; }
export default async function Page() { return <VideoGallery {...await channelVideos()}/>; }
