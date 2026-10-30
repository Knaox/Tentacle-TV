/**
 * Octave — l'entrée « Hors ligne » de la navigation (lot fl, 30/10 : le choix de Damien, à la place de « Sur cet
 * appareil »), qui ouvre la vue « Sur cet appareil ». Rien sans la porte du hors ligne (compte de l'appareil, droit
 * `keepOffline`, jamais une session de profil : `useOfflineSurface`). Une PASTILLE rose discrète sur l'icône tant que
 * des titres partent (`keptTransfersRunning`) ; le lecteur d'écran l'entend (« transferts en cours »), jamais la
 * couleur seule. Elle s'éteint d'elle-même quand tout est arrivé.
 */

import { useSyncExternalStore } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { keptTransfersRunning } from "@tentacle-tv/offline-core/music";
import { DownloadGlyph } from "../../../downloads/DownloadGlyph";
import { octavePaths } from "../octavePaths";
import { keptMusicState, subscribeKeptMusic } from "./keptMusicStore";
import { useOfflineSurface } from "./offlineSurfaceContext";

const readRunning = () => keptTransfersRunning(keptMusicState().tracks);

/** Des titres partent : un booléen, l'entrée ne se redessine qu'à la bascule (pas à chaque progression). */
function useTransfersRunning(): boolean {
  return useSyncExternalStore(subscribeKeptMusic, readRunning, readRunning);
}

function OfflineIcon({ running, className }: { running: boolean; className: string }) {
  return (
    <span className="relative inline-flex shrink-0">
      <DownloadGlyph done={false} className={className} />
      {running ? (
        <span
          data-octave-offline-badge
          aria-hidden
          className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-octave-accent"
        />
      ) : null}
    </span>
  );
}

export function DeviceNavItem({ className, iconClassName = "h-5 w-5" }: { className: string; iconClassName?: string }) {
  const { t } = useTranslation("music");
  const surface = useOfflineSurface();
  if (!surface.visible) return null;
  return <DeviceNavLink className={className} iconClassName={iconClassName} label={t("nav.offline")} busyLabel={t("nav.offlineBusy")} />;
}

/** Monté derrière la porte seulement : sans le droit, la liste gardée n'est même pas écoutée. */
function DeviceNavLink({ className, iconClassName, label, busyLabel }: { className: string; iconClassName: string; label: string; busyLabel: string }) {
  const running = useTransfersRunning();
  return (
    <li>
      <NavLink to={octavePaths.device} className={className} aria-label={running ? busyLabel : undefined}>
        <OfflineIcon running={running} className={`octave-nav-icon ${iconClassName}`} />
        <span className="max-w-full truncate">{label}</span>
      </NavLink>
    </li>
  );
}

/** L'entrée « Hors ligne » de l'en-tête du téléphone (ses onglets n'ont pas la place) : l'icône seule, nommée. */
export function DeviceHeaderButton() {
  const { t } = useTranslation("music");
  const surface = useOfflineSurface();
  if (!surface.visible) return null;
  return <HeaderLink label={t("nav.offline")} busyLabel={t("nav.offlineBusy")} />;
}

function HeaderLink({ label, busyLabel }: { label: string; busyLabel: string }) {
  const running = useTransfersRunning();
  const name = running ? busyLabel : label;
  return (
    <NavLink
      to={octavePaths.device}
      aria-label={name}
      title={name}
      className={({ isActive }) =>
        `octave-touch flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${isActive ? "text-octave-accent-text" : "text-content-secondary"}`
      }
    >
      <OfflineIcon running={running} className="h-5 w-5" />
    </NavLink>
  );
}
