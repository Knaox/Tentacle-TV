/** Octave — l'entrée « Sur cet appareil » de la barre latérale (bureau, avec le droit, ou de la musique déjà gardée). */

import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DownloadGlyph } from "../../../downloads/DownloadGlyph";
import { octavePaths } from "../octavePaths";
import { useOfflineSurface } from "./offlineSurfaceContext";

export function DeviceNavItem({ className }: { className: string }) {
  const { t } = useTranslation("musicOffline");
  const surface = useOfflineSurface();
  if (!surface.visible) return null;
  return (
    <li>
      <NavLink to={octavePaths.device} className={className}>
        <DownloadGlyph done={false} className="octave-nav-icon h-5 w-5" />
        {t("onDevice")}
      </NavLink>
    </li>
  );
}
