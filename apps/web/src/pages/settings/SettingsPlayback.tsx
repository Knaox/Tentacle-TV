import { PageTransition } from "../../components/PageTransition";
import { DataSaverSetting } from "../../components/settings/DataSaverSetting";
import { HardwareDecodingSelect } from "../../components/settings/HardwareDecodingSelect";
import { HdrAutoToggle } from "../../components/settings/HdrAutoToggle";
import { LinuxSessionSelect } from "../../components/settings/LinuxSessionSelect";
import { PlaybackSettingsSection } from "../../components/settings/PlaybackSettingsSection";
import { StillWatchingSetting } from "../../components/settings/StillWatchingSetting";
import { WideGroup } from "../../components/settings/wide/WideGroup";

/**
 * Réglages › Lecture — ce que le lecteur fait tout seul (sauts, épisode
 * suivant, pause automatique), ce que la lecture consomme (économie de
 * données), et, sur l'app de bureau, la vidéo de CET ordinateur (décodage,
 * HDR, session graphique de Linux). Les langues ont leur rubrique
 * (`SettingsLanguages`) ; chaque groupe, chaque ligne vient du catalogue.
 */
export function SettingsPlayback() {
  return (
    <PageTransition>
      <div className="max-w-2xl">
        <WideGroup section="playback" group="player">
          <PlaybackSettingsSection />
        </WideGroup>
        {/* « Vous regardez encore ? » — compte, seulement si le serveur le sait faire. */}
        <WideGroup section="playback" group="stillWatching">
          <StillWatchingSetting />
        </WideGroup>
        <WideGroup section="playback" group="data">
          <DataSaverSetting />
        </WideGroup>
        {/* Bureau seulement, réglages d'APPAREIL : c'est son pilote et son écran qui décident. */}
        <WideGroup section="playback" group="video">
          <HardwareDecodingSelect />
          <HdrAutoToggle />
          <LinuxSessionSelect />
        </WideGroup>
      </div>
    </PageTransition>
  );
}
