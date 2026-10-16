import { AVATAR_INVITE_SEEN_KEY, honorPromptsReset, parseInvitedSubjects, withoutSubjectInvited } from "@tentacle-tv/shared";
import { forgetPinSetupOffered } from "./pinSetup";
import type { SessionStorage } from "./unpairJournal";

/**
 * « Reproposer le code PIN et la photo » sur la TV (Apple TV, Android TV) : à
 * l'OUVERTURE d'un profil, une demande du serveur (`promptsResetAt`, serveur
 * 1.30.0) plus récente que la dernière honorée sur cette TV fait oublier ses
 * deux « Plus tard » — l'étape du code (`tentacle_tv_pin_setup`) et celle de
 * la photo (`tentacle_avatar_invite_seen`). Les fenêtres du démarrage
 * (`nav/startupWindows`) les reproposent alors avec leurs règles d'éligibilité
 * inchangées : le code seulement s'il manque, jamais pour un invité ni pour le
 * compte de démonstration ; la photo seulement si elle manque. La règle est
 * celle de tous les appareils (shared `family/familyPromptsReset`).
 *
 * Appelée AVANT d'écrire le profil retenu : le registre du démarrage le lit
 * aussitôt, de façon synchrone. Un serveur d'avant ne rend pas la date : rien.
 */
export function honorTvPromptsReset(storage: SessionStorage, profile: { userId: string; promptsResetAt?: string | null }): boolean {
  return honorPromptsReset(storage, profile.userId, profile.promptsResetAt, (userId) => {
    forgetPinSetupOffered(storage, userId);
    const offered = parseInvitedSubjects(storage.getItem(AVATAR_INVITE_SEEN_KEY));
    storage.setItem(AVATAR_INVITE_SEEN_KEY, JSON.stringify(withoutSubjectInvited(offered, userId)));
  });
}
