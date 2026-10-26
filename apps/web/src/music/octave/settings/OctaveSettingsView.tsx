/**
 * Octave — « Réglages d'Octave », une page DANS Octave (`/octave/settings`, Damien, 26/10 : « sinon on retourne dans
 * le mode films et séries alors qu'Octave est activé ») : la coquille reste, la surface affichée reste Octave — le
 * thème et le Liquid Glass d'Octave s'appliquent pendant qu'on les règle, on voit l'effet en direct.
 *
 * Les MÊMES réglages de l'appareil que Réglages de Tentacle, jamais une copie : l'apparence
 * (`OctaveAppearanceFields`, partagée avec Réglages › Apparence) et « Au démarrage, ouvrir »
 * (`OctaveStartupSetting`, partagé avec Réglages › Personnalisation). Une section par sujet : la page est prête
 * à en recevoir d'autres. Aucune donnée chargée ici, ni de films ni de musique.
 */

import { useTranslation } from "react-i18next";
import { SettingsSection } from "@tentacle-tv/ui";
import { OctaveStartupSetting } from "../mode/OctaveStartupSetting";
import { OctaveAppearanceFields } from "./OctaveAppearanceFields";

export function OctaveSettingsView() {
  const { t } = useTranslation("octaveShell");
  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-8 md:px-8" data-octave-settings>
      <p className="oc-eyebrow">{t("settings.kicker")}</p>
      <h1 className="oc-display mt-2 text-4xl text-content-primary md:text-5xl">{t("settings.title")}</h1>
      <div className="mt-8">
        <SettingsSection title={t("settings.appearance")} caption={t("appearance.caption")}>
          <OctaveAppearanceFields />
        </SettingsSection>
        <OctaveStartupSetting title={t("settings.startup")} />
      </div>
    </div>
  );
}
