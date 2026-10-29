/**
 * Octave — « Importer » dans une playlist EXISTANTE (sa page) : un album ou des fichiers de l'ordinateur y entrent,
 * à la fin, dans l'ordre. Seulement si le compte peut y ajouter (`canAdd`) et qu'une voie existe.
 */

import { Import } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useImportInto } from "@tentacle-tv/api-client";
import { useOctaveProvider } from "../../mode/useOctaveProvider";
import { openImportDialogInto } from "../importStore";

interface Props {
  playlistId: string;
  name: string;
  canAdd: boolean;
  /** `icon` : le rond de l'en-tête ; `pill` : l'action d'une playlist vide. */
  variant?: "icon" | "pill";
  className?: string;
}

export function ImportIntoButton({ playlistId, name, canAdd, variant = "icon", className = "" }: Props) {
  const { t } = useTranslation("musicImport");
  const into = useImportInto(useOctaveProvider());
  if (!canAdd || (!into.albumAvailable && !into.filesAvailable)) return null;
  const open = () => openImportDialogInto({ playlistId, name });
  const label = t("intoTitle", { name });
  if (variant === "pill") {
    return (
      <button type="button" onClick={open} className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-line-subtle px-4 text-sm font-semibold text-content-primary hover:bg-octave-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${className}`}>
        <Import className="h-4 w-4" aria-hidden />
        {t("entryShort")}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={open}
      aria-label={label}
      title={label}
      className={`flex shrink-0 cursor-pointer items-center justify-center rounded-full text-content-secondary transition-colors duration-150 hover:bg-fill-subtle hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${className}`}
    >
      <Import className="h-5 w-5" aria-hidden />
    </button>
  );
}
