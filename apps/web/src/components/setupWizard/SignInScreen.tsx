import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminNotice } from "../admin/kit";
import { CredentialsForm, DoneLine, linkBtn, primary } from "./AccountParts";
import { setupApi, SetupApiError } from "./setupApi";
import type { Wizard } from "./useWizard";
import { WizardFrame } from "./WizardFrame";

/**
 * Jellyfin DÉJÀ configuré seulement (le parcours `configured`) : on se
 * CONNECTE avec un administrateur qui existe déjà, et c'est tout — aucun
 * compte n'est créé, ni ici, ni par le serveur, qui refuserait. La clé
 * « Tentacle » est créée d'office (ou reprise, si c'est le même Jellyfin).
 */
export function SignInScreen({ wizard }: { wizard: Wizard }) {
  const { t } = useTranslation("setupWizard");
  const linked = wizard.data.context?.flow.linked ?? false;
  const credentials = wizard.data.credentials;
  const [other, setOther] = useState(false);
  const signedIn = linked && !!credentials && !other;

  return (
    <WizardFrame help={wizard} title={t("signInTitle")} subtitle={t("signInSubtitle")} position={wizard.position} total={wizard.total} onBack={wizard.back} server={wizard.server}>
      <div className="space-y-5">
        <AdminNotice tone="info">{t("signInNothingCreated")}</AdminNotice>
        {signedIn ? (
          <>
            <DoneLine>{t("signInDone", { name: credentials?.username ?? "" })}</DoneLine>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <button type="button" onClick={wizard.next} className={primary} autoFocus>
                {t("next")}
              </button>
              <button type="button" onClick={() => setOther(true)} className={linkBtn}>
                {t("signInOther")}
              </button>
            </div>
          </>
        ) : (
          <CredentialsForm
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
        )}
      </div>
    </WizardFrame>
  );
}
