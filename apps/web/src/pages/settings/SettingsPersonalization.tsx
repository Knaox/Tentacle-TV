import { PageTransition } from "../../components/PageTransition";
import { TrailerPreviewSetting } from "../../components/settings/TrailerPreviewSetting";
import { HomeLayoutGroups } from "../../components/settings/personalization/HomeLayoutGroups";
import { RecoSettingsGroup } from "../../components/settings/personalization/RecoSettingsGroup";
import { WideGroup } from "../../components/settings/wide/WideGroup";
import { settingAnchor } from "../../components/settings/wide/wideSettingsMeta";
import { OctaveStartupSetting } from "../../music/octave/mode/OctaveStartupSetting";
import { useOfflineMode } from "../../offline/useOfflineMode";

/**
 * Réglages › Accueil et découverte (l'ancienne « Personnalisation ») : ce que
 * l'application ouvre, ce que l'accueil montre, comment les cartes réagissent
 * au survol, et ce que les recommandations ont le droit d'utiliser — dans cet
 * ordre, du plus visible au plus fin.
 *
 * Hors ligne, il ne reste que ce qui vit sur l'appareil (le démarrage
 * d'Octave) : le bandeau, les rangées et les recommandations sont tenus par
 * le serveur, leurs groupes ne se montent pas (aucune requête).
 */
export function SettingsPersonalization() {
  const offline = useOfflineMode();
  return (
    <PageTransition>
      <div className="max-w-2xl">
        {/* « Au démarrage, ouvrir » d'Octave : son propre groupe titré, posé tel quel. */}
        <WideGroup section="personalization" group="startup" untitled>
          <div {...settingAnchor("octaveStartup")} className="scroll-mt-24">
            <OctaveStartupSetting />
          </div>
        </WideGroup>
        {!offline && <HomeLayoutGroups />}
        <WideGroup section="personalization" group="previews">
          <TrailerPreviewSetting />
        </WideGroup>
        {!offline && <RecoSettingsGroup />}
      </div>
    </PageTransition>
  );
}
