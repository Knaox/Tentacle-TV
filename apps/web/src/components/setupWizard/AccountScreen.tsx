import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Field } from "../admin/services/Field";
import { cls } from "../../pages/adminUtils";
import { LocaleFields } from "./LocaleFields";
import { setupApi, SetupApiError, type WizardErrorCode } from "./setupApi";
import { SetupErrorLine } from "./SetupErrorLine";
import type { Wizard } from "./useWizard";
import { jellyfinNeedsInitialize, uiCultureOf } from "./wizardModel";
import { WizardFrame } from "./WizardFrame";

const primary = `${cls.bp} w-full sm:w-auto`;
const linkBtn = "min-h-11 text-sm font-semibold text-content-secondary underline underline-offset-4 hover:text-content-primary";

/**
 * Le compte administrateur, et la langue des métadonnées (proposée d'après le
 * navigateur). Jellyfin vierge : le compte est CRÉÉ, et Jellyfin configuré
 * aussitôt — son propre assistant, mené par l'API. Jellyfin configuré : le
 * compte est VÉRIFIÉ tout de suite — la clé d'accès est créée d'office — ou
 * l'on colle une clé, et le compte est demandé à la fin.
 */
export function AccountScreen({ wizard }: { wizard: Wizard }) {
  const { t } = useTranslation("setupWizard");
  const creating = wizard.data.mode === "initialize";
  const [useKey, setUseKey] = useState(wizard.data.mode === "key");
  const [username, setUsername] = useState(wizard.data.credentials?.username ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [locale, setLocale] = useState(wizard.data.locale);
  const [error, setError] = useState<WizardErrorCode | null>(null);
  const [pending, setPending] = useState(false);

  const short = creating && password.length > 0 && password.length < 8;
  const mismatch = creating && confirm.length > 0 && confirm !== password;
  const canSubmit = useKey ? apiKey.trim().length >= 16 : username.trim() !== "" && password !== "" && !short && (!creating || confirm === password);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    wizard.patch({ locale });
    setPending(true);
    try {
      if (creating) {
        const credentials = { username: username.trim(), password };
        if (jellyfinNeedsInitialize(wizard.data.context)) {
          await setupApi.initialize({
            url: wizard.data.jellyfinUrl,
            ...credentials,
            uiCulture: uiCultureOf(locale.language),
            // Le voisin s'appellerait du nom de son conteneur (« d716b0d5ac48 ») : il prend celui de Tentacle.
            ...(wizard.data.probe?.inStack ? { serverName: "Tentacle" } : {}),
            metadataLanguage: locale.language,
            metadataCountry: locale.country,
          });
          wizard.patch({ context: await setupApi.context() });
        }
        wizard.patch({ credentials });
      } else if (useKey) {
        await setupApi.connect({ url: wizard.data.jellyfinUrl, apiKey: apiKey.trim() });
        wizard.patch({ mode: "key", credentials: null });
      } else {
        await setupApi.connect({ url: wizard.data.jellyfinUrl, username: username.trim(), password });
        wizard.patch({ mode: "connect", credentials: { username: username.trim(), password } });
      }
      wizard.next();
    } catch (err) {
      setError(err instanceof SetupApiError ? err.code : "internal");
    } finally {
      setPending(false);
    }
  };

  return (
    <WizardFrame
      title={creating ? t("accountTitleCreate") : t("accountTitleLogin")}
      subtitle={creating ? t("accountSubtitleCreate") : t("accountSubtitleLogin")}
      position={wizard.position}
      total={wizard.total}
      onBack={wizard.back}
    >
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        {useKey && !creating ? (
          <Field label={t("accountKey")} hint={t("accountKeyHint")} value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" spellCheck={false} required />
        ) : (
          <>
            <Field label={t("accountUsername")} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" spellCheck={false} required autoFocus />
            <Field
              label={t("accountPassword")}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={creating ? "new-password" : "current-password"}
              hint={creating ? t("accountPasswordHint") : undefined}
              error={short ? t("accountPasswordShort") : null}
              required
            />
            {creating ? (
              <Field
                label={t("accountPasswordConfirm")}
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                error={mismatch ? t("accountPasswordMismatch") : null}
                required
              />
            ) : null}
          </>
        )}
        <LocaleFields locale={locale} onChange={setLocale} />
        <SetupErrorLine code={error} />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <button type="submit" disabled={pending || !canSubmit} className={primary}>
            {pending ? t("working") : creating ? t("localePrepare") : t("accountConnect")}
          </button>
          {!creating ? (
            <button type="button" onClick={() => setUseKey((v) => !v)} className={linkBtn}>
              {useKey ? t("accountUseAccount") : t("accountUseKey")}
            </button>
          ) : null}
        </div>
      </form>
    </WizardFrame>
  );
}

/** Clé collée, ou reprise après rechargement : le compte administrateur, qui ouvrira la session à la fin. */
export function FinalAccountScreen({ wizard }: { wizard: Wizard }) {
  const { t } = useTranslation("setupWizard");
  const [username, setUsername] = useState(wizard.data.credentials?.username ?? "");
  const [password, setPassword] = useState("");
  return (
    <WizardFrame title={t("accountTitleFinal")} subtitle={t("accountSubtitleFinal")} position={wizard.position} total={wizard.total} onBack={wizard.back}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          wizard.patch({ credentials: { username: username.trim(), password } });
          wizard.next();
        }}
        className="space-y-4"
      >
        <Field label={t("accountUsername")} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" spellCheck={false} required autoFocus />
        <Field label={t("accountPassword")} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        <button type="submit" disabled={!username.trim() || !password} className={primary}>
          {t("next")}
        </button>
      </form>
    </WizardFrame>
  );
}
