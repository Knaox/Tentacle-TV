import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

let _backendBase = "/api/preferences";
let _tokenOverride: string | null = null;

export function setPreferencesBackendUrl(url: string) {
  _backendBase = `${url.replace(/\/$/, "")}/api/preferences`;
}

/** Set auth token for non-web platforms (React Native) where localStorage is unavailable. */
export function setPreferencesToken(token: string | null) {
  _tokenOverride = token;
}

function getAuthHeader(): Record<string, string> {
  const token = _tokenOverride
    ?? (typeof localStorage !== "undefined" ? localStorage.getItem("tentacle_token") : null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function prefFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...getAuthHeader(),
    ...(init?.headers as Record<string, string>),
  };
  if (init?.body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${_backendBase}${path}`, { ...init, headers });
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
  const hasToken = typeof localStorage !== "undefined" && !!localStorage.getItem("tentacle_token");

  return useQuery({
    queryKey: ["library-preferences"],
    queryFn: () => prefFetch<LibraryPreference[]>("/"),
    enabled: hasToken,
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
      libraryIds?: string[];
      audioTracks: Array<{ index: number; language?: string; isDefault?: boolean; title?: string }>;
      subtitleTracks: Array<{ index: number; language?: string; isForced?: boolean; title?: string }>;
    }) => prefFetch<TrackResolution>("/resolve", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  });
}

// ---------- Interface language (synced across devices) ----------

/** Fetch the user's stored interface language from backend */
export function useInterfaceLanguage() {
  const hasToken = typeof localStorage !== "undefined"
    ? !!localStorage.getItem("tentacle_token")
    : true; // TV always has token via storage adapter
  return useQuery({
    queryKey: ["interface-language"],
    queryFn: () => prefFetch<{ language: string | null }>("/language"),
    enabled: hasToken,
    staleTime: 60_000,
  });
}

/** Save the user's interface language to backend */
export function useSetInterfaceLanguage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (language: string) =>
      prefFetch<{ language: string }>("/language", {
        method: "PUT",
        body: JSON.stringify({ language }),
      }),
    onSuccess: (data) => {
      qc.setQueryData(["interface-language"], data);
    },
  });
}

/** Direct fetch for interface language (for non-hook contexts like TV App.tsx) */
export async function fetchInterfaceLanguage(token: string): Promise<string | null> {
  try {
    const res = await fetch(`${_backendBase}/language`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.language ?? null;
  } catch {
    return null;
  }
}
