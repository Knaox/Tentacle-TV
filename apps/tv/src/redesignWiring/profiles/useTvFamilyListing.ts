import { useQuery } from "@tanstack/react-query";
import { FAMILY_KEY, fetchTvProfiles, useTentacleConfig } from "@tentacle-tv/api-client";
import type { TvProfilesDto } from "@tentacle-tv/shared";
import { tvSessionMode } from "@tentacle-tv/tv-core";
import { pairingCall } from "../../auth/profileOpening";

/** Les profils changent rarement : relus au plus toutes les cinq minutes, et à chaque changement annoncé. */
const LISTING_STALE_MS = 5 * 60_000;

/** Sous `["family"]` : tout geste de la Famille, et chaque `family:update` (`TVFamilyLive`), la relisent. */
export const TV_FAMILY_LISTING_KEY = [...FAMILY_KEY, "tv-profiles"] as const;

/**
 * La famille de la TV pendant qu'un profil est ouvert (Apple TV, Famille) —
 * « Qui regarde ? » relu par le jeton de JUMELAGE, UNE lecture partagée :
 * l'empilement de « Changer de profil » (rail), et les droits du profil
 * ouvert tels que le serveur les dit maintenant (« peut demander » d'un
 * invité, que la garde de Vigie lit ; le rôle et la gestion de Réglages ›
 * Compte). Relue dès que la famille change, où qu'on soit (`TVFamilyLive`) :
 * un rôle changé sur le bureau s'y voit sans rouvrir le profil. Hors session
 * de profil : null, aucune requête.
 */
export function useTvFamilyListing(): TvProfilesDto | null {
  const { storage } = useTentacleConfig();
  const call = tvSessionMode(storage) === "profile" ? pairingCall(storage) : null;
  const { data } = useQuery({
    queryKey: TV_FAMILY_LISTING_KEY,
    queryFn: ({ signal }) => fetchTvProfiles({ ...(call as NonNullable<typeof call>), signal }),
    enabled: call !== null,
    staleTime: LISTING_STALE_MS,
  });
  return call ? (data ?? null) : null;
}
