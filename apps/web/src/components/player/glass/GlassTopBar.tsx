import { useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { BackIcon } from "../../PlayerIcons";
import { GlassOrb } from "./GlassOrb";
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
 * Le haut du lecteur en verre, façon tvOS 26 (lot lg8) : le ROND de la sortie
 * (une forme de verre, le pivot du haut) et le titre en TEXTE, posé sur le voile
 * du haut (`GlassScrim`) — plus de capsule autour du titre. Le titre naît et
 * part avec les contrôles (`.lgp-nude`).
 */
export function GlassTopBar({ visible, title, subtitle, isDirectPlay, goBack }: GlassTopBarProps) {
  const { t } = useTranslation("player");
  const [lead, setLead] = useState<HTMLDivElement | null>(null);
  useCollapsePivots(lead);
  return (
    <div className="lgp-top" onClick={(e) => e.stopPropagation()}>
      <div ref={setLead} className="lgp-top__lead">
        <GlassOrb visible={visible} pivot order={2}>
          <button type="button" onClick={() => goBack()} {...GLASS_LENS_PROPS} className="lgp-btn" aria-label={t("player:back")} title={t("player:back")}>
            <BackIcon />
          </button>
        </GlassOrb>
        <div className="lgp-heading lgp-nude" data-lgp-present={visible} style={{ "--lgp-order": 2 } as CSSProperties}>
          <h2 className="lgp-title truncate">{title}</h2>
          {subtitle && <p className="lgp-subtitle truncate">{subtitle}</p>}
        </div>
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
