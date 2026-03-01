import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createRequest } from "../api/seer-client";
import type { MediaType } from "../api/types";

interface RequestMediaPayload {
  mediaType: MediaType;
  tmdbId: number;
  title: string;
  posterPath?: string;
  seasons?: number[];
}

export function useRequestMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RequestMediaPayload) => createRequest(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seer-my-requests"] });
    },
  });
}
