import { useEffect, useId, useState, type FormEvent } from "react";
import type { SetupHostInfo } from "@tentacle-tv/shared";
import { useTranslation } from "react-i18next";
import { AdminNotice } from "../admin/kit";
import { Field } from "../admin/services/Field";
import { isLocalHttp } from "../remoteAccess/lanAddress";
import { TentacleSvg } from "../ui/TentacleSvg";
import { setupApi, SetupApiError, type WizardErrorCode } from "./setupApi";
import { CodeHelp } from "./CodeHelp";
import { SetupErrorLine } from "./SetupErrorLine";
import type { Wizard } from "./useWizard";
import { codeFromHash } from "./wizardModel";
import { WizardFrame } from "./WizardFrame";
import { WIZARD_PHASES } from "./wizardPhases";

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
 * refuse), l'écran du code. À gauche, le programme : les grandes étapes qui
 * suivent, celles de l'en-tête. La langue se choisit dans l'en-tête, sur tous
 * les écrans.
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
    <WizardFrame
      wizard={wizard}
      title={t("welcomeTitle")}
      subtitle={t("welcomeSubtitle")}
      hideProgress={host === undefined}
      aside={<WelcomePlan />}
      primary={{ label: t("welcomeStart"), onClick: () => void start(), pending, disabled: host === undefined, autoFocus: true }}
    >
      <div className="space-y-6">
        <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
          <span
            aria-hidden="true"
            className="inline-flex h-28 w-28 shrink-0 items-center justify-center rounded-full"
            style={{ background: "radial-gradient(circle, rgba(var(--brand-rgb), 0.34) 0%, rgba(var(--brand-rgb), 0) 70%)" }}
          >
            <TentacleSvg size={88} style={{ filter: "drop-shadow(0 6px 22px rgba(var(--brand-rgb), 0.45))" }} />
          </span>
          <p className="text-base leading-relaxed text-content-primary">{local ? t("welcomeLocal") : t("welcomeNeed")}</p>
        </div>
        {isLocalHttp() ? <AdminNotice tone="info">{t("httpNotice")}</AdminNotice> : null}
        <SetupErrorLine code={error} onRetry={error ? () => void start() : undefined} />
      </div>
    </WizardFrame>
  );
}

/** Le programme de l'accueil : les grandes étapes qui suivent, numérotées comme dans l'en-tête. */
function WelcomePlan() {
  const { t } = useTranslation("setupWizard");
  return (
    <>
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-content-tertiary">{t("welcomePlanTitle")}</h2>
      <ol className="space-y-3">
        {WIZARD_PHASES.slice(1).map((phase, index) => (
          <li key={phase} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[rgba(var(--brand-rgb),0.35)] bg-[var(--brand-soft)] text-xs font-semibold tabular-nums text-[var(--brand-light)]"
            >
              {index + 2}
            </span>
            <span className="min-w-0 pt-0.5">
              <span className="block font-semibold text-content-primary">{t(`phase_${phase}`)}</span>
              <span className="block text-content-secondary">{t(`welcomePlan_${phase}`)}</span>
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}

/**
 * Le code d'installation : le champ dans le panneau, « Où le trouver ? » (un
 * onglet par façon de lire le journal du serveur) à gauche.
 */
export function CodeScreen({ wizard }: { wizard: Wizard }) {
  const { t } = useTranslation("setupWizard");
  const formId = useId();
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
    <WizardFrame
      wizard={wizard}
      title={t("codeTitle")}
      subtitle={t("codeSubtitle")}
      helpPackaging={host?.packaging}
      aside={<CodeHelp host={host} defaultOpen={!prefilled} />}
      primary={{ label: t("codeSubmit"), form: formId, pending, disabled: code.trim().length < 12 }}
    >
      <form id={formId} onSubmit={(e) => void submit(e)} className="space-y-5">
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
          className="[&_input]:h-14 [&_input]:text-center [&_input]:font-mono [&_input]:text-lg [&_input]:tracking-[0.25em]"
          autoFocus
          required
        />
        <SetupErrorLine code={error} />
      </form>
    </WizardFrame>
  );
}
