import { describeProblem, signInProblemCause, type ProblemModel } from "@tentacle-tv/shared";
import { recordProblem } from "./problemJournalStore";

/** L'échec d'une réponse de connexion, avec son corps (un refus de compte s'y lit). */
export class SignInFailure extends Error {
  constructor(readonly status: number, readonly body: unknown) {
    super(`HTTP ${status}`);
  }
}

/** Lire la réponse en échec : son statut et, si c'est du JSON, son corps. */
export async function signInFailureOf(response: Response): Promise<SignInFailure> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // corps vide ou non JSON : le statut suffit.
  }
  return new SignInFailure(response.status, body);
}

/**
 * Le message d'un échec de connexion (connexion, inscription, code), dans le
 * modèle commun : identifiants, compte désactivé ou bloqué, heures d'accès,
 * trop d'appareils, trop d'essais, migration de la base, ou la cause du
 * réseau. Noté au journal local.
 */
export function signInProblem(error: unknown): ProblemModel {
  const source = error instanceof SignInFailure
    ? { status: error.status, refusal: error.body, message: JSON.stringify(error.body ?? "") }
    : error;
  const model = describeProblem({ cause: signInProblemCause(source), context: "signIn" });
  recordProblem(model);
  return model;
}

/** La phrase affichée sous le formulaire : la cause, puis son aide. */
export function signInErrorText(error: unknown, t: (key: string, values?: Record<string, string | number>) => string): string {
  const model = signInProblem(error);
  return [t(model.reasonKey, model.values), model.hintKey ? t(model.hintKey, model.values) : null].filter(Boolean).join(" ");
}
