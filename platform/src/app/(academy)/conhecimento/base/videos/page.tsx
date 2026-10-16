import { VideoGallery } from "@/components/kb/video-gallery";
import { channelVideos } from "@/lib/kb/channel-videos";
export default async function Page() { return <VideoGallery {...await channelVideos()}/>; }
