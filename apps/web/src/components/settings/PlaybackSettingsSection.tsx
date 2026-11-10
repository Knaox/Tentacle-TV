import { useOwnPlaybackSettings } from "@tentacle-tv/api-client";
import { detectPreset } from "@tentacle-tv/shared";
import { SkipPassagesPanel, UpNextPanel } from "./PlaybackAdvancedPanel";
import { PlaybackPresetPicker } from "./PlaybackPresetPicker";
import { AdvancedSettings } from "./wide/AdvancedFold";
import { SettingItem } from "./wide/SettingItem";
import { useSettingTargeted } from "./wide/wideSettingsMeta";

/**
 * Ce que le lecteur fait des intros, des résumés et des génériques — le groupe
 * « Intros, résumés et génériques » : le MODE d'abord (le lecteur propose, ou
 * il fait : trois tuiles, chacune avec son schéma), puis, sous « Avancé », les
 * passages un par un, chacun avec le vrai bouton du lecteur en aperçu.
 *
 * Ces choix suivent le COMPTE (`playback_settings` côté serveur, cache local
 * pour le hors ligne) : la pastille du groupe le dit.
 */
export function PlaybackSettingsSection() {
  // Les réglages PROPRES : dans un groupe Watch Together, ceux de l'hôte
  // gouvernent la lecture, mais ce sont bien les siens qu'on règle ici.
  const settings = useOwnPlaybackSettings();
  // Ouvert d'emblée si les réglages ne correspondent à aucun mode : quelqu'un a
  // déjà réglé finement, il retrouve ses réglages sans avoir à les chercher.
  const custom = detectPreset(settings) === "custom";

  return (
    <>
      <SettingItem setting="playbackMode">
        <PlaybackPresetPicker settings={settings} />
      </SettingItem>
      <AdvancedSettings settings={["skipPassages"]} defaultOpen={custom}>
        <SettingItem setting="skipPassages">
          <SkipPassagesPanel settings={settings} />
        </SettingItem>
      </AdvancedSettings>
    </>
  );
}

/**
 * « Épisode suivant » — la première ligne du groupe « D'un épisode à l'autre » : la fiche « à
 * suivre », son décompte, l'enchaînement et leur aperçu ; le reste (affiche de fin, déclencheur,
 * règles par bibliothèque) sous son propre « Avancé », ouvert si un lien vise la ligne ou si
 * les réglages ne sont plus ceux d'un mode.
 */
export function UpNextSetting() {
  const settings = useOwnPlaybackSettings();
  const custom = detectPreset(settings) === "custom";
  const targeted = useSettingTargeted("upNext");
  return (
    <SettingItem setting="upNext">
      <UpNextPanel settings={settings} advancedOpen={custom || targeted} />
    </SettingItem>
  );
}
