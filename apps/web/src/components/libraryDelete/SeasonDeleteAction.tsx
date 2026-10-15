import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import { useItemDeletion } from "./useItemDeletion";

/**
 * « Supprimer la saison » — au bout de la barre de la saison affichée, à l'écart
 * des autres gestes (marquer vu, sélectionner) : une saison n'a pas de fiche à
 * elle. Absent si Jellyfin ne laisse pas CE compte supprimer CETTE saison. Elle
 * emporte ses épisodes et leurs fichiers ; la confirmation le dit.
 */
export function SeasonDeleteAction({ seasonId, seasonName }: { seasonId: string | undefined; seasonName: string | undefined }) {
  const { t } = useTranslation("libraryDelete");
  const deletion = useItemDeletion({ id: seasonId, type: "Season", name: seasonName });
  // Le dialogue garde SA place, bouton ou non : la saison supprimée n'est plus
  // supprimable, et un dialogue remonté perdrait son bilan.
  return (
    <>
      {deletion.allowed && (
        <button
          type="button"
          onClick={deletion.open}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--status-error-fg)] transition-colors hover:bg-danger-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--border-focus)]"
        >
          <Trash2 className="h-4 w-4" strokeWidth={2.2} aria-hidden />
          {t("deleteSeason")}
        </button>
      )}
      {deletion.dialog}
    </>
  );
}
