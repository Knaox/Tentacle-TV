import { useTranslation } from "react-i18next";
import { useOwnPlaybackSettings } from "@tentacle-tv/api-client";
import { detectPreset } from "@tentacle-tv/shared";
import { SkipPassagesPanel, UpNextPanel } from "./PlaybackAdvancedPanel";
import { PlaybackPresetPicker } from "./PlaybackPresetPicker";
import { SettingsDisclosure } from "./SettingsDisclosure";
import { SettingItem } from "./wide/SettingItem";
import { useSettingTargeted } from "./wide/wideSettingsMeta";

/**
 * Tout ce que le lecteur a le droit de faire tout seul — trois lignes de la
 * carte « Sauts et enchaînement » : le MODE (le lecteur propose, ou il fait),
 * puis les passages un par un et l'épisode suivant, chacun replié derrière
 * « Régler en détail ». Avant, le détail était un repli DANS un repli
 * (« Réglages avancés » › « Passages ») : trois niveaux, au-delà de ce que
 * NN/g conseille (deux au plus).
 *
 * Ces choix suivent le COMPTE (`playback_settings` côté serveur, cache local
 * pour le hors ligne) : la pastille de chaque ligne le dit.
 */
export function PlaybackSettingsSection() {
  const { t } = useTranslation("settingsWeb");
  // Les réglages PROPRES : dans un groupe Watch Together, ceux de l'hôte
  // gouvernent la lecture, mais ce sont bien les siens qu'on règle ici.
  const settings = useOwnPlaybackSettings();
  // Ouvert d'emblée si les réglages ne correspondent à aucun mode (quelqu'un a
  // déjà réglé finement), ou si un lien vise la ligne (la recherche).
  const custom = detectPreset(settings) === "custom";
  const passagesTargeted = useSettingTargeted("skipPassages");
  const upNextTargeted = useSettingTargeted("upNext");

  return (
    <>
      <SettingItem setting="playbackMode">
        <PlaybackPresetPicker settings={settings} />
      </SettingItem>
      <SettingItem setting="skipPassages">
        <SettingsDisclosure key={String(passagesTargeted)} title={t("detailToggle")} defaultOpen={custom || passagesTargeted}>
          <SkipPassagesPanel settings={settings} />
        </SettingsDisclosure>
      </SettingItem>
      <SettingItem setting="upNext">
        <SettingsDisclosure key={String(upNextTargeted)} title={t("detailToggle")} defaultOpen={custom || upNextTargeted}>
          <UpNextPanel settings={settings} />
        </SettingsDisclosure>
      </SettingItem>
    </>
  );
}
