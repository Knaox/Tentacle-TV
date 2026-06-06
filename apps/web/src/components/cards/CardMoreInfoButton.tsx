import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface CardMoreInfoButtonProps {
  /** Id du média à ouvrir dans la page détail (/media/:id). */
  detailId: string;
  /** Carte parente survolée — pilote l'apparition de la pill. */
  visible: boolean;
}

/**
 * Pill « Plus d'infos » discrète, révélée en bas à droite d'une carte au survol.
 *
 * Le clic sur la carte garde son action primaire (lecture directe) : ce bouton
 * stoppe la propagation pour ne PAS la déclencher, puis navigue vers la fiche
 * détaillée du média. Réservé au pointeur (desktop/web), il n'altère pas la
 * cible tactile principale.
 */
export function CardMoreInfoButton({ detailId, visible }: CardMoreInfoButtonProps) {
  const navigate = useNavigate();
  const { t } = useTranslation("common");

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    navigate(`/media/${detailId}`);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={t("common:moreInfo")}
      title={t("common:moreInfo")}
      className="absolute bottom-1.5 right-2 z-10 flex items-center gap-1 rounded-full border border-white/30 bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm transition-all duration-150 hover:border-white hover:bg-black/85"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(4px)",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <InfoIcon className="h-3.5 w-3.5" />
      <span>{t("common:moreInfo")}</span>
    </button>
  );
}

function InfoIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
      />
    </svg>
  );
}
