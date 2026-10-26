/**
 * Octave — Réglages › Apparence, le groupe « Octave » : l'apparence du mode musique, réglée À PART de celle de
 * Tentacle, sur cet appareil (Damien, 26/10) — les champs d'`OctaveAppearanceFields`, les mêmes que la page
 * « Réglages d'Octave » (`/octave/settings`), vers laquelle le groupe renvoie :
 *
 * - « Apparence d'Octave » : Comme Tentacle (défaut) · Clair · Sombre — appliquée quand Octave est affiché ;
 * - « Liquid Glass dans Octave » : seulement là où le verre natif existe (bureau, macOS 26) — jamais au web.
 *
 * N'existe qu'avec Octave (`useOctaveAvailability` : musique, « Accès à Octave ») ; ouvert à `#octave`, il se
 * place sous les yeux.
 */

import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import { SettingsSection } from "@tentacle-tv/ui";
import { octavePaths } from "../octavePaths";
import { useOctaveAvailability } from "../mode/useOctaveAvailability";
import { OctaveAppearanceFields } from "./OctaveAppearanceFields";

/** L'ancre du groupe. */
export const OCTAVE_APPEARANCE_ANCHOR = "octave";

/** Les deux interrupteurs Liquid Glass se montrent ensemble : celui de Tentacle se nomme alors « dans Tentacle ». */
export function useTentacleGlassLabel(): string | null {
  const { t } = useTranslation("octaveShell");
  const { available } = useOctaveAvailability();
  return available ? t("appearance.tentacleGlass") : null;
}

export function OctaveAppearanceSettings() {
  const { t } = useTranslation("octaveShell");
  const { available } = useOctaveAvailability();
  const anchor = useRef<HTMLDivElement>(null);
  const { hash } = useLocation();

  useEffect(() => {
    if (available && hash === `#${OCTAVE_APPEARANCE_ANCHOR}`) anchor.current?.scrollIntoView({ block: "start" });
  }, [available, hash]);

  if (!available) return null;
  return (
    <div ref={anchor} id={OCTAVE_APPEARANCE_ANCHOR} className="scroll-mt-6" data-octave-appearance>
      <SettingsSection title={t("appearance.title")} caption={t("appearance.caption")}>
        <OctaveAppearanceFields last={false} />
        {/* Les mêmes réglages, DANS Octave : on y voit l'effet en direct. */}
        <Link
          to={octavePaths.settings}
          className="flex min-h-[48px] items-center justify-between gap-3 border-t border-line-subtle px-5 text-sm font-medium text-content-primary transition-colors duration-150 hover:bg-fill-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-line-focus"
        >
          {t("settings.open")}
          <ChevronRight size={16} aria-hidden className="text-content-tertiary" />
        </Link>
      </SettingsSection>
    </div>
  );
}
