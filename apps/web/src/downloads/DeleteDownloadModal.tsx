/**
 * Confirmation de suppression d'un téléchargement — familles danger-*,
 * animation CSS pure. La suppression retire le claim de CE compte ; le
 * fichier n'est réellement effacé du disque qu'au dernier claim (dédup).
 */

import { GlassButton } from "../components/ui/glass/GlassButton";
import { useTranslation } from "react-i18next";
import { OfflineSheetFrame } from "./OfflineSheetFrame";

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

  // Le cadre : la feuille de `Modal` en verre natif, celui d'avant ailleurs
  // (portail dans les deux cas : `OfflineSheetFrame`).
  return (
    <OfflineSheetFrame label={header} onClose={onClose} role="alertdialog" width="sm" legacyLayer="z-[210]">
      <div className="px-5 py-4">
        <h2 className="text-base font-bold text-content-primary">{header}</h2>
        {title && (
          <p className="mt-1 truncate text-sm font-semibold text-content-secondary">{title}</p>
        )}
        <p className="mt-2 text-xs leading-relaxed text-content-tertiary">
          {message ?? t("downloads:deleteConfirmMessage")}
        </p>
      </div>
      <div className="flex justify-end gap-2 border-t border-line-subtle px-5 py-3.5">
        <GlassButton
          inSurface
          onClick={onClose}
          appearance={{ level: "regular", shape: "capsule" }}
          className="px-4 py-2 text-sm font-semibold"
          fallbackClassName="rounded-md bg-cta-ghost-bg text-content-secondary transition-colors duration-150 hover:bg-cta-ghost-bg-hover"
        >
          {t("common:cancel")}
        </GlassButton>
        <GlassButton
          inSurface
          danger
          onClick={onConfirm}
          disabled={busy}
          appearance={{ level: "regular", shape: "capsule" }}
          className="px-4 py-2 text-sm font-bold disabled:opacity-50"
          fallbackClassName="lg-shape-capsule rounded-md border border-danger-border bg-danger-surface text-status-error-fg transition-colors duration-150 hover:bg-danger-surface-hover"
        >
          {t("downloads:deleteConfirm")}
        </GlassButton>
      </div>
    </OfflineSheetFrame>
  );
}
