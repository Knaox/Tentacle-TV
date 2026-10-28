/**
 * Octave — « Réglages d'Octave », une page DANS Octave (`/octave/settings`, Damien, 26/10 : « sinon on retourne dans
 * le mode films et séries alors qu'Octave est activé ») : la coquille reste, la surface affichée reste Octave — le
 * thème et le Liquid Glass d'Octave s'appliquent pendant qu'on les règle, on voit l'effet en direct.
 *
 * Chaque groupe dit ce qu'il touche (`ScopeBadge`, la pastille commune), en deux temps :
 *
 * - **Octave seulement** — ce que Tentacle ne voit pas : l'apparence d'Octave (le thème clair d'Octave ne change
 *   rien à Tentacle), la transition douce, la tenue à jour des playlists gardées ;
 * - **aussi dans Tentacle** — les réglages de Tentacle qui ont du sens dans la musique, et ceux-là seulement : la
 *   langue de l'interface et les profils (le COMPTE : tous ses appareils), « Au démarrage, ouvrir » (CET appareil,
 *   la pastille qu'il porte partout par défaut), « Continuer en arrière-plan » (CET appareil, bureau). Les films (lecture vidéo, sous-titres, accueil, recommandations…) n'y sont pas.
 *
 * Les MÊMES réglages que Réglages de Tentacle, jamais une copie : chaque groupe est le composant que Tentacle monte
 * (ou son geste unique : `useInterfaceLanguage`), branché sur la même source. Aucune donnée chargée ici, ni de films
 * ni de musique (les profils lisent la liste déjà en cache du menu).
 */

import { useTranslation } from "react-i18next";
import { SettingsSection } from "@tentacle-tv/ui";
import { ScopeBadge } from "../../../components/settings/ScopeBadge";
import { OctaveStartupSetting } from "../mode/OctaveStartupSetting";
import { OctaveProfilesSettings } from "../profiles";
import { OctaveAppearanceFields } from "./OctaveAppearanceFields";
import { AutoSyncSetting } from "../offline/autosync/AutoSyncSetting";
import { CrossfadeSetting } from "./CrossfadeSetting";
import { LanguageSetting } from "./LanguageSetting";
import { OctaveTransfersSetting } from "./OctaveTransfersSetting";

const octaveOnly = <ScopeBadge scope="octave" />;
const account = <ScopeBadge scope="account" />;
const device = <ScopeBadge scope="device" />;

export function OctaveSettingsView() {
  const { t } = useTranslation("octaveShell");
  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-8 md:px-8" data-octave-settings>
      <p className="oc-eyebrow">{t("settings.kicker")}</p>
      <h1 className="oc-display mt-2 text-4xl text-content-primary md:text-5xl">{t("settings.title")}</h1>
      <div className="mt-8" data-octave-settings-part="octave">
        <SettingsSection title={t("settings.appearance")} caption={t("appearance.caption")} badge={octaveOnly}>
          <OctaveAppearanceFields />
        </SettingsSection>
        <CrossfadeSetting badge={octaveOnly} />
        <AutoSyncSetting variant="section" badge={octaveOnly} />
      </div>
      <div className="mt-10" data-octave-settings-part="shared">
        <h2 className="text-lg font-bold tracking-tight text-content-primary">{t("settings.shared")}</h2>
        <p className="mb-5 mt-1 text-sm leading-relaxed text-content-tertiary">{t("settings.sharedLead")}</p>
        <LanguageSetting badge={account} />
        <OctaveProfilesSettings badge={account} />
        <OctaveStartupSetting title={t("settings.startup")} />
        <OctaveTransfersSetting badge={device} />
      </div>
    </div>
  );
}
