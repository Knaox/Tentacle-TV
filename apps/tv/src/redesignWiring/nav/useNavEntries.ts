import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useJellyfinClient, useLibraries, useTentacleConfig, useUserId } from "@tentacle-tv/api-client";
import type { IconName } from "../../redesign/icons/Icon";
import type { NavEntry, NavRailProps } from "../../redesign/nav/NavRail";
import { useRailPinning } from "../../components/nav/railPinning";

/**
 * Ce que la navigation refondue propose, dans l'ordre où on la parcourt — les
 * MÊMES entrées que le rail actuel (`railEntries.tsx`), sur le même magasin
 * d'épinglage (partagé avec la LG) : Rechercher à part, en tête ; Accueil,
 * Pour vous, Ma liste, Favoris, chaque bibliothèque ; « Tout afficher » dès
 * qu'une entrée est masquée ; en bas, le compte et ses réglages.
 *
 * Masquables (appui long) : tout sauf Rechercher, Accueil, Tout afficher et
 * le compte — la navigation ne doit jamais devenir une impasse.
 */

export const SHOW_ALL_KEY = "RailShowAll";

const HIDEABLE_FIXED = new Set(["Recommendations", "Watchlist", "Favorites"]);

/** Une entrée qu'un appui long peut retirer. */
export function isHideableEntry(key: string): boolean {
  return HIDEABLE_FIXED.has(key) || key.startsWith("Library_");
}

function libraryIcon(collectionType?: string): IconName {
  switch (collectionType?.toLowerCase()) {
    case "movies":
      return "film";
    case "tvshows":
      return "tv";
    default:
      return "layers";
  }
}

/** Le nom du compte jumelé (`tentacle_user`), ou rien. */
function storedUserName(raw: string | null): string {
  try {
    const name = (JSON.parse(raw ?? "{}") as { Name?: unknown }).Name;
    return typeof name === "string" ? name : "";
  } catch {
    return "";
  }
}

/**
 * Le portrait du compte : seulement s'il existe (`PrimaryImageTag`) — une
 * adresse à l'aveugle laisserait un rond vide, là où l'initiale se lit.
 * Une requête par session : le profil ne change pas sous nos pieds.
 */
function useAccountAvatar(): string | undefined {
  const client = useJellyfinClient();
  const userId = useUserId();
  const { data: tag } = useQuery({
    queryKey: ["tv-account-avatar", userId],
    queryFn: () => client.fetch<{ PrimaryImageTag?: string }>(`/Users/${userId}`).then((user) => user.PrimaryImageTag ?? null),
    enabled: !!userId,
    staleTime: 30 * 60 * 1000,
  });
  if (!userId || !tag) return undefined;
  return `${client.getBaseUrl()}/Users/${userId}/Images/Primary?tag=${tag}&maxWidth=96&quality=90`;
}

export type NavEntries = Pick<NavRailProps, "search" | "entries" | "account" | "hint">;

export function useNavEntries(): NavEntries {
  const { t } = useTranslation("nav");
  const { storage } = useTentacleConfig();
  const { data: libraries } = useLibraries();
  const pinning = useRailPinning();
  const avatarUri = useAccountAvatar();
  const userName = storedUserName(storage.getItem("tentacle_user"));

  return useMemo(() => {
    const entries: NavEntry[] = [{ key: "Home", label: t("home"), icon: "home" }];
    const optional: NavEntry[] = [
      { key: "Recommendations", label: t("forYou"), icon: "sparkles" },
      { key: "Watchlist", label: t("myList"), icon: "bookmark" },
      { key: "Favorites", label: t("common:myFavorites"), icon: "heart" },
      ...(libraries ?? []).map((library): NavEntry => ({
        key: `Library_${library.Id}`,
        label: library.Name,
        icon: libraryIcon(library.CollectionType),
      })),
    ];
    for (const entry of optional) if (!pinning.isHidden(entry.key)) entries.push(entry);
    if (pinning.masquees.length > 0) entries.push({ key: SHOW_ALL_KEY, label: t("railShowAll"), icon: "eye" });
    return {
      search: { key: "Search", label: t("search"), icon: "search" },
      entries,
      account: {
        key: "Settings",
        label: t("preferences"),
        avatarUri,
        initial: userName ? userName.charAt(0).toUpperCase() : undefined,
      },
      hint: t("railHint"),
    };
  }, [t, libraries, pinning, avatarUri, userName]);
}
