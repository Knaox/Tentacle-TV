import { useCallback, useEffect, useMemo, useState } from "react";
import type { ExistingLibrary, JellyfinProbeResult, LibraryOutcome, LibraryPlan, SegmentSetupRun, SetupCompleteResponse, SetupContext } from "@tentacle-tv/shared";
import { setupApi, setupSession } from "./setupApi";
import { defaultLocale, needsDatabase, NO_BACK, resumeStep, wizardSteps, type JellyfinMode, type WizardLocale, type WizardStep } from "./wizardModel";

/** Ce que l'assistant a appris en chemin. Le mot de passe ne vit qu'ici, en mémoire, jamais stocké. */
export interface WizardData {
  context: SetupContext | null;
  jellyfinUrl: string;
  probe: JellyfinProbeResult | null;
  mode: JellyfinMode | null;
  credentials: { username: string; password: string } | null;
  locale: WizardLocale;
  existing: ExistingLibrary[];
  plans: LibraryPlan[];
  outcomes: LibraryOutcome[] | null;
  /**
   * La détection des passages : `undefined` pas encore faite, `null` faite
   * sans succès (l'installation continue), sinon son résultat.
   */
  segments: SegmentSetupRun | null | undefined;
  session: SetupCompleteResponse | null;
  /** L'installation a repris après un rechargement : le compte sera redemandé à la fin. */
  resumed: boolean;
  /** Le code d'installation est à donner (navigateur hors du réseau local, ou installation réclamée ailleurs). */
  needsCode: boolean;
  /** Pourquoi le code est demandé, quand l'ouverture sans code a été refusée. */
  codeReason: "code_required" | "setup_in_progress" | null;
  /** L'adresse de Jellyfin que recevront les applications, revue au récapitulatif. */
  clientUrl: string;
}

export interface Wizard {
  step: WizardStep;
  position: number;
  total: number;
  data: WizardData;
  patch: (next: Partial<WizardData>) => void;
  next: () => void;
  /** Aller droit à un écran : la reprise d'une installation commencée. */
  go: (step: WizardStep) => void;
  back: (() => void) | undefined;
}

/** Ce que l'assistant retient du contexte, une session ouverte (code, réseau local ou reprise). */
export function enteredData(context: SetupContext): Partial<WizardData> {
  return { context, jellyfinUrl: context.jellyfin.url ?? "", clientUrl: context.jellyfin.clientUrl ?? "" };
}

export function useWizard(): Wizard {
  const [step, setStep] = useState<WizardStep>("welcome");
  const [data, setData] = useState<WizardData>(() => ({
    context: null,
    jellyfinUrl: "",
    probe: null,
    mode: null,
    credentials: null,
    locale: defaultLocale(typeof navigator !== "undefined" ? navigator.language : undefined),
    existing: [],
    plans: [],
    outcomes: null,
    segments: undefined,
    session: null,
    resumed: false,
    needsCode: true,
    codeReason: null,
    clientUrl: "",
  }));

  const steps = useMemo(
    () =>
      wizardSteps({
        needsCode: data.needsCode,
        needsDatabase: needsDatabase(data.context),
        mode: data.mode,
        askFinalAccount: data.resumed && !data.credentials,
      }),
    [data.needsCode, data.context, data.mode, data.resumed, data.credentials],
  );
  const index = Math.max(0, steps.indexOf(step));
  const patch = useCallback((next: Partial<WizardData>) => setData((prev) => ({ ...prev, ...next })), []);
  const next = useCallback(() => setStep(steps[Math.min(index + 1, steps.length - 1)]), [steps, index]);
  const back = useCallback(() => setStep(steps[Math.max(index - 1, 0)]), [steps, index]);

  // Une session d'assistant retrouvée (rechargement de l'onglet) : on reprend
  // là où l'installation s'était arrêtée. Expirée, on repart du code.
  useEffect(() => {
    if (!setupSession.read()) return;
    let cancelled = false;
    setupApi
      .context()
      .then((context) => {
        if (cancelled) return;
        setData((prev) => ({ ...prev, ...enteredData(context), resumed: true }));
        setStep(resumeStep(context));
      })
      .catch(() => setupSession.clear());
    return () => {
      cancelled = true;
    };
  }, []);

  return { step, position: index + 1, total: steps.length, data, patch, next, go: setStep, back: NO_BACK.has(step) ? undefined : back };
}
