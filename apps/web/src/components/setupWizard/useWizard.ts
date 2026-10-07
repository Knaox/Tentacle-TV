import { useCallback, useEffect, useMemo, useReducer } from "react";
import { previousStep, type SetupContext, type SetupSelection } from "@tentacle-tv/shared";
import { setupApi, setupSession } from "./setupApi";
import { defaultLocale, pathOf, resumeStep, selectionOf, showsChosenServer, wizardLength, wizardSteps, type WizardStep } from "./wizardModel";
import { initialData, wizardReducer, type WizardData } from "./wizardState";

export type { AdviceChoice, WizardData } from "./wizardState";

export interface Wizard {
  step: WizardStep;
  /** Position (1-indexée) et nombre d'écrans du parcours RÉEL — le même pour les deux parcours. */
  position: number;
  total: number;
  data: WizardData;
  /** Le Jellyfin choisi, rappelé en tête des écrans de son parcours (`null` ailleurs). */
  server: SetupSelection | null;
  patch: (next: Partial<WizardData>) => void;
  next: () => void;
  /** Aller droit à un écran DU PARCOURS (un autre est ignoré). */
  go: (step: WizardStep) => void;
  /** Une session ouverte : le contexte, puis l'écran où reprendre. */
  enter: (context: SetupContext) => void;
  /** Le Jellyfin choisi (contexte rendu par `/jellyfin/select`) : le parcours repart de son premier écran. */
  choose: (context: SetupContext) => void;
  back: (() => void) | undefined;
}

export function useWizard(): Wizard {
  const [state, dispatch] = useReducer(wizardReducer, undefined, () => ({
    step: "welcome" as WizardStep,
    data: initialData(defaultLocale(typeof navigator !== "undefined" ? navigator.language : undefined)),
  }));
  const { step, data } = state;
  const shape = { needsCode: data.needsCode, context: data.context };
  const steps = useMemo(() => wizardSteps({ needsCode: data.needsCode, context: data.context }), [data.needsCode, data.context]);
  const total = wizardLength(shape);
  const patch = useCallback((next: Partial<WizardData>) => dispatch({ type: "patch", data: next }), []);
  const next = useCallback(() => dispatch({ type: "next" }), []);
  const back = useCallback(() => dispatch({ type: "back" }), []);
  const go = useCallback((target: WizardStep) => dispatch({ type: "go", step: target }), []);
  const enter = useCallback(
    (context: SetupContext) => dispatch({ type: "enter", context, step: resumeStep(context, false) }),
    [],
  );
  const choose = useCallback((context: SetupContext) => dispatch({ type: "choose", context }), []);

  // Une session d'assistant retrouvée (rechargement de l'onglet) : on reprend
  // là où l'installation s'était arrêtée. Expirée, on repart du début.
  useEffect(() => {
    if (!setupSession.read()) return;
    let cancelled = false;
    setupApi
      .context()
      .then((context) => {
        if (cancelled) return;
        // Le même nombre d'écrans qu'avant le rechargement : avec l'écran du code s'il a servi.
        dispatch({ type: "patch", data: { needsCode: setupSession.via() !== "local" } });
        dispatch({ type: "enter", context, step: resumeStep(context, false) });
      })
      .catch(() => setupSession.clear());
    return () => {
      cancelled = true;
    };
  }, []);

  const server = showsChosenServer(step, pathOf(data.context), data.context?.flow.noLibraries ?? false) ? selectionOf(data.context) : null;
  return {
    step,
    position: Math.max(0, steps.indexOf(step)) + 1,
    total,
    data,
    server,
    patch,
    next,
    go,
    enter,
    choose,
    back: previousStep(steps, step) ? back : undefined,
  };
}
