import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BackIcon } from "../../PlayerIcons";
import { GlassSurface } from "./GlassSurface";
import { useCollapsePivots } from "./useCollapsePivots";
import { GLASS_LENS_PROPS } from "../../../theme/glass";

interface GlassTopBarProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  isDirectPlay: boolean;
  goBack: () => void;
}

/**
 * Le haut du lecteur en verre : deux formes qui flottent, séparées — la
 * PASTILLE de la sortie (un cercle de verre, le pivot du haut) et la capsule du
 * titre. Elles naissent l'une de l'autre : la capsule du titre se replie dans
 * la pastille, s'y fond, et en ressort (`collapse`).
 *
 * Aucun dégradé noir : c'est le verre, et l'ombre douce des libellés, qui les
 * détachent ; rien ne voile plus l'image hors des formes.
 */
export function GlassTopBar({ visible, title, subtitle, isDirectPlay, goBack }: GlassTopBarProps) {
  const { t } = useTranslation("player");
  const [lead, setLead] = useState<HTMLDivElement | null>(null);
  useCollapsePivots(lead);
  return (
    <div className="lgp-top" onClick={(e) => e.stopPropagation()}>
      <div ref={setLead} className="lgp-top__lead">
        <GlassSurface className="lgp-pastille" present={visible} collapse data-lgp-pivot="">
          <div className="lgp-content">
            <button type="button" onClick={() => goBack()} {...GLASS_LENS_PROPS} className="lgp-btn" aria-label={t("player:back")} title={t("player:back")}>
              <BackIcon />
            </button>
          </div>
        </GlassSurface>
        <GlassSurface className="lgp-titlecap" present={visible} collapse>
          <div className="lgp-content lgp-titlecap__inner">
            <h2 className="lgp-title truncate">{title}</h2>
            {subtitle && <p className="lgp-subtitle truncate">{subtitle}</p>}
          </div>
        </GlassSurface>
      </div>
      {/* Le témoin de développement, comme dans l'habillage d'avant. */}
      {import.meta.env.DEV && (
        <div className={`lgp-devbadge ${visible ? "" : "opacity-0"}`}>
          mpv{isDirectPlay ? "" : " (transcode)"}
        </div>
      )}
    </div>
  );
}
