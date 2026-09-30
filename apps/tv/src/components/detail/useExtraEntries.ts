import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useItemExtras, type ExtrasOwner } from "@tentacle-tv/api-client";
import { buildExtraEntries, sortTrailersByLang, type ExtraEntry, type RichTrailer } from "@tentacle-tv/shared";

/**
 * Les tuiles « Extras » d'un titre — film, série, saison ou épisode : ses
 * extras locaux (bandes-annonces, bonus), puis ses vidéos distantes triées par
 * langue, dans l'ordre de toutes les plateformes (`buildExtraEntries`).
 * Partagé par la fiche actuelle (Android TV) et la fiche refondue (Apple TV).
 */
export function useExtraEntries(owner: ExtrasOwner | undefined, remote: RichTrailer[]): ExtraEntry[] {
  const { t, i18n } = useTranslation("common");
  const { local } = useItemExtras(owner);
  return useMemo(
    () => (owner ? buildExtraEntries(t, local, sortTrailersByLang(remote, i18n.language)) : []),
    [owner, t, local, remote, i18n.language],
  );
}
