import { useTranslation } from "react-i18next";
import { BackIcon } from "../../PlayerIcons";
import { GlassSurface } from "./GlassSurface";

interface GlassTopBarProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  isDirectPlay: boolean;
  goBack: () => void;
}

/**
 * Le haut du lecteur en verre : UNE capsule, la sortie et le titre — l'élément
 * de barre d'outils de macOS 26, plutôt qu'un bandeau assombri pleine largeur.
 *
 * Le dégradé noir de l'habillage d'avant n'a plus lieu d'être : c'est le verre
 * qui détache le texte, et rien ne voile plus l'image hors de la capsule.
 */
export function GlassTopBar({ visible, title, subtitle, isDirectPlay, goBack }: GlassTopBarProps) {
  const { t } = useTranslation("player");
  return (
    <div className="lgp-top" onClick={(e) => e.stopPropagation()}>
      <GlassSurface className="lgp-topbar lgp-morph lgp-morph--top" present={visible}>
        <div className="lgp-content lgp-topbar__inner">
          <button type="button" onClick={() => goBack()} className="lgp-btn" aria-label={t("player:back")} title={t("player:back")}>
            <BackIcon />
          </button>
          <div className="lgp-topbar__titles">
            <h2 className="lgp-title truncate">{title}</h2>
            {subtitle && <p className="lgp-subtitle truncate">{subtitle}</p>}
          </div>
        </div>
      </GlassSurface>
      {/* Le témoin de développement, comme dans l'habillage d'avant. */}
      {import.meta.env.DEV && (
        <div className={`lgp-devbadge ${visible ? "" : "opacity-0"}`}>
          mpv{isDirectPlay ? "" : " (transcode)"}
        </div>
      )}
    </div>
  );
}
