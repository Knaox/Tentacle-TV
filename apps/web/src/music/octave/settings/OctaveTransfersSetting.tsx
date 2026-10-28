/**
 * Octave — Réglages d'Octave › « Transferts » (bureau) : « Continuer en arrière-plan », LE réglage de
 * Réglages › Téléchargements (même source, `backgroundTransfersStore`, jamais une copie) : fermer la fenêtre
 * laisse finir les titres en route. Pour qui peut garder de la musique (`useOfflineSurface().library`), dans
 * une coquille qui sait le faire ; ailleurs, rien.
 */

import type { ReactNode } from "react";
import { SettingsSection } from "@tentacle-tv/ui";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../../../components/settings/ToggleSwitch";
import { setBackgroundTransfers, useBackgroundTransfers } from "../../../downloads/backgroundTransfersStore";
import { useOfflineSurface } from "../offline/offlineSurfaceContext";

export function OctaveTransfersSetting({ badge }: { badge?: ReactNode }) {
  const { t } = useTranslation("settingsWeb");
  const surface = useOfflineSurface();
  const on = useBackgroundTransfers();
  if (!surface.library || on === null) return null;
  return (
    <SettingsSection title={t("groups.downloads.transfers")} badge={badge}>
      <div className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-content-primary">{t("entries.downloadsBackground.label")}</p>
          <p className="mt-1 text-xs leading-relaxed text-content-tertiary">{t("entries.downloadsBackground.description")}</p>
        </div>
        <ToggleSwitch checked={on} onChange={(next) => void setBackgroundTransfers(next)} label={t("entries.downloadsBackground.label")} />
      </div>
    </SettingsSection>
  );
}
