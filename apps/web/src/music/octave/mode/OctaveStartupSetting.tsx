/**
 * Octave — Réglages › Personnalisation : « Au démarrage, ouvrir ». Trois
 * choix visibles d'un coup (dernier mode utilisé, Octave, Tentacle), gardés
 * sur CET appareil (`octaveStartupStore.ts`) ; effet au prochain lancement.
 *
 * N'existe qu'avec la musique (`useOctaveAvailability`) : sans Octave, ni
 * réglage ni trace.
 */

import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { SettingsSection } from "@tentacle-tv/ui";
import { SegmentedChoice } from "../../../components/settings/SegmentedChoice";
import type { OctaveStartupChoice } from "./octaveStartup";
import { setOctaveStartup, useOctaveStartup } from "./octaveStartupStore";
import { useOctaveAvailability } from "./useOctaveAvailability";

/**
 * `title` / `caption` : la page « Réglages d'Octave » la range sous son propre titre (« Démarrage ») ; `badge` : la
 * pastille de portée (« Cet appareil »), à côté du titre.
 */
export function OctaveStartupSetting({ title, caption, badge }: { title?: string; caption?: string; badge?: ReactNode } = {}) {
  const { t } = useTranslation("music");
  const { available } = useOctaveAvailability();
  const choice = useOctaveStartup();
  const options = useMemo<ReadonlyArray<{ value: OctaveStartupChoice; label: string }>>(
    () => [
      { value: "last", label: t("mode.startupLast") },
      { value: "octave", label: t("mode.startupOctave") },
      { value: "tentacle", label: t("mode.startupTentacle") },
    ],
    [t],
  );
  if (!available) return null;

  return (
    <SettingsSection title={title ?? t("mode.startupTitle")} caption={caption ?? t("mode.startupCaption")} badge={badge}>
      <div className="p-5">
        <p className="mb-2 text-sm font-medium text-content-primary">{t("mode.startupLabel")}</p>
        <SegmentedChoice label={t("mode.startupLabel")} value={choice} options={options} onChange={setOctaveStartup} />
        <p className="mt-2 text-xs leading-relaxed text-content-tertiary">{t("mode.startupHint")}</p>
      </div>
    </SettingsSection>
  );
}
