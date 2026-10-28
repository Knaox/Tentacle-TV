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

/** L'entrée « Sur cet appareil » de l'en-tête du téléphone (ses onglets n'ont pas la place) : l'icône seule, nommée. */
export function DeviceHeaderButton() {
  const { t } = useTranslation("musicOffline");
  const surface = useOfflineSurface();
  if (!surface.visible) return null;
  return (
    <NavLink
      to={octavePaths.device}
      aria-label={t("onDevice")}
      title={t("onDevice")}
      className={({ isActive }) =>
        `octave-touch flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${isActive ? "text-octave-accent-text" : "text-content-secondary"}`
      }
    >
      <DownloadGlyph done={false} className="h-5 w-5" />
    </NavLink>
  );
}
