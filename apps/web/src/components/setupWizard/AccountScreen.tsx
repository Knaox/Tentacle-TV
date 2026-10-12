import { useId, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Field } from "../admin/services/Field";
import { CredentialsForm, DoneLine } from "./AccountParts";
import { LocaleFields } from "./LocaleFields";
import { setupApi, SetupApiError, type WizardErrorCode } from "./setupApi";
import { SetupErrorLine } from "./SetupErrorLine";
import type { Wizard } from "./useWizard";
import { uiCultureOf } from "./wizardModel";
import { WizardFrame, type WizardFrameBase } from "./WizardFrame";

/**
 * Jellyfin NEUF seulement (le parcours `fresh`) : le compte administrateur est
 * CRÉÉ, et Jellyfin configuré aussitôt — son propre assistant, mené par
 * l'API —, avec la langue des métadonnées proposée d'après le navigateur.
 * Une fois créé (retour en arrière, rechargement), l'écran le dit et ne
 * recrée rien ; sans le mot de passe en mémoire, il le redemande et le fait
 * vérifier par Jellyfin.
 */
export function AccountScreen({ wizard }: { wizard: Wizard }) {
  const { t } = useTranslation("setupWizard");
  const linked = wizard.data.context?.flow.linked ?? false;
  const frame: WizardFrameBase = { wizard, title: t("accountTitleCreate"), subtitle: t("accountSubtitleCreate") };
  return linked ? <AccountCreated wizard={wizard} frame={frame} /> : <CreateAccountForm wizard={wizard} frame={frame} />;
}

function AccountCreated({ wizard, frame }: { wizard: Wizard; frame: WizardFrameBase }) {
  const { t } = useTranslation("setupWizard");
  const credentials = wizard.data.credentials;
  if (credentials) {
    return (
      <WizardFrame {...frame} primary={{ label: t("next"), onClick: wizard.next, autoFocus: true }}>
        <DoneLine>{t("accountDone", { name: credentials.username })}</DoneLine>
      </WizardFrame>
    );
  }
  return (
    <CredentialsForm
      frame={frame}
      submitLabel={t("accountVerify")}
      onSubmit={async (entered) => {
        try {
          await setupApi.verify(entered);
          wizard.patch({ credentials: entered });
          wizard.next();
          return null;
        } catch (err) {
          return err instanceof SetupApiError ? err.code : "internal";
        }
      }}
    >
      <DoneLine>{t("accountDoneAnonymous")}</DoneLine>
      <p className="text-sm text-content-secondary">{t("accountDoneVerify")}</p>
    </CredentialsForm>
  );
}

function CreateAccountForm({ wizard, frame }: { wizard: Wizard; frame: WizardFrameBase }) {
  const { t } = useTranslation("setupWizard");
  const formId = useId();
  const selection = wizard.data.context?.flow.selection ?? null;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [locale, setLocale] = useState(wizard.data.locale);
  const [error, setError] = useState<WizardErrorCode | null>(null);
  const [pending, setPending] = useState(false);

  const short = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = !!selection && username.trim() !== "" && password !== "" && !short && confirm === password;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selection) return;
    setError(null);
    setPending(true);
    try {
      const credentials = { username: username.trim(), password };
      await setupApi.initialize({
        url: selection.url,
        ...credentials,
        uiCulture: uiCultureOf(locale.language),
        // Le voisin s'appellerait du nom de son conteneur (« d716b0d5ac48 ») : il prend celui de Tentacle.
        ...(selection.inStack ? { serverName: "Tentacle" } : {}),
        metadataLanguage: locale.language,
        metadataCountry: locale.country,
      });
      wizard.patch({ locale, credentials, context: await setupApi.context() });
      wizard.next();
    } catch (err) {
      setError(err instanceof SetupApiError ? err.code : "internal");
    } finally {
      setPending(false);
    }
  };

  return (
    <WizardFrame {...frame} primary={{ label: t("localePrepare"), form: formId, pending, disabled: !canSubmit }}>
      <form id={formId} onSubmit={(e) => void submit(e)} className="space-y-5">
        <Field label={t("accountUsername")} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" spellCheck={false} required autoFocus />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("accountPassword")}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            hint={t("accountPasswordHint")}
            error={short ? t("accountPasswordShort") : null}
            required
          />
          <Field
            label={t("accountPasswordConfirm")}
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            error={mismatch ? t("accountPasswordMismatch") : null}
            required
          />
        </div>
        <div className="border-t border-line-subtle pt-5">
          <LocaleFields locale={locale} onChange={setLocale} />
        </div>
        <SetupErrorLine code={error} />
      </form>
    </WizardFrame>
  );
}
