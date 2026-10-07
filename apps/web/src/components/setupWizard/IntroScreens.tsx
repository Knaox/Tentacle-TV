import { useEffect, useState, type FormEvent } from "react";
import type { SetupHostInfo } from "@tentacle-tv/shared";
import { useTranslation } from "react-i18next";
import { AdminNotice } from "../admin/kit";
import { Field } from "../admin/services/Field";
import { LanguageToggle } from "../auth/LanguageToggle";
import { isLocalHttp } from "../remoteAccess/lanAddress";
import { cls } from "../../pages/adminUtils";
import { setupApi, SetupApiError, type WizardErrorCode } from "./setupApi";
import { CodeHelp } from "./CodeHelp";
import { SetupErrorLine } from "./SetupErrorLine";
import type { Wizard } from "./useWizard";
import { codeFromHash } from "./wizardModel";
import { WizardFrame } from "./WizardFrame";

const primary = `${cls.bp} w-full sm:w-auto`;

/**
 * Une session ouverte (code ou réseau local) : le contexte, puis l'écran où
 * le SERVEUR dit d'en être — le choix du Jellyfin s'il n'est pas fait. Le mot
 * de passe n'a jamais été gardé : une installation déjà reliée le redemande
 * au premier écran de son parcours.
 */
async function enterWizard(wizard: Wizard): Promise<void> {
  wizard.enter(await setupApi.context());
}

/** Où tourne le serveur, et si CE navigateur devra donner le code ; `null` : serveur d'avant la route, ou muet. */
function useHostInfo(): SetupHostInfo | null | undefined {
  const [host, setHost] = useState<SetupHostInfo | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    setupApi.host().then(
      (info) => !cancelled && setHost(info),
      () => !cancelled && setHost(null),
    );
    return () => {
      cancelled = true;
    };
  }, []);
  return host;
}

/**
 * Bienvenue. « Commencer » réclame l'installation SANS code quand ce
 * navigateur arrive directement du réseau local ; sinon (ou si le serveur
 * refuse), l'écran du code.
 */
export function WelcomeScreen({ wizard }: { wizard: Wizard }) {
  const { t } = useTranslation("setupWizard");
  const host = useHostInfo();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<WizardErrorCode | null>(null);
  const local = host?.codeRequired === false;
  const { patch } = wizard;
  useEffect(() => {
    if (host !== undefined) patch({ needsCode: !local });
  }, [host, local, patch]);

  const start = async () => {
    if (!local) return wizard.go("code");
    setPending(true);
    setError(null);
    try {
      await setupApi.openLocalSession();
      await enterWizard(wizard);
    } catch (err) {
      const code = err instanceof SetupApiError ? err.code : "internal";
      if (code === "code_required" || code === "setup_in_progress") {
        wizard.patch({ needsCode: true, codeReason: code });
        wizard.go("code");
      } else setError(code);
    } finally {
      setPending(false);
    }
  };

  return (
    <WizardFrame help={wizard} title={t("welcomeTitle")} subtitle={t("welcomeSubtitle")} position={wizard.position} total={wizard.total} hideProgress={host === undefined}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-content-secondary">{t("welcomeLanguage")}</span>
          <LanguageToggle />
        </div>
        <p className="text-sm leading-relaxed text-content-secondary">{local ? t("welcomeLocal") : t("welcomeNeed")}</p>
        {isLocalHttp() ? <AdminNotice tone="info">{t("httpNotice")}</AdminNotice> : null}
        <SetupErrorLine code={error} onRetry={error ? () => void start() : undefined} />
        <button type="button" onClick={() => void start()} disabled={pending || host === undefined} className={primary} autoFocus>
          {pending ? t("working") : t("welcomeStart")}
        </button>
      </div>
    </WizardFrame>
  );
}

export function CodeScreen({ wizard }: { wizard: Wizard }) {
  const { t } = useTranslation("setupWizard");
  const [prefilled] = useState(() => codeFromHash(window.location.hash));
  const [code, setCode] = useState(prefilled ?? "");
  const [error, setError] = useState<WizardErrorCode | null>(null);
  const [pending, setPending] = useState(false);

  // Où tourne le serveur, pour dire où lire le code. Un serveur d'avant la
  // route (404) ou muet : tous les chemins sont montrés.
  const host = useHostInfo();

  // Le code ne reste pas dans la barre d'adresse une fois repris.
  useEffect(() => {
    if (prefilled) history.replaceState(null, "", window.location.pathname + window.location.search);
  }, [prefilled]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await setupApi.openSession(code.trim());
      await enterWizard(wizard);
    } catch (err) {
      setError(err instanceof SetupApiError ? err.code : "internal");
    } finally {
      setPending(false);
    }
  };

  return (
    <WizardFrame help={wizard} title={t("codeTitle")} subtitle={t("codeSubtitle")} position={wizard.position} total={wizard.total} onBack={wizard.back}>
      <form onSubmit={(e) => void submit(e)} className="space-y-5">
        {wizard.data.codeReason === "setup_in_progress" ? <AdminNotice tone="info">{t("codeInProgress")}</AdminNotice> : null}
        <Field
          label={t("codeLabel")}
          hint={prefilled ? t("codePrefilled") : undefined}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="XXXX-XXXX-XXXX"
          autoComplete="one-time-code"
          spellCheck={false}
          autoCapitalize="characters"
          className="[&_input]:font-mono [&_input]:tracking-[0.2em]"
          autoFocus
          required
        />
        <SetupErrorLine code={error} />
        <button type="submit" disabled={pending || code.trim().length < 12} className={primary}>
          {pending ? t("working") : t("codeSubmit")}
        </button>
        <CodeHelp host={host} defaultOpen={!prefilled} />
      </form>
    </WizardFrame>
  );
}
