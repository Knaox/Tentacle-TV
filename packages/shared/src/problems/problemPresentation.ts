import { CAUSES, isProblemCause } from "./problemCatalog";
import type { ProblemCause, ProblemContext, ProblemPresentation, ProblemSeverity } from "./problemTypes";

/**
 * Comment un message se montre — la même règle sur le téléphone, la tablette
 * et, demain, partout : sa GRAVITÉ (couleur, pictogramme) et sa FORME
 * (bandeau, carte du lecteur, écran plein). La cause l'impose quand elle le
 * dit (« compte désactivé » : on ne peut pas continuer, écran plein ; « Léa a
 * quitté la séance » : un bandeau, même dans le lecteur) ; sinon, c'est le
 * contexte qui tranche.
 */

const CONTEXT_PRESENTATION: Record<ProblemContext, ProblemPresentation> = {
  playbackStart: "card",
  playbackStopped: "card",
  offlinePlayback: "card",
  cast: "card",
  page: "screen",
  connect: "screen",
  signIn: "screen",
  pairing: "screen",
  extension: "screen",
  profile: "screen",
  screen: "screen",
  action: "banner",
  watchTogether: "banner",
  offlineTransfer: "banner",
  notifications: "banner",
  pictureInPicture: "banner",
};

const KNOWN_CONTEXTS = new Set(Object.keys(CONTEXT_PRESENTATION));

/** La gravité d'une cause : la sienne, sinon ambre si elle se répare seule, rouge sinon. */
export function problemSeverity(cause: ProblemCause): ProblemSeverity {
  const entry = CAUSES[cause];
  return entry.severity ?? (entry.transient ? "warning" : "error");
}

/** La forme : celle que la cause impose, sinon celle du contexte. */
export function problemPresentation(cause: ProblemCause, context: ProblemContext): ProblemPresentation {
  return CAUSES[cause].presentation ?? CONTEXT_PRESENTATION[context];
}

/**
 * Le code du support (« playbackStart/transcodeFailed ») : le contexte et la
 * cause, en clair — on le lit à voix haute au téléphone, on le cherche dans
 * le code. Jamais traduit, jamais renommé.
 */
export function problemCode(context: ProblemContext, cause: ProblemCause): string {
  return `${context}/${cause}`;
}

export function isProblemContext(value: unknown): value is ProblemContext {
  return typeof value === "string" && KNOWN_CONTEXTS.has(value);
}

/**
 * Un code relu (rapport, ancienne version, autre plateforme) : ce qu'on en
 * reconnaît. Un code inconnu ne casse rien — il devient « erreur inattendue »
 * dans une page, le message générique et propre.
 */
export function parseProblemCode(code: string): { context: ProblemContext; cause: ProblemCause } {
  const [rawContext, rawCause] = code.includes("/") ? code.split("/", 2) : ["page", code];
  return {
    context: isProblemContext(rawContext) ? rawContext : "page",
    cause: isProblemCause(rawCause) ? rawCause : "unknown",
  };
}
