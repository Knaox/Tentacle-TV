import { useMemo } from "react";
import { useJellyfinClient } from "./useJellyfinClient";

export function useStream(itemId: string | undefined) {
  const client = useJellyfinClient();

  const streamUrl = useMemo(() => {
    if (!itemId) return null;
    return client.getStreamUrl(itemId);
  }, [client, itemId]);

  return { streamUrl };
}
