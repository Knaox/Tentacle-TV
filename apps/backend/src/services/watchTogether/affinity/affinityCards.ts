import { getContentPolicy, limitsLibraries } from "../../contentPolicy";
import { isItemVisibleTo } from "../../itemAccess/itemVisibility";
import { nextCards } from "./affinitySession";
import type { AffinityCard, AffinitySession } from "./affinityTypes";

/**
 * Affinité — les cartes servies à un participant, rejugées à chaque lot
 * (docs/DROITS-UTILISATEURS.md § 9.5.4).
 *
 * La pile n'est jugée qu'UNE fois : l'intersection des bibliothèques de la
 * salle au lancement, ou ce qu'un membre arrivé après peut lire à son entrée
 * (relevé servi jusqu'à dix minutes). Une politique qui se resserre en cours
 * de séance ne la rejuge pas : chaque lot repose donc la question à Jellyfin,
 * carte par carte (`isItemVisibleTo` : 30 s, fermé à l'échec), pour un compte
 * que sa politique RESTREINT ou dont les bibliothèques sont BORNÉES — une
 * politique illisible est les deux. Un compte libre voit toute la
 * bibliothèque : rien de plus que sa politique en cache.
 *
 * Une carte cachée est retenue chez le participant (`hidden`) : ni resservie,
 * ni redemandée. Le lot se complète avec les suivantes jusqu'à `limit` : un
 * lot vide dit au client que la pile est finie.
 */
export async function judgedCards(
  session: AffinitySession,
  userId: string,
  limit: number,
  exclude: ReadonlySet<string>,
): Promise<AffinityCard[]> {
  const policy = await getContentPolicy(userId);
  if (!policy.restricted && !limitsLibraries(policy)) return nextCards(session, userId, limit, exclude);
  const out: AffinityCard[] = [];
  const asked = new Set(exclude);
  while (out.length < limit) {
    // Parti pendant le jugement : `nextCards` ne rend plus rien, la boucle s'arrête.
    const me = session.participants.get(userId);
    const batch = nextCards(session, userId, limit, asked);
    if (!me || batch.length === 0) break;
    const verdicts = await Promise.all(batch.map((card) => isItemVisibleTo(userId, card.jellyfinItemId)));
    batch.forEach((card, index) => {
      asked.add(card.key);
      if (!verdicts[index]) me.hidden.add(card.key);
      else if (out.length < limit) out.push(card);
    });
  }
  return out;
}
