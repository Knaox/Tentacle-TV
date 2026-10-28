/**
 * Octave (mobile) — la première moitié des Réglages d'Octave : ce qui ne touche QUE la musique (pastille
 * « Octave seulement »), dans l'ordre du bureau (`apps/web/src/music/octave/settings/OctaveSettingsView.tsx`) :
 * l’apparence, la transition douce, « Hors ligne » (en tête quand l’application l’est : « Retester la connexion », la tenue à jour des playlists gardées), puis « ne pas demander le code PIN
 * au démarrage » (mobile seulement). Chaque ligne écrit le réglage de l'appareil (`../octaveSettings.ts`).
 */

import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useServerCapability } from "@tentacle-tv/api-client";
import type { OctaveTheme } from "@tentacle-tv/shared/octave";
import { SettingsChoiceRow, SettingsSection } from "@/components/settings";
import { useAccountKeepRight, useOfflineProfileSession } from "@/offline/rights/useOfflineOwner";
import { useOfflineMode } from "@/offline/useOfflineMode";
import { useThemeMode } from "@/theme";
import { octaveAutoSync, octaveLiquidGlass, octaveSkipLaunchPin, octaveTheme } from "../octaveSettings";
import { autoSyncRowShown } from "../settingsRights";
import { CrossfadeRows } from "./CrossfadeRows";
import { RetestConnectionRow } from "./RetestConnectionRow";
import { SwitchRow } from "./SwitchRow";

export const OctaveOnlySettings = memo(function OctaveOnlySettings() {
  const { t } = useTranslation(["octaveShell", "musicOffline"]);
  // Hors ligne, la section « Hors ligne » (et son « Retester la connexion ») passe en tête : c'est ce qu'on vient y chercher.
  const offline = useOfflineMode();
  return (
    <>
      {offline && <OfflineSection />}
      <SettingsSection title={t("octaveShell:settings.appearance")} caption={t("octaveShell:appearance.caption")}>
        <AppearanceRows />
      </SettingsSection>
      <SettingsSection title={t("octaveShell:crossfade.section")} caption={t("octaveShell:crossfade.caption")}>
        <CrossfadeRows />
      </SettingsSection>
      {!offline && <OfflineSection />}
      <SettingsSection title={t("octaveShell:settings.startup")}>
        <SwitchRow
          icon="unlock"
          label={t("octaveShell:launchPin.label")}
          description={t("octaveShell:launchPin.hint")}
          value={octaveSkipLaunchPin.use()}
          onChange={octaveSkipLaunchPin.set}
          last
        />
      </SettingsSection>
    </>
  );
});

/** Les lignes de l'apparence d'Octave : aussi posées sur place dans le hub « Compte ». */
export function AppearanceRows() {
  const { t } = useTranslation("octaveShell");
  const { liquidGlass } = useThemeMode();
  const theme = octaveTheme.use();
  const glass = octaveLiquidGlass.use();
  const options = useMemo<{ value: OctaveTheme; label: string }[]>(
    () => [
      { value: "same", label: t("appearance.themeSame") },
      { value: "light", label: t("appearance.themeLight") },
      { value: "dark", label: t("appearance.themeDark") },
    ],
    [t],
  );
  return (
    <>
      <SettingsChoiceRow
        icon="sun"
        label={t("appearance.theme")}
        options={options}
        value={theme}
        onChange={(value) => octaveTheme.set(value as OctaveTheme)}
        scope="octave"
        last={!liquidGlass.supported}
      />
      {/* Le verre natif n'existe que sur iOS 26 : ailleurs, ni ligne ni trace. */}
      {liquidGlass.supported && (
        <SwitchRow icon="droplet" label={t("appearance.glass")} value={glass} onChange={octaveLiquidGlass.set} last />
      )}
    </>
  );
}

/**
 * « Hors ligne » : hors ligne, « Retester la connexion » (`RetestConnectionRow`) ; puis la tenue à jour, comme sur
 * le bureau, seulement pour le compte de l'appareil qui peut garder de la musique (`settingsRights.ts` : capacité
 * `offline.music`, jamais une session de profil, droit `keepOffline` du compte). Ni l'une ni l'autre : pas de section.
 */
function OfflineSection() {
  const { t } = useTranslation("musicOffline");
  const capable = useServerCapability("offline.music");
  const profileSession = useOfflineProfileSession();
  const keepRight = useAccountKeepRight();
  const offline = useOfflineMode();
  const on = octaveAutoSync.use();
  const autoSync = autoSyncRowShown({ capable, profileSession, keepRight });
  if (!autoSync && !offline) return null;
  return (
    <SettingsSection title={t("autosync.section")} caption={t("autosync.caption")}>
      <RetestConnectionRow last={!autoSync} />
      {autoSync && <SwitchRow icon="refresh-cw" label={t("autosync.label")} description={t("autosync.hint")} value={on} onChange={octaveAutoSync.set} last />}
    </SettingsSection>
  );
}
