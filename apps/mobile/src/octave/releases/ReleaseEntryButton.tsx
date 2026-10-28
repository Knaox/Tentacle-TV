/**
 * Octave mobile — l'entrée « Importer » d'une SORTIE, à droite du grand titre de la Bibliothèque (onglet Albums).
 * Sans le point `releases` de l'extension (ou sans source déclarée) : rien, aucune trace.
 */

import { memo } from "react";
import { useTranslation } from "react-i18next";
import { releaseSourcesOf } from "@tentacle-tv/api-client";
import { GlassTextButton } from "../playlists/screens/BarButtons";
import { useOctavePagesProvider } from "../pages/env/pagesEnv";
import { openReleaseSheet } from "./releaseSheetStore";

export const ReleaseEntryButton = memo(function ReleaseEntryButton() {
  const { t } = useTranslation("musicReleases");
  if (releaseSourcesOf(useOctavePagesProvider()).length === 0) return null;
  return <GlassTextButton label={t("entryShort")} onPress={() => openReleaseSheet()} />;
});
