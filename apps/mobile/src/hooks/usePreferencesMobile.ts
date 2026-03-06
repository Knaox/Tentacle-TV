import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTentacleConfig } from "@tentacle-tv/api-client";

export interface LibraryPreference {
  id: string;
  jellyfinUserId: string;
  libraryId: string;
  audioLang: string | null;
  subtitleLang: string | null;
  subtitleMode: "none" | "always" | "forced" | "signs";
}

function usePrefFetch() {
  const { storage } = useTentacleConfig();
  const serverUrl = storage.getItem("tentacle_server_url") ?? "";
  const token = storage.getItem("tentacle_token") ?? "";

  return async <T>(path: string, init?: RequestInit): Promise<T> => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      ...(init?.headers as Record<string, string>),
    };
    if (init?.body) headers["Content-Type"] = "application/json";
    const res = await fetch(`${serverUrl}/api/preferences${path}`, { ...init, headers });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
  };
}

export function useLibraryPreferencesMobile() {
  const fetcher = usePrefFetch();
  const { storage } = useTentacleConfig();
  const hasToken = !!storage.getItem("tentacle_token");

  return useQuery({
    queryKey: ["library-preferences"],
    queryFn: () => fetcher<LibraryPreference[]>("/"),
    enabled: hasToken,
    staleTime: 5 * 60_000,
  });
}

export function useSetLibraryPreferenceMobile() {
  const qc = useQueryClient();
  const fetcher = usePrefFetch();

  return useMutation({
    mutationFn: (data: {
      libraryId: string;
      audioLang?: string | null;
      subtitleLang?: string | null;
      subtitleMode?: "none" | "always" | "forced" | "signs";
    }) => fetcher<LibraryPreference>("/", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["library-preferences"] }); },
  });
}

export function useDeleteLibraryPreferenceMobile() {
  const qc = useQueryClient();
  const fetcher = usePrefFetch();

  return useMutation({
    mutationFn: (libraryId: string) => fetcher(`/${libraryId}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["library-preferences"] }); },
  });
}
