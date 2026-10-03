import { ACTION_LABELS, CAUSES, CONTEXT_TITLES, PLAYBACK_CONTEXTS } from "./problemCatalog";
import type {
  ProblemAction, ProblemActionKey, ProblemAvailability, ProblemCause, ProblemContext, ProblemDetail, ProblemModel,
} from "./problemTypes";

/** Trois gestes au plus : au-delà, plus personne ne lit. */
export const MAX_PROBLEM_ACTIONS = 3;

/** Les contextes où l'adresse du serveur se corrige sur place. */
const ADDRESS_CONTEXTS: ReadonlySet<ProblemContext> = new Set(["connect", "pairing", "signIn"]);

const NS = "errors:";

function available(key: ProblemActionKey, context: ProblemContext, can: ProblemAvailability): boolean {
  switch (key) {
    case "retry": return can.canRetry !== false;
    case "lowerQuality": return can.canLowerQuality === true;
    case "otherVersion": return can.hasOtherVersion === true;
    case "withoutSubtitles": return can.subtitlesActive === true;
    case "playOnline": return can.canPlayOnline === true;
    case "offlineLibrary": return can.hasOfflineLibrary === true;
    case "signIn": return true;
    case "editAddress": return ADDRESS_CONTEXTS.has(context);
    case "back": return can.canGoBack !== false;
  }
}

function actionLabel(key: ProblemActionKey, context: ProblemContext): string {
  if (key === "back" && PLAYBACK_CONTEXTS.has(context)) return `${NS}actionBackToDetails`;
  return NS + ACTION_LABELS[key];
}

export interface DescribeProblemInput {
  cause: ProblemCause;
  context: ProblemContext;
  availability?: ProblemAvailability;
  /** Les lignes techniques (`problemDetails`), repliées sous « Détails ». */
  details?: ProblemDetail[];
  /** Valeurs des phrases : `measured` / `needed` (Mb/s) pour un débit mesuré. */
  values?: Record<string, string | number>;
}

/**
 * La cause et le contexte, mis en message : titre, raison, aide, et les
 * gestes qui peuvent aboutir ici — trois au plus, le principal d'abord.
 */
export function describeProblem(input: DescribeProblemInput): ProblemModel {
  const entry = CAUSES[input.cause];
  const can = input.availability ?? {};
  const values = input.values ?? {};
  const actions: ProblemAction[] = entry.actions
    .filter((key) => available(key, input.context, can))
    .slice(0, MAX_PROBLEM_ACTIONS)
    .map((key) => ({ key, labelKey: actionLabel(key, input.context) }));
  const measured = input.cause === "bandwidthTooLow" && values.measured !== undefined && values.needed !== undefined;
  const hint = PLAYBACK_CONTEXTS.has(input.context) && entry.playbackHint ? entry.playbackHint : entry.hint;
  return {
    cause: input.cause,
    context: input.context,
    icon: entry.icon,
    titleKey: NS + CONTEXT_TITLES[input.context],
    reasonKey: NS + (measured ? "reasonBandwidthMeasured" : entry.reason),
    hintKey: hint ? NS + hint : null,
    values,
    actions,
    details: input.details ?? [],
    transient: entry.transient,
  };
}
