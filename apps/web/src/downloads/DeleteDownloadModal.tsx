/**
 * Confirmation de suppression d'un téléchargement — familles danger-*,
 * animation CSS pure. La suppression retire le claim de CE compte ; le
 * fichier n'est réellement effacé du disque qu'au dernier claim (dédup).
 */

import { GlassButton } from "../components/ui/glass/GlassButton";
import { useTranslation } from "react-i18next";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { SHEET_BUTTON_LAYOUT } from "./DownloadDialogParts";
import { OfflineSheetFrame } from "./OfflineSheetFrame";
import { useSheetExit } from "./ui/useSheetExit";

interface DeleteDownloadModalProps {
  /** Ce qui va partir. Omis quand l'en-tête le dit déjà (suppression groupée). */
  title?: string;
  /** Remplace l'en-tête « Supprimer ce téléchargement ? ». */
  heading?: string;
  /** Remplace l'explication sous le titre. */
  message?: string;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteDownloadModal({
  title, heading, message, busy, onConfirm, onClose,
}: DeleteDownloadModalProps) {
  const { t } = useTranslation(["downloads", "common"]);
  const header = heading ?? t("downloads:deleteConfirmTitle");

  const exit = useSheetExit(onClose);

  // Le cadre : la feuille du socle, en portail (`OfflineSheetFrame`).
  return (
    <OfflineSheetFrame label={header} open={exit.open} onClose={exit.close} role="alertdialog" width="sm">
      <div className="flex flex-col gap-2 px-6 pb-5 pt-6">
        <h2 className="font-display text-heading-3 text-content-primary">{header}</h2>
        {title && <p className="truncate text-sm font-semibold text-content-secondary">{title}</p>}
        <p className="text-[13px] leading-relaxed text-content-tertiary">
          {message ?? t("downloads:deleteConfirmMessage")}
        </p>
      </div>
      <div className="lg-sep flex flex-wrap justify-end gap-2 border-t border-line-subtle px-6 pb-5 pt-4">
        <GlassButton
          inSurface
          onClick={exit.close}
          // Une confirmation destructive : le focus arrive sur « Annuler ».
          data-sheet-focus
          appearance={{ level: "regular", shape: "capsule" }}
          className={SHEET_BUTTON_LAYOUT}
          fallbackClassName="btn btn-ghost"
        >
          {t("common:cancel")}
        </GlassButton>
        <GlassButton
          inSurface
          danger
          onClick={onConfirm}
          disabled={busy}
          appearance={{ level: "regular", shape: "capsule" }}
          className={`${SHEET_BUTTON_LAYOUT} disabled:opacity-45`}
          fallbackClassName="lg-shape-capsule btn btn-danger"
        >
          <TrashIcon size={16} aria-hidden />
          {t("downloads:deleteConfirm")}
        </GlassButton>
      </div>
    </OfflineSheetFrame>
  );
}
