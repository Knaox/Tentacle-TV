import { useTranslation } from "react-i18next";
import { JellyfinPicker } from "./JellyfinPicker";
import type { Wizard } from "./useWizard";
import { WizardFrame } from "./WizardFrame";

/**
 * Jellyfin : la liste de TOUS les Jellyfin trouvés, neufs et déjà configurés
 * bien distingués — celui de la pile complète en tête et choisi d'office.
 * Neuf, Tentacle le configure ; déjà configuré, on s'y connecte avec un
 * compte administrateur existant, et rien n'y est créé.
 */
export function JellyfinScreen({ wizard }: { wizard: Wizard }) {
  const { t } = useTranslation("setupWizard");
  const provisioner = wizard.data.context?.provisioner ?? "existing-instance";
  const subtitle =
    provisioner === "docker-sibling" ? t("jfSubtitleSibling") : provisioner === "native-host" ? t("jfSubtitleNative") : t("jfSubtitleExisting");
  return (
    <WizardFrame title={t("jfTitle")} subtitle={subtitle} position={wizard.position} total={wizard.total} onBack={wizard.back}>
      <JellyfinPicker wizard={wizard} />
    </WizardFrame>
  );
}
