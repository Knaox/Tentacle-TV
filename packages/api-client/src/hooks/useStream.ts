import { useMemo } from "react";
import { useJellyfinClient } from "./useJellyfinClient";

export interface StreamOptions {
  mediaSourceId?: string;
  audioIndex?: number;
  subtitleIndex?: number;
  maxBitrate?: number;
  directPlay?: boolean;
  startTimeTicks?: number;
}

export function useStream(itemId: string | undefined, options?: StreamOptions) {
  const client = useJellyfinClient();

  const streamUrl = useMemo(() => {
    if (!itemId) return null;
    return client.getStreamUrl(itemId, options);
  }, [client, itemId, options?.mediaSourceId, options?.audioIndex, options?.subtitleIndex, options?.maxBitrate, options?.directPlay, options?.startTimeTicks]); // eslint-disable-line react-hooks/exhaustive-deps

  return { streamUrl };
}
