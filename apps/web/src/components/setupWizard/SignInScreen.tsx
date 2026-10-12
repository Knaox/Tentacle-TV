import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminNotice } from "../admin/kit";
import { CredentialsForm, DoneLine } from "./AccountParts";
import { setupApi, SetupApiError } from "./setupApi";
import type { Wizard } from "./useWizard";
import { WizardFrame, type WizardFrameBase } from "./WizardFrame";

/**
 * Jellyfin DÉJÀ configuré seulement (le parcours `configured`) : on se
 * CONNECTE avec un administrateur qui existe déjà, et c'est tout — aucun
 * compte n'est créé, ni ici, ni par le serveur, qui refuserait. La clé
 * « Tentacle » est créée d'office (ou reprise, si c'est le même Jellyfin).
 * « Rien n'est créé » est dit à gauche, sous l'explication.
 */
export function SignInScreen({ wizard }: { wizard: Wizard }) {
  const { t } = useTranslation("setupWizard");
  const linked = wizard.data.context?.flow.linked ?? false;
  const credentials = wizard.data.credentials;
  const [other, setOther] = useState(false);
  const signedIn = linked && !!credentials && !other;
  const frame: WizardFrameBase = {
    wizard,
    title: t("signInTitle"),
    subtitle: t("signInSubtitle"),
    aside: <AdminNotice tone="info">{t("signInNothingCreated")}</AdminNotice>,
  };

  if (signedIn) {
    return (
      <WizardFrame {...frame} primary={{ label: t("next"), onClick: wizard.next, autoFocus: true }} secondary={[{ label: t("signInOther"), onClick: () => setOther(true) }]}>
        <DoneLine>{t("signInDone", { name: credentials?.username ?? "" })}</DoneLine>
      </WizardFrame>
    );
  }
  return (
    <CredentialsForm
      frame={frame}
      submitLabel={t("accountConnect")}
      initialUsername={other ? "" : (credentials?.username ?? "")}
      onSubmit={async (entered) => {
        const url = wizard.data.context?.flow.selection?.url;
        if (!url) return "step_refused";
        try {
          await setupApi.connect({ url, ...entered });
          wizard.patch({ credentials: entered, context: await setupApi.context() });
          wizard.next();
          return null;
        } catch (err) {
          return err instanceof SetupApiError ? err.code : "internal";
        }
      }}
    />
  );
}
