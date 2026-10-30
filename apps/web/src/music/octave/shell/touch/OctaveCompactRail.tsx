/**
 * Octave — le RAIL de la tablette en portrait : la barre latérale du bureau
 * resserrée en une colonne d'icônes LIBELLÉES (le rail du miroir sur l'iPad),
 * pour laisser sa largeur à la page. En tête la note d'Octave et la bascule du
 * mode ; les cinq destinations, « Hors ligne » s'il y a lieu ; en pied
 * les réglages d'Octave et le profil. Les playlists vivent dans leur onglet.
 * Cibles de 56 px au moins : on y vise au doigt.
 */

import { memo } from "react";
import { Settings2 } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { OctaveLogo } from "../../components/OctaveLogo";
import { octavePaths } from "../../octavePaths";
import { DeviceNavItem } from "../../offline/DeviceNavItem";
import { OctaveProfileButton } from "../../profiles";
import { OctaveModeSlot } from "../OctaveModeSlot";
import { OCTAVE_DESTINATIONS } from "../OctaveSidebar";

const itemClass =
  "octave-nav-link octave-rail-item octave-touch flex min-h-[56px] w-full flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-semibold leading-tight text-content-tertiary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

export const OctaveCompactRail = memo(function OctaveCompactRail({ onExit }: { onExit: () => void }) {
  const { t } = useTranslation(["music", "octaveShell"]);
  return (
    <nav
      aria-label={t("nav.main")}
      data-octave-rail="compact"
      className="flex h-full w-[var(--oc-rail-compact-width)] shrink-0 flex-col items-center gap-3 pb-3 pl-[max(8px,env(safe-area-inset-left,0px))] pr-2 pt-[max(16px,env(safe-area-inset-top,0px))]"
    >
      <OctaveLogo size={34} />
      <OctaveModeSlot onExit={onExit} rail />
      <ul className="octave-rail-destinations mt-2 flex w-full flex-col gap-1">
        {OCTAVE_DESTINATIONS.map(({ to, key, Icon, end }) => (
          <li key={to}>
            <NavLink to={to} end={end} className={itemClass}>
              <Icon className="octave-nav-icon h-6 w-6" strokeWidth={1.9} aria-hidden />
              <span className="max-w-full truncate">{t(key)}</span>
            </NavLink>
          </li>
        ))}
        <DeviceNavItem className={itemClass} iconClassName="h-6 w-6" />
      </ul>
      <div className="flex-1" />
      <NavLink to={octavePaths.settings} className={itemClass} aria-label={t("octaveShell:settings.nav")}>
        <Settings2 className="octave-nav-icon h-6 w-6" strokeWidth={1.9} aria-hidden />
      </NavLink>
      <OctaveProfileButton compact menu="beside" />
    </nav>
  );
});
