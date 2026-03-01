import { useQuery } from "@tanstack/react-query";
import { discoverMedia } from "../api/seer-client";
import type { DiscoverCategory } from "../api/types";

export function useDiscoverMedia(category: DiscoverCategory, page = 1) {
  return useQuery({
    queryKey: ["seer-discover", category, page],
    queryFn: () => discoverMedia(category, page),
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });
}
