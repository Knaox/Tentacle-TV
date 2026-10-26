/**
 * Octave — les ENTRÉES de l'import : à côté de « Nouvelle playlist » (page
 * Playlists, et son état vide) et dans l'en-tête « Vos playlists » du rail.
 * Sans la capacité `music.playlistImport` : rien, aucune trace.
 */

import { Import } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useServerCapability } from "@tentacle-tv/api-client";
import { openImportDialog } from "./importStore";

const PILL =
  "flex h-10 cursor-pointer items-center gap-2 rounded-full border border-line-subtle px-4 text-sm font-semibold text-content-primary transition-colors duration-150 hover:bg-octave-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

const RAIL =
  "flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-content-tertiary transition-colors duration-150 hover:bg-octave-hover hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

export function ImportEntryButton({ variant = "pill", className = "" }: { variant?: "pill" | "rail"; className?: string }) {
  const { t } = useTranslation("musicImport");
  const available = useServerCapability("music.playlistImport");
  if (!available) return null;
  if (variant === "rail") {
    return (
      <button type="button" onClick={openImportDialog} className={`${RAIL} ${className}`} aria-label={t("entry")} title={t("entry")}>
        <Import className="h-4 w-4" aria-hidden />
      </button>
    );
  }
  return (
    <button type="button" onClick={openImportDialog} className={`${PILL} ${className}`}>
      <Import className="h-4 w-4" aria-hidden />
      {t("entryShort")}
    </button>
  );
}
