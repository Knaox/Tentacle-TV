import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MediaItem, SharedStatsView, StatsLocale } from "@tentacle-tv/shared";
import { mayShow } from "../rights/accountAbilitiesGate";
import { useAccountAbilities } from "../rights/useAccountAbilities";
import { useServerCapabilities } from "./useServerCapabilities";

/**
 * « Partager ma liste » — hooks du lien de partage.
 * Base `/api/share` (web same-origin) ou URL backend explicite (React Native).
 */

let _backendBase = "/api/share";
let _tokenOverride: string | null = null;

export function setShareLinkBackendUrl(url: string) {
  _backendBase = `${url.replace(/\/$/, "")}/api/share`;
}

export function setShareLinkToken(token: string | null) {
  _tokenOverride = token;
}

function getToken(): string | null {
  return _tokenOverride
    ?? (typeof localStorage !== "undefined" ? localStorage.getItem("tentacle_token") : null);
}

async function shareFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init?.body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${_backendBase}${path}`, {
    ...init,
    headers,
    credentials: token ? undefined : "include",
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => `${res.status}`);
    throw new Error(msg);
  }
  return res.json();
}

export type ShareListKind = "watchlist" | "likes";

/** Préfixe des routes propriétaire selon la liste partagée. */
function kindBase(kind: ShareListKind): string {
  return kind === "likes" ? "/likes" : "";
}

export interface SharedListItem {
  Id: string;
  Name: string;
  Type: string;
  ProductionYear?: number;
  ImageTags?: Record<string, string>;
  /** Affiche TMDB absolue — titres hors bibliothèque (Id vide). */
  PosterUrl?: string;
  InLibrary?: boolean;
}

export interface SharedListData {
  ownerUsername: string;
  kind?: ShareListKind;
  items: SharedListItem[];
}

/**
 * Ce que sert `GET /api/share/:token`, selon le lien : une liste (Ma liste,
 * titres likés ; `kind` absent sur un serveur ancien) ou des statistiques.
 */
export type SharedView = SharedListData | SharedStatsView;

/**
 * Le refus d'une route de partage, par son code : `public_sharing_denied`
 * (créer sans le droit « Partage public »), `share_unavailable` (un lien dont
 * le propriétaire n'a plus ce droit). `null` pour toute autre erreur.
 */
export function shareErrorCode(error: unknown): string | null {
  if (!(error instanceof Error)) return null;
  try {
    const body = JSON.parse(error.message) as { error?: unknown };
    return typeof body.error === "string" ? body.error : null;
  } catch {
    return null;
  }
}

/**
 * Ce compte peut-il partager en public (listes, statistiques) ? Face à un serveur qui
 * déclare `share.publicRight`, son droit « Partage public » de Jellyfin
 * (`GET /api/share/access`) ; face à un serveur d'avant, oui — comme avant.
 * Faux tant que ce n'est pas su : un bouton n'apparaît qu'une fois permis.
 */
export function usePublicSharingAllowed(): boolean {
  const { capabilities, settled } = useServerCapabilities();
  // Ce que le serveur dit de la SESSION (`account.abilities`), relu à `rights:changed`.
  const session = mayShow(useAccountAbilities(), "publicSharing");
  const governed = capabilities.has("share.publicRight");
  const access = useQuery({
    queryKey: ["share", "access"],
    queryFn: () => shareFetch<{ publicSharing: boolean }>("/access"),
    enabled: governed,
    staleTime: 30_000,
  });
  return session && publicSharingAllowed(settled, governed, access.data?.publicSharing);
}

/** La règle, pure : rien tant que la configuration n'a pas répondu ; sans la capacité, comme avant. */
export function publicSharingAllowed(settled: boolean, governed: boolean, access: boolean | undefined): boolean {
  if (!settled) return false;
  return governed ? access === true : true;
}

/** Crée (ou récupère) mon lien de partage — watchlist par défaut, `likes`
 *  pour la liste des titres likés (favoris + hors bibliothèque). Un refus
 *  du droit relit `access` : le bouton disparaît. */
export function useCreateShareLink(kind: ShareListKind = "watchlist") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => shareFetch<{ token: string }>(`${kindBase(kind)}/`, { method: "POST" }),
    onError: (error) => {
      if (shareErrorCode(error) === "public_sharing_denied") void qc.invalidateQueries({ queryKey: ["share", "access"] });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["share", "mine", kind] }),
  });
}

/** État de mon lien (token ou null). */
export function useMyShareLink(enabled = true, kind: ShareListKind = "watchlist") {
  return useQuery({
    queryKey: ["share", "mine", kind],
    queryFn: () => shareFetch<{ token: string | null }>(`${kindBase(kind)}/mine`),
    enabled,
    staleTime: 30_000,
  });
}

/** Révoque mon lien. */
export function useRevokeShareLink(kind: ShareListKind = "watchlist") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => shareFetch<{ ok: boolean }>(`${kindBase(kind)}/`, { method: "DELETE" }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["share", "mine", kind] }),
  });
}

/**
 * Vue PUBLIQUE d'un partage, dans la langue du visiteur : les statistiques
 * nomment genres et pays côté serveur. Changer de langue garde la page à
 * l'écran le temps de la réponse.
 */
export function useSharedView(token: string | null | undefined, lang: StatsLocale) {
  return useQuery({
    queryKey: ["share", "view", token, lang],
    queryFn: () => shareFetch<SharedView>(`/${token}?lang=${lang}`),
    enabled: !!token,
    staleTime: 30_000,
    // Le même partage dans l'autre langue, jamais un autre partage.
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[2] === token ? previous : undefined),
    retry: false,
  });
}

/** Détail PUBLIC d'un média de la liste partagée (résumé + bandes-annonces). */
export function useSharedItem(token: string | null | undefined, itemId: string | null | undefined) {
  return useQuery({
    queryKey: ["share", "item", token, itemId],
    queryFn: () => shareFetch<MediaItem>(`/${token}/item/${itemId}`),
    enabled: !!token && !!itemId,
    staleTime: 60_000,
    retry: false,
  });
}
