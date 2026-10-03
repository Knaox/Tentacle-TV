import { classifyProblem, type FailureTarget, type RawProblem } from "./classifyProblem";
import { describeProblem } from "./describeProblem";
import type { ProblemAvailability, ProblemContext, ProblemModel } from "./problemTypes";

/**
 * Une erreur de requête — `JellyfinError`, `TentacleApiError`, `TypeError`
 * réseau, délai —, lue sans connaître sa classe : son statut s'il y en a un,
 * son message, son nom. Toutes les plateformes passent par ici avant le
 * classifieur.
 */
export function rawFromError(error: unknown, target: FailureTarget): RawProblem {
  const record = typeof error === "object" && error !== null ? (error as Record<string, unknown>) : {};
  const status = typeof record.status === "number" && record.status > 0 ? record.status : undefined;
  const message = typeof error === "string" ? error : typeof record.message === "string" ? record.message : undefined;
  const name = typeof record.name === "string" ? record.name : undefined;
  return { status, message, name, target };
}

/** L'erreur d'une requête, mise en message — la cause dite dans le contexte donné. */
export function problemFromError(
  error: unknown,
  options: { target: FailureTarget; context: ProblemContext; availability?: ProblemAvailability },
): ProblemModel {
  return describeProblem({
    cause: classifyProblem(rawFromError(error, options.target)),
    context: options.context,
    availability: options.availability,
  });
}

/**
 * L'étiquette qu'une mutation porte (`meta`) pour qu'un échec soit DIT : la
 * clé du titre (« Les favoris n'ont pas pu être modifiés »). La plateforme
 * écoute son cache de mutations et en fait un message bref — le geste
 * optimiste est déjà défait par la mutation elle-même.
 */
export interface FailureMeta {
  failureTitle: string;
  /** Ce que la mutation joignait (défaut : Jellyfin par le relais, `relayed`). */
  failureTarget?: FailureTarget;
}

export function failureMetaOf(meta: unknown): FailureMeta | null {
  const record = typeof meta === "object" && meta !== null ? (meta as Record<string, unknown>) : null;
  return record && typeof record.failureTitle === "string" ? (record as unknown as FailureMeta) : null;
}
