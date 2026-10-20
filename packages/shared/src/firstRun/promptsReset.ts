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
