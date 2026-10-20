import { AVATAR_INVITE_SEEN_KEY, parseInvitedSubjects, withoutSubjectInvited } from "../avatars/avatarInvite";
import { honorPromptsReset, type PromptsResetStorage } from "../family/familyPromptsReset";
import { FIRST_RUN_SEEN_KEY, firstRunKey, parseFirstRunSeen } from "./firstRunPlan";

/**
 * « Reproposer le code PIN et la photo » (serveur 1.30.0, `family.promptsReset`)
 * hors TV (mobile, iPad, web étroit) : une demande du serveur plus récente que la dernière honorée
 * ICI fait oublier le premier lancement de ce profil (code PIN, rangées de
 * l'accueil, photo : tout repasse, étape par étape, au prochain lancement) et
 * l'invitation aux avatars. La règle est celle de tous les appareils (shared
 * `familyPromptsReset` : dates du SERVEUR, jamais l'horloge du téléphone) ;
 * chaque étape garde ensuite ses conditions (le code seulement s'il manque, la
 * photo seulement si elle manque). Un serveur d'avant ne rend pas la date :
 * rien. Module PUR, testé sous vitest.
 */
export function honorFirstRunPromptsReset(
  storage: PromptsResetStorage,
  serverUrl: string | null,
  subjectId: string | null,
  resetAt: string | null | undefined,
): boolean {
  if (!serverUrl) return false;
  return honorPromptsReset(storage, subjectId, resetAt, (id) => {
    const key = firstRunKey(serverUrl, id);
    storage.setItem(FIRST_RUN_SEEN_KEY, JSON.stringify(parseFirstRunSeen(storage.getItem(FIRST_RUN_SEEN_KEY)).filter((entry) => entry !== key)));
    storage.setItem(AVATAR_INVITE_SEEN_KEY, JSON.stringify(withoutSubjectInvited(parseInvitedSubjects(storage.getItem(AVATAR_INVITE_SEEN_KEY)), id)));
  });
}

export interface FirstRunPinDueInput {
  /** Une session de profil : le serveur y refuse `setOwnPin`. */
  profileSession: boolean;
  familyAvailable: boolean;
  /** Déjà proposé pendant ce lancement (« Bienvenue dans la famille »). */
  covered?: boolean;
  /** La règle `familyPinReminder` : `card` = le code manque, `startup` = le rappel n'est pas masqué. */
  reminder: { settled: boolean; card: boolean; startup: boolean };
  /** « Reproposer » honoré pour ce sujet pendant ce lancement (`honorFirstRunPromptsReset`). */
  resetHonored: boolean;
}

/**
 * L'étape « Protégez votre profil » du premier lancement est-elle due ? `null`
 * tant que la Famille et les rappels n'ont pas répondu. D'ordinaire, le rappel
 * du compte (`familyPin`) masqué la retire — « Passer » le masque. Mais une
 * demande « Reproposer » de l'administration l'emporte sur ce « Passer » :
 * honorée, l'étape revient si le code manque toujours (retour de Damien, 21/10 :
 * le code ne se reproposait jamais sur le mobile une fois passé).
 */
export function firstRunPinDue(input: FirstRunPinDueInput): boolean | null {
  if (input.profileSession || input.covered) return false;
  if (!input.familyAvailable) return false;
  if (!input.reminder.settled) return null;
  return input.resetHonored ? input.reminder.card : input.reminder.startup;
}
