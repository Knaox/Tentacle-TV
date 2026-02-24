import { useParams } from "react-router-dom";
import { useMediaItem, useStream } from "@tentacle/api-client";
import { VideoPlayer } from "../components/VideoPlayer";

export function Watch() {
  const { itemId } = useParams<{ itemId: string }>();
  const { data: item, isLoading } = useMediaItem(itemId);
  const { streamUrl } = useStream(itemId);

  if (isLoading || !streamUrl) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-tentacle-accent border-t-transparent" />
      </div>
    );
  }

  const title = item?.Type === "Episode"
    ? item.SeriesName ?? item.Name
    : item?.Name ?? "Lecture en cours";

  const subtitle = item?.Type === "Episode"
    ? `S${item.ParentIndexNumber}E${item.IndexNumber} — ${item.Name}`
    : undefined;

  return <VideoPlayer src={streamUrl} title={title} subtitle={subtitle} />;
}
