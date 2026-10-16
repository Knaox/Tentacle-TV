import type { FamilyOverviewDto, FamilyProfileDto } from "./familyContract";
import { sessionManages } from "./familyClient";
import { canResetPrompts } from "./familyRights";

/**
 * « Reproposer le code PIN et la photo » dans Réglages › Famille (web,
 * bureau ; serveur 1.30.0, `family.promptsReset`) — le bouton d'UN profil, et
 * ce qu'il dit :
 *
 * - `pinAndPhoto` : un propriétaire ou un membre à qui il manque son code ou
 *   sa photo (les deux étapes sont reproposées ; chaque appareil ne montre que
 *   ce qui manque toujours) ;
 * - `photo` : un invité sans photo — il n'a jamais l'étape du code ;
 * - null : rien à reproposer (code et photo déjà là), ou pas le droit
 *   (`canResetPrompts` : soi-même, le propriétaire, un parent pour les invités
 *   et les mineurs, le créateur d'un invité), ou une session qui ne gère pas.
 *
 * Le serveur revérifie tout ; la capacité se lit à part (`useServerCapability`).
 */
export type PromptsResetOffer = "pinAndPhoto" | "photo";

export function promptsResetOffer(
  overview: Pick<FamilyOverviewDto, "account" | "family">,
  profile: FamilyProfileDto,
  viewerUserId: string | null | undefined,
): PromptsResetOffer | null {
  const family = overview.family;
  if (!family || !viewerUserId || !sessionManages(overview.account)) return null;
  const target = { userId: profile.userId, kind: profile.kind, parent: profile.parent === true, createdBy: profile.createdBy ?? family.owner.userId };
  if (!canResetPrompts(family.rights, target, viewerUserId)) return null;
  const noPhoto = profile.imageTag === null;
  if (profile.kind === "guest") return noPhoto ? "photo" : null;
  return noPhoto || !profile.hasPin ? "pinAndPhoto" : null;
}
