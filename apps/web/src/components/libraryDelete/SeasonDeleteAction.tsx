import { useTranslation } from "react-i18next";
import { TrashIcon as Trash2 } from "@phosphor-icons/react/dist/csr/Trash";
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
          // Discrète au repos (la pilule sans peau), rouge de bout en bout : c'est une suppression.
          className="btn btn-ghost btn-sm lg-glass-btn lg-glass-danger text-[var(--status-error-fg)] hover:bg-danger-surface hover:text-[var(--status-error-fg)]"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          {t("deleteSeason")}
        </button>
      )}
      {deletion.dialog}
    </>
  );
}
