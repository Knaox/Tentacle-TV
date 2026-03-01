import { useQuery } from "@tanstack/react-query";
import { searchMedia } from "../api/seer-client";

export function useSeerSearch(query: string, page = 1) {
  return useQuery({
    queryKey: ["seer-search", query, page],
    queryFn: () => searchMedia(query, page),
    enabled: query.length >= 2,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
}
