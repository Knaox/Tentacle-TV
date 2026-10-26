/**
 * « Tenir à jour les playlists gardées sur cet appareil » — l'interrupteur, à
 * deux endroits : Réglages d'Octave (`section`) et « Sur cet appareil »
 * (`inline`). Un réglage de l'APPAREIL, allumé par défaut ; absent sans le droit
 * de garder (`keepRules.ts` : ni le web, ni une session de profil, ni un compte
 * sans `keepOffline`).
 */

import { SettingsSection } from "@tentacle-tv/ui";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../../../../components/settings/ToggleSwitch";
import { useOfflineSurface } from "../offlineSurfaceContext";
import { setAutoSync, useAutoSync } from "./autoSyncStore";

function Row() {
  const { t } = useTranslation("musicOffline");
  const on = useAutoSync();
  return (
    <div className="flex items-start justify-between gap-4 p-5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-content-primary">{t("autosync.label")}</p>
        <p className="mt-1 text-xs leading-relaxed text-content-tertiary">{t("autosync.hint")}</p>
      </div>
      <ToggleSwitch checked={on} onChange={setAutoSync} label={t("autosync.label")} />
    </div>
  );
}

export function AutoSyncSetting({ variant }: { variant: "section" | "inline" }) {
  const { t } = useTranslation("musicOffline");
  const surface = useOfflineSurface();
  if (!surface.library) return null;
  if (variant === "section") {
    return (
      <SettingsSection title={t("autosync.section")} caption={t("autosync.caption")}>
        <Row />
      </SettingsSection>
    );
  }
  return (
    <div className="mx-2 rounded-xl border border-octave-line bg-octave-hover">
      <Row />
    </div>
  );
}
