import { useTranslation } from "react-i18next";
import { SettingsSection } from "@tentacle-tv/ui";
import { useOwnPlaybackSettings } from "@tentacle-tv/api-client";
import { detectPreset } from "@tentacle-tv/shared";
import { PlaybackAdvancedPanel } from "./PlaybackAdvancedPanel";
import { PlaybackPresetPicker } from "./PlaybackPresetPicker";
import { SettingsDisclosure } from "./SettingsDisclosure";

/**
 * Tout ce que le lecteur a le droit de faire tout seul, en un seul endroit.
 *
 * Deux étages, et cet ordre-là compte : le MODE — le lecteur propose, ou il
 * fait — puis, replié, le réglage fin. Les vingt contrôles d'avant étaient
 * tous justifiés pris un par un ; ensemble ils formaient un tableau de bord
 * qu'il fallait traverser pour dire « passe-moi les intros ».
 *
 * Ces choix suivent le COMPTE (`playback_settings` côté serveur, cache local
 * pour le hors ligne) : ce qu'on règle ici se retrouve sur le mobile et sur le
 * téléviseur, qui n'en montrent que le mode.
 */
export function PlaybackSettingsSection() {
  const { t } = useTranslation("preferences");
  // Les réglages PROPRES : dans un groupe Watch Together, ceux de l'hôte
  // gouvernent la lecture, mais ce sont bien les siens qu'on règle ici.
  const settings = useOwnPlaybackSettings();
  // Ouvert d'emblée si les réglages ne correspondent à aucun mode : quelqu'un
  // a déjà réglé finement, lui cacher son propre travail serait absurde.
  const advancedOpen = detectPreset(settings) === "custom";

  return (
    <SettingsSection title={t("playbackModeTitle")}>
      <div className="p-5">
        <p className="text-xs leading-relaxed text-content-quaternary">
          {t("playbackSettingsAccount")}
        </p>

        <div className="mt-4">
          <PlaybackPresetPicker settings={settings} />
        </div>

        <div className="mt-6 border-t border-line-subtle pt-5">
          <SettingsDisclosure title={t("playbackAdvancedToggle")} defaultOpen={advancedOpen}>
            <PlaybackAdvancedPanel settings={settings} />
          </SettingsDisclosure>
        </div>
      </div>
    </SettingsSection>
  );
}
