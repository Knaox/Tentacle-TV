import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

let _backendRoot = "";
let _tokenOverride: string | null = null;

export function setPreferencesBackendUrl(url: string) {
  _backendRoot = url.replace(/\/$/, "");
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

/**
 * Un appel authentifié vers le backend Tentacle (chemin absolu `/api/...`),
 * avec la même base et le même jeton que les préférences — réutilisé par les
 * segments de lecture et les réglages, qui vivent sous d'autres préfixes.
 */
export async function tentacleApiFetch<T>(apiPath: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...getAuthHeader(),
    ...(init?.headers as Record<string, string>),
  };
  if (init?.body) headers["Content-Type"] = "application/json";
  const hasToken = !!(_tokenOverride || (typeof localStorage !== "undefined" && localStorage.getItem("tentacle_token")));
  const res = await fetch(`${_backendRoot}${apiPath}`, { ...init, headers, credentials: hasToken ? undefined : "include" });
  if (!res.ok) {
    const msg = await res.text().catch(() => `${res.status}`);
    throw new Error(msg);
  }
  return res.json();
}

async function prefFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return tentacleApiFetch<T>(`/api/preferences${path}`, init);
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

/**
 * Langues retenues pour UN contenu — un film, un épisode.
 *
 * Sa propre table côté serveur, et sa propre clé de cache : elle bat la
 * préférence de saison, de série et de bibliothèque au moment de résoudre les
 * pistes, mais elle ne doit surtout pas se mêler à la liste des préférences de
 * bibliothèque, que la page Préférences et le cache hors ligne lisent en entier.
 */
export interface ItemTrackPreference {
  id: string;
  jellyfinUserId: string;
  itemId: string;
  audioLang: string | null;
  subtitleLang: string | null;
  subtitleMode: "none" | "always" | "forced" | "signs";
}

export interface TrackResolution {
  audioIndex: number | null;
  subtitleIndex: number | null;
}

// ---------- Hooks ----------

export function useLibraryPreferences(options?: { enabled?: boolean }) {
  const hasToken = !!_tokenOverride
    || (typeof localStorage !== "undefined" && !!(localStorage.getItem("tentacle_token") || localStorage.getItem("tentacle_user")));

  return useQuery({
    queryKey: ["library-preferences"],
    queryFn: () => prefFetch<LibraryPreference[]>("/"),
    enabled: hasToken && (options?.enabled ?? true),
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
    onSuccess: (_data, libraryId) => {
      // Écraser le cache de la query unitaire : son refetch post-suppression
      // renvoie 404 et TanStack v5 CONSERVE l'ancien data sur une erreur —
      // sans ça, `checked = !!data` (case « Appliquer à cette série ») reste
      // vrai à jamais et la case ne peut plus être décochée.
      qc.setQueryData(["library-preferences", libraryId], null);
      qc.invalidateQueries({ queryKey: ["library-preferences"], exact: true });
    },
  });
}

export function useResolveMediaTracks() {
  return useMutation({
    mutationFn: async (data: {
      libraryId: string;
      libraryIds?: string[];
      /** Contenu en cours : sa préférence propre bat toutes les autres. */
      itemId?: string;
      audioTracks: Array<{ index: number; language?: string; isDefault?: boolean; title?: string }>;
      subtitleTracks: Array<{ index: number; language?: string; isForced?: boolean; title?: string }>;
    }) => prefFetch<TrackResolution>("/resolve", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  });
}

// ---------- Langues retenues par contenu ----------

export function useItemTrackPreference(itemId: string | undefined) {
  return useQuery({
    queryKey: ["item-track-preference", itemId],
    queryFn: () => prefFetch<ItemTrackPreference>(`/item/${itemId}`),
    enabled: !!itemId,
    staleTime: 5 * 60_000,
    // 404 = aucune préférence pour ce contenu. C'est un état normal, pas une
    // panne : inutile de le réessayer.
    retry: false,
  });
}

export function useSetItemTrackPreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      itemId: string;
      audioLang?: string | null;
      subtitleLang?: string | null;
      subtitleMode?: "none" | "always" | "forced" | "signs";
    }) => prefFetch<ItemTrackPreference>("/item", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
    // Le cache de CE contenu est écrit directement, sans invalidation : la
    // sauvegarde est silencieuse et se produit en pleine lecture — un refetch
    // n'apprendrait rien de plus que ce qu'on vient d'écrire.
    onSuccess: (pref) => {
      qc.setQueryData(["item-track-preference", pref.itemId], pref);
    },
  });
}

export function useDeleteItemTrackPreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => prefFetch(`/item/${itemId}`, { method: "DELETE" }),
    // Même parade que pour les préférences de bibliothèque : TanStack v5
    // CONSERVE l'ancien `data` quand le refetch échoue, et ici il échoue par
    // construction (404 après suppression).
    onSuccess: (_data, itemId) => {
      qc.setQueryData(["item-track-preference", itemId], null);
    },
  });
}

// ---------- Interface language (synced across devices) ----------

/** Fetch the user's stored interface language from backend */
export function useInterfaceLanguage() {
  const hasToken = !!_tokenOverride
    || (typeof localStorage !== "undefined" && !!(localStorage.getItem("tentacle_token") || localStorage.getItem("tentacle_user")));
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
    const headers: Record<string, string> = {};
    if (token !== "__cookie__") {
      headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(`${_backendRoot}/api/preferences/language`, {
      headers,
      credentials: token === "__cookie__" ? "include" : undefined,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.language ?? null;
  } catch {
    return null;
  }
}
