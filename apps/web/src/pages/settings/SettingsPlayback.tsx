import { PageTransition } from "../../components/PageTransition";
import { DataSaverSetting } from "../../components/settings/DataSaverSetting";
import { HardwareDecodingSelect } from "../../components/settings/HardwareDecodingSelect";
import { HdrAutoToggle } from "../../components/settings/HdrAutoToggle";
import { LinuxSessionSelect } from "../../components/settings/LinuxSessionSelect";
import { PlaybackSettingsSection, UpNextSetting } from "../../components/settings/PlaybackSettingsSection";
import { StillWatchingSetting } from "../../components/settings/StillWatchingSetting";
import { AdvancedSettings } from "../../components/settings/wide/AdvancedFold";
import { WideGroup } from "../../components/settings/wide/WideGroup";

/**
 * Réglages › Lecture, rangée par INTENTION (refonte de nov. 2026) :
 *
 *   Intros, résumés et génériques  — le mode (trois tuiles) · Avancé : passage par passage
 *   D'un épisode à l'autre         — l'épisode suivant · « Vous regardez encore ? »
 *   Connexion                      — l'économie de données
 *   Vidéo sur cet ordinateur       — HDR (Windows) · Avancé : décodage, session graphique (Linux)
 *
 * Une ligne par réglage, sa portée sur le titre du groupe ; ce qu'on ne règle presque jamais
 * est replié sous « Avancé » — nommé là, trouvé par la recherche, jamais retiré. Les langues ont
 * leur rubrique (`SettingsLanguages`) ; chaque groupe, chaque ligne vient du catalogue.
 */
export function SettingsPlayback() {
  return (
    <PageTransition>
      <div className="max-w-3xl">
        <WideGroup section="playback" group="player">
          <PlaybackSettingsSection />
        </WideGroup>
        <WideGroup section="playback" group="nextEpisode">
          <UpNextSetting />
          {/* « Vous regardez encore ? » — seulement si le serveur le sait faire. */}
          <StillWatchingSetting />
        </WideGroup>
        <WideGroup section="playback" group="data">
          <DataSaverSetting />
        </WideGroup>
        {/* Bureau seulement, réglages d'APPAREIL : c'est son pilote et son écran qui décident. */}
        <WideGroup section="playback" group="video">
          <HdrAutoToggle />
          <AdvancedSettings settings={["hardwareDecoding", "linuxSession"]}>
            <HardwareDecodingSelect />
            <LinuxSessionSelect />
          </AdvancedSettings>
        </WideGroup>
      </div>
    </PageTransition>
  );
}
