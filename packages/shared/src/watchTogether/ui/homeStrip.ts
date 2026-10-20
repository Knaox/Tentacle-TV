/**
 * Watch Together — la bande de l'accueil, UNE ligne à la fois, en module PUR.
 * Par ordre d'importance :
 *  1. une invitation à l'affinité de MA salle à laquelle je ne participe pas ;
 *  2. ma salle joue un titre (« Lecture de groupe en cours · Rejoindre ») ;
 *  3. je suis dans une salle sans lecture (« Votre groupe · Voir le groupe ») ;
 *  4. des invitations attendent (« Invitations · N ») ;
 *  5. le compte est en séance sur un AUTRE appareil (« Rejoindre ici ? »),
 *     masquable pour la séance.
 * Rien sinon — et rien du tout porte fermée (l'hôte n'est pas monté).
 */

export type HomeStripKind = "affinity" | "playing" | "group" | "invites" | "elsewhere" | null;

export interface HomeStripInput {
  inGroup: boolean;
  groupItemId: string | null;
  /** Une séance d'affinité tourne dans la salle et je n'y participe pas (pilule non masquée). */
  affinityInvite: boolean;
  inviteCount: number;
  elsewhere: boolean;
  elsewhereDismissed: boolean;
}

export function homeStripKind(input: HomeStripInput): HomeStripKind {
  if (input.inGroup) {
    if (input.affinityInvite) return "affinity";
    return input.groupItemId ? "playing" : "group";
  }
  if (input.inviteCount > 0) return "invites";
  if (input.elsewhere && !input.elsewhereDismissed) return "elsewhere";
  return null;
}
