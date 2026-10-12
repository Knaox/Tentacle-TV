import { useTranslation } from "react-i18next";
import { JellyfinPicker } from "./JellyfinPicker";
import type { Wizard } from "./useWizard";

/**
 * Jellyfin : la liste de TOUS les Jellyfin trouvés, neufs et déjà configurés
 * bien distingués — celui de la pile complète en tête et choisi d'office.
 * Neuf, Tentacle le configure ; déjà configuré, on s'y connecte avec un
 * compte administrateur existant, et rien n'y est créé. Le choix tient l'état
 * de l'écran : c'est lui qui pose le cadre (et son bouton « Continuer »).
 */
export function JellyfinScreen({ wizard }: { wizard: Wizard }) {
  const { t } = useTranslation("setupWizard");
  const provisioner = wizard.data.context?.provisioner ?? "existing-instance";
  const subtitle =
    provisioner === "docker-sibling"
      ? t("jfSubtitleSibling")
      : provisioner === "native-host"
        ? t("jfSubtitleNative")
        : provisioner === "managed-by-tentacle"
          ? t("jfSubtitleWindowsApp")
          : t("jfSubtitleExisting");
  return <JellyfinPicker wizard={wizard} title={t("jfTitle")} subtitle={subtitle} />;
}
