import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

let _backendBase = "/api/preferences";

export function setPreferencesBackendUrl(url: string) {
  _backendBase = `${url.replace(/\/$/, "")}/api/preferences`;
}

function getAuthHeader(): Record<string, string> {
  const token = typeof localStorage !== "undefined"
    ? localStorage.getItem("tentacle_token")
    : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function prefFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${_backendBase}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
      ...(init?.headers as Record<string, string>),
    },
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => `${res.status}`);
    throw new Error(msg);
  }
  return res.json();
}

// ---------- Types ----------

export interface LibraryPreference {
  id: string;
  jellyfinUserId: string;
  libraryId: string;
  audioLang: string | null;
  subtitleLang: string | null;
  subtitleMode: "none" | "always" | "forced" | "signs";
}

export interface TrackResolution {
  audioIndex: number | null;
  subtitleIndex: number | null;
}

// ---------- Hooks ----------

export function useLibraryPreferences() {
  return useQuery({
    queryKey: ["library-preferences"],
    queryFn: () => prefFetch<LibraryPreference[]>("/"),
    staleTime: 5 * 60_000,
  });
}

export function useLibraryPreference(libraryId: string | undefined) {
  return useQuery({
    queryKey: ["library-preferences", libraryId],
    queryFn: () => prefFetch<LibraryPreference>(`/${libraryId}`),
    enabled: !!libraryId,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useSetLibraryPreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      libraryId: string;
      audioLang?: string | null;
      subtitleLang?: string | null;
      subtitleMode?: "none" | "always" | "forced" | "signs";
    }) => prefFetch<LibraryPreference>("/", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["library-preferences"] });
    },
  });
}

export function useDeleteLibraryPreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (libraryId: string) =>
      prefFetch(`/${libraryId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["library-preferences"] });
    },
  });
}

export function useResolveMediaTracks() {
  return useMutation({
    mutationFn: async (data: {
      libraryId: string;
      audioTracks: Array<{ index: number; language?: string; isDefault?: boolean }>;
      subtitleTracks: Array<{ index: number; language?: string; isForced?: boolean; title?: string }>;
    }) => prefFetch<TrackResolution>("/resolve", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  });
}
