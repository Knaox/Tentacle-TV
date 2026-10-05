import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { AdminNotice } from "../admin/kit";
import { Field } from "../admin/services/Field";
import { LanguageToggle } from "../auth/LanguageToggle";
import { CopyBlock } from "../remoteAccess/CopyBlock";
import { isLocalHttp } from "../remoteAccess/lanAddress";
import { cls } from "../../pages/adminUtils";
import { setupApi, SetupApiError, type WizardErrorCode } from "./setupApi";
import { SetupErrorLine } from "./SetupErrorLine";
import type { Wizard } from "./useWizard";
import { codeFromHash, resumeStep } from "./wizardModel";
import { WizardFrame } from "./WizardFrame";

const primary = `${cls.bp} w-full sm:w-auto`;

export function WelcomeScreen({ wizard }: { wizard: Wizard }) {
  const { t } = useTranslation("setupWizard");
  return (
    <WizardFrame title={t("welcomeTitle")} subtitle={t("welcomeSubtitle")} position={wizard.position} total={wizard.total}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-content-secondary">{t("welcomeLanguage")}</span>
          <LanguageToggle />
        </div>
        <p className="text-sm leading-relaxed text-content-secondary">{t("welcomeNeed")}</p>
        {isLocalHttp() ? <AdminNotice tone="info">{t("httpNotice")}</AdminNotice> : null}
        <button type="button" onClick={wizard.next} className={primary} autoFocus>
          {t("welcomeStart")}
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
      const context = await setupApi.context();
      wizard.patch({ context, jellyfinUrl: context.jellyfin.url ?? context.jellyfin.suggestedUrl ?? "" });
      // Une installation déjà avancée (base, Jellyfin) reprend là où elle en était ;
      // le mot de passe, lui, n'a jamais été gardé : il sera redemandé à la fin.
      const resume = resumeStep(context);
      if (resume === "libraries") wizard.patch({ resumed: true });
      wizard.go(resume);
    } catch (err) {
      setError(err instanceof SetupApiError ? err.code : "internal");
    } finally {
      setPending(false);
    }
  };

  return (
    <WizardFrame title={t("codeTitle")} subtitle={t("codeSubtitle")} position={wizard.position} total={wizard.total} onBack={wizard.back}>
      <form onSubmit={(e) => void submit(e)} className="space-y-5">
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
        <details className="rounded-xl border border-line-subtle bg-fill-faint px-4 py-3 text-sm text-content-secondary">
          <summary className="min-h-11 cursor-pointer py-2.5 font-semibold text-content-primary">{t("codeWhereTitle")}</summary>
          <div className="space-y-3 pb-1">
            <CopyBlock label={t("codeWhereLogs")} code="docker compose logs tentacle" />
            <p>{t("codeWhereFile")}</p>
            <CopyBlock label={t("codeWhereNew")} code="docker compose exec tentacle tentacle setup token" />
          </div>
        </details>
      </form>
    </WizardFrame>
  );
}
