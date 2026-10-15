import type { DismissibleHint } from "../help/dismissibleHints";
import type { FamilyOverviewDto } from "./familyContract";
import { sameUserId } from "./familyRules";

/**
 * « Action recommandée : posez votre code PIN » — QUI la voit, et où.
 *
 * Dans une famille, son profil paraît dans « Qui regarde ? » sur les
 * téléviseurs et les ordinateurs de tous : sans code PIN, n'importe qui devant
 * l'écran l'ouvre. Le rappel vaut pour le propriétaire comme pour un membre,
 * depuis une session PERSONNELLE (web, bureau, mobile — le seul endroit où
 * l'on pose son code), jamais pour un invité ni pour le compte de
 * démonstration de la revue Apple.
 *
 * - `card` : la carte permanente en tête de Réglages › Famille. Elle reste
 *   tant que le code manque — « Configurer plus tard » ne la masque pas.
 * - `startup` : la fenêtre « Action recommandée » au démarrage. En plus : le
 *   serveur sait retenir le rappel `familyPin` (sinon « Configurer plus tard »
 *   échouerait) et le compte ne l'a pas masqué. Rien tant que les rappels du
 *   compte ne sont pas connus : une fenêtre qui paraît puis s'efface serait
 *   pire que pas de fenêtre.
 *
 * Module pur : `familyPinReminder.test.ts`.
 */

/** Ce que l'on lit des rappels du compte (`useDismissedHints`). */
export interface FamilyPinHintsState {
  dismissed: readonly DismissibleHint[];
  known: readonly DismissibleHint[];
}

export interface FamilyPinReminderInput {
  /** `GET /api/family` ; `undefined` tant qu'il n'a pas répondu, `null` sans Famille. */
  overview: Pick<FamilyOverviewDto, "account" | "family"> | null | undefined;
  /** Les rappels masqués du compte ; `undefined` tant qu'ils ne sont pas connus. */
  hints: FamilyPinHintsState | null | undefined;
  /** Le compte de la session, s'il est connu : un invité de la famille n'a pas de rappel. */
  userId?: string | null;
}

export interface FamilyPinReminder {
  card: boolean;
  startup: boolean;
}

const NONE: FamilyPinReminder = { card: false, startup: false };

export const FAMILY_PIN_HINT: DismissibleHint = "familyPin";

export function familyPinReminder({ overview, hints, userId }: FamilyPinReminderInput): FamilyPinReminder {
  if (!overview?.family) return NONE;
  const { account, family } = overview;
  if (!account.personalSession || account.reviewAccount || account.hasPin) return NONE;
  // Un invité n'ouvre jamais de session personnelle — garde de plus, si le
  // compte se reconnaît parmi les profils de la famille.
  if (userId && family.profiles.some((profile) => profile.kind === "guest" && sameUserId(profile.userId, userId))) {
    return NONE;
  }
  const startup = !!hints && hints.known.includes(FAMILY_PIN_HINT) && !hints.dismissed.includes(FAMILY_PIN_HINT);
  return { card: true, startup };
}
