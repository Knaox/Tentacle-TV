import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { BackIcon } from "../../PlayerIcons";

interface ChromeTopProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  /** Ce qui se pose à droite du titre (le témoin de développement du bureau). */
  children?: ReactNode;
}

/**
 * Le haut de l'habillage : la SORTIE et le titre. Le bouton Retour est le premier élément de
 * l'habillage et ne dépend de rien d'autre — dès que les contrôles se voient, il se voit
 * (règle de la refonte : on ne doit jamais chercher comment sortir du lecteur).
 */
export function ChromeTop({ title, subtitle, onBack, children }: ChromeTopProps) {
  const { t } = useTranslation("player");
  return (
    <div className="pl-bar pl-bar--top" onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={onBack} className="pl-btn pl-btn--solo" aria-label={t("player:back")} title={t("player:back")} data-player-back>
        <BackIcon />
      </button>
      <div className="pl-heading">
        <h2 className="pl-title">{title}</h2>
        {subtitle && <p className="pl-subtitle">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
