import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Field } from "../admin/services/Field";
import { CredentialsForm, DoneLine, primary } from "./AccountParts";
import { LocaleFields } from "./LocaleFields";
import { setupApi, SetupApiError, type WizardErrorCode } from "./setupApi";
import { SetupErrorLine } from "./SetupErrorLine";
import type { Wizard } from "./useWizard";
import { uiCultureOf } from "./wizardModel";
import { WizardFrame } from "./WizardFrame";

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
  return (
    <WizardFrame
      title={t("accountTitleCreate")}
      subtitle={t("accountSubtitleCreate")}
      position={wizard.position}
      total={wizard.total}
      onBack={wizard.back}
      server={wizard.server}
    >
      {linked ? <AccountCreated wizard={wizard} /> : <CreateAccountForm wizard={wizard} />}
    </WizardFrame>
  );
}

function AccountCreated({ wizard }: { wizard: Wizard }) {
  const { t } = useTranslation("setupWizard");
  const credentials = wizard.data.credentials;
  if (credentials) {
    return (
      <div className="space-y-5">
        <DoneLine>{t("accountDone", { name: credentials.username })}</DoneLine>
        <button type="button" onClick={wizard.next} className={primary} autoFocus>
          {t("next")}
        </button>
      </div>
    );
  }
  return (
    <CredentialsForm
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

function CreateAccountForm({ wizard }: { wizard: Wizard }) {
  const { t } = useTranslation("setupWizard");
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
    <form onSubmit={(e) => void submit(e)} className="space-y-4">
      <Field label={t("accountUsername")} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" spellCheck={false} required autoFocus />
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
      <LocaleFields locale={locale} onChange={setLocale} />
      <SetupErrorLine code={error} />
      <button type="submit" disabled={pending || !canSubmit} className={primary}>
        {pending ? t("working") : t("localePrepare")}
      </button>
    </form>
  );
}
