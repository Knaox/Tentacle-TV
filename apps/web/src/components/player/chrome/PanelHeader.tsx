import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";

interface PanelHeaderProps {
  title: string;
  onClose: () => void;
  /** Une précision à côté du titre (« sur cet appareil »…). */
  hint?: ReactNode;
}

/**
 * L'en-tête d'un panneau détaché du lecteur : son titre (police des titres) et la croix — une
 * pilule d'icône du socle, plus un « × » de texte. Jetons seulement : dans le panneau de verre
 * (`.lgp-panel`), qui les redéfinit, le même en-tête se peint juste.
 */
export function PanelHeader({ title, onClose, hint }: PanelHeaderProps) {
  const { t } = useTranslation("player");
  return (
    <div className="pl-panel__head">
      <span className="flex min-w-0 items-center gap-2">
        <span className="pl-panel__title truncate">{title}</span>
        {hint}
      </span>
      <button type="button" onClick={onClose} aria-label={t("player:close")} title={t("player:close")} className="icon-btn btn-sm">
        <XIcon size={16} weight="bold" aria-hidden />
      </button>
    </div>
  );
}
