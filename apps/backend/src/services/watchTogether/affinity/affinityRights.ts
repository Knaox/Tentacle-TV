import { isItemVisibleTo } from "../../itemAccess/itemVisibility";
import type { WtAffinityMatchDto, WtAffinityStateDto } from "../protocol";

/**
 * Affinité face aux droits des membres (docs/DROITS-UTILISATEURS.md § 9.5.4).
 *
 * Un match est UNE proposition faite à toute la salle : la première réponse
 * vaut pour tous, et « Regarder ensemble » mène au lecteur du groupe, que
 * `wt:setItem` refuse dès qu'un membre ne voit pas le titre (§ 7.2). Une
 * proposition ne part donc que si TOUS les membres de la salle voient son
 * titre ; sinon elle ne part vers personne — ni dans l'état, ni comme match
 * qui vient d'arriver (`matchKeys`), ni comme match écarté, défait ou lancé
 * (`match`) — et elle ne se lance pas. Elle reste dans la séance : le départ
 * du membre qui ne la voit pas, ou sa politique rouverte, la rend à la
 * diffusion suivante.
 *
 * Les cartes, elles, ne vont qu'à celui qui swipe, rejugées pour LUI à chaque
 * lot (`affinityCards.ts`). Ce sont les MATCHS qui débordent sur la salle —
 * faits avant l'arrivée d'un membre, ou avant que sa politique ne change.
 *
 * Jellyfin tranche titre par titre (`isItemVisibleTo` : 30 s, fermé à
 * l'échec) : une politique illisible ne laisse passer aucune proposition.
 */

type Titled = Pick<WtAffinityMatchDto, "key" | "itemId">;

/** Les clés des matchs dont TOUS ces comptes voient le titre. */
export async function keysSeenByAll(memberIds: readonly string[], matches: readonly Titled[]): Promise<Set<string>> {
  const items = new Map(matches.map((match) => [match.key, match.itemId] as const));
  const seen = new Set<string>();
  await Promise.all([...items].map(async ([key, itemId]) => {
    const verdicts = await Promise.all(memberIds.map((userId) => isItemVisibleTo(userId, itemId)));
    if (verdicts.every(Boolean)) seen.add(key);
  }));
  return seen;
}

/** L'état tel que la salle le reçoit : les seules propositions que tous voient. */
export function sharedState(state: WtAffinityStateDto, seen: ReadonlySet<string>): WtAffinityStateDto {
  return { ...state, proposals: state.proposals.filter((match) => seen.has(match.key)) };
}
