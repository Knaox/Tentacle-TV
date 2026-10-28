/**
 * Octave — l'ENTRÉE « Importer une sortie » : en tête de la Bibliothèque. Sans le point `releases` de
 * l'extension (ou sans source déclarée), rien : aucune trace.
 */

import { DiscAlbum } from "lucide-react";
import { useTranslation } from "react-i18next";
import { releaseSourcesOf } from "@tentacle-tv/api-client";
import { useOctaveProvider } from "../mode/useOctaveProvider";
import { openReleaseDialog } from "./releaseDialogStore";

const PILL =
  "flex h-10 cursor-pointer items-center gap-2 rounded-full border border-line-subtle px-4 text-sm font-semibold text-content-primary transition-colors duration-150 hover:bg-octave-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

export function ReleaseEntryButton({ className = "" }: { className?: string }) {
  const { t } = useTranslation("musicReleases");
  const sources = releaseSourcesOf(useOctaveProvider());
  if (sources.length === 0) return null;
  return (
    <button type="button" onClick={() => openReleaseDialog()} className={`${PILL} ${className}`} title={t("entry")}>
      <DiscAlbum className="h-4 w-4" aria-hidden />
      {t("entry")}
    </button>
  );
}
