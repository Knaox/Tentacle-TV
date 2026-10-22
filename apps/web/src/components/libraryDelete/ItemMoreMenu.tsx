import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MoreHorizontal, Trash2 } from "lucide-react";
import type { MediaItem } from "@tentacle-tv/shared";
import { Dropdown } from "../ui/Dropdown";
import { CapsuleButton, DetailCapsule } from "../detail/DetailActionCapsule";
import { useItemDeletion } from "./useItemDeletion";

/**
 * « ⋯ » au bout de la rangée d'actions de la fiche — le menu des gestes rares.
 * Aujourd'hui un seul : « Supprimer de la bibliothèque » (film, série, épisode),
 * présent seulement si Jellyfin laisse CE compte supprimer CE titre ; sans lui,
 * le bouton n'existe pas. Jamais sur le plateau des cartes.
 *
 * Après la suppression, la fiche d'un titre qui n'existe plus ramène en arrière
 * (à l'accueil si l'on y est arrivé directement).
 */
export function ItemMoreMenu({ item }: { item: MediaItem }) {
  const { t } = useTranslation("libraryDelete");
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const leave = useCallback(() => {
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (index > 0) navigate(-1);
    else navigate("/", { replace: true });
  }, [navigate]);
  const deletion = useItemDeletion({ id: item.Id, type: item.Type }, (summary) => {
    if (summary.removed.includes(item.Id)) leave();
  });

  // Le dialogue garde SA place dans l'arbre, que le bouton soit là ou non : le titre
  // supprimé n'est plus supprimable, et un dialogue remonté repartirait de zéro
  // au lieu de montrer son bilan.
  return (
    <>
      {deletion.allowed && (
        <div className="relative">
          <DetailCapsule>
            <CapsuleButton active={open} onClick={() => setOpen((v) => !v)} label={t("moreActions")}>
              <MoreHorizontal className="h-5 w-5" strokeWidth={2} aria-hidden />
            </CapsuleButton>
          </DetailCapsule>
          <Dropdown open={open} onClose={() => setOpen(false)} placement="bottom-start" minWidth={240}>
            <div role="menu" aria-label={t("moreActions")} className="py-1.5">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  deletion.open();
                }}
                className="lg-row-danger flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-[var(--status-error-fg)] transition-colors duration-150 hover:bg-danger-surface focus-visible:bg-danger-surface focus-visible:outline-none"
              >
                <Trash2 className="h-4 w-4 shrink-0" strokeWidth={2.2} aria-hidden />
                {t("deleteFromLibrary")}
              </button>
            </div>
          </Dropdown>
        </div>
      )}
      {deletion.dialog}
    </>
  );
}
