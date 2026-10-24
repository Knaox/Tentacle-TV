/**
 * Octave — l'entrée du mode dans l'application vidéo, et la bascule de
 * l'accueil quand le mode est allumé (comme le mode hors ligne remplace
 * l'accueil par le catalogue local).
 *
 * Invisible sans `music.library` ou sans bibliothèque musique pour ce compte.
 */

import { lazy, type ReactElement } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { OctaveLogo } from "../components/OctaveLogo";
import { OCTAVE_BASE_PATH, setOctaveMode, useOctaveMode } from "./octaveMode";
import { useOctaveAvailability } from "./useOctaveAvailability";

/** Le mode entier, chargé à la demande : rien n'est téléchargé avant d'y entrer. */
export const LazyOctaveApp = lazy(() => import("../OctaveApp"));

/** Le bouton de la barre : « Octave », icône et mot. */
export function OctaveEntryButton({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation("music");
  const navigate = useNavigate();
  const { available } = useOctaveAvailability();
  if (!available) return null;
  return (
    <button
      type="button"
      onClick={() => {
        setOctaveMode(true);
        navigate(OCTAVE_BASE_PATH);
      }}
      onPointerEnter={() => void import("../OctaveApp")}
      aria-label={t("mode.enterHint")}
      title={t("mode.enterHint")}
      className="relative flex h-9 min-w-9 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full px-2 text-sm font-semibold text-content-secondary transition-colors duration-150 hover:bg-fill-soft hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
    >
      <OctaveLogo size={22} mono />
      {!compact && <span className="hidden xl:inline">{t("mode.enter")}</span>}
    </button>
  );
}

/**
 * L'accueil quand le mode est allumé : Octave. Rien tant que la disponibilité
 * n'est pas connue (aucun accueil vidéo qui clignote avant la bascule) ; sans
 * musique, l'accueil d'avant.
 */
export function OctaveHomeSwitch({ home, enabled }: { home: ReactElement; enabled: boolean }) {
  const on = useOctaveMode();
  const { available, settled } = useOctaveAvailability(on && enabled);
  if (!on || !enabled) return home;
  if (!settled) return null;
  return available ? <Navigate to={OCTAVE_BASE_PATH} replace /> : home;
}
