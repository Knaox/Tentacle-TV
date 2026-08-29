/**
 * « Vu » ET « à reprendre à 3 min » : la contradiction que Jellyfin laisse
 * derrière lui, et comment on la défait.
 *
 * # Ce qui se passe
 *
 * Jellyfin marque un média `Played` dès qu'on dépasse ~90 % de sa durée. Il ne
 * le DÉMARQUE jamais : un arrêt ultérieur qui rapporte une position plus tôt
 * n'écrit que le point de reprise (`UpdatePlayState` ne touche `Played` que dans
 * la branche « fin du média »). Terminer un épisode, revenir au début, puis
 * quitter laisse donc l'item dans un état que rien ne produit autrement — vu, et
 * pourtant repris quelque part.
 *
 * Et cet état se voit : « Reprendre la lecture » écarte les items `Played`
 * (`utils/mediaFilters.ts`), la fiche affiche la coche. L'épisode disparaît de
 * l'accueil alors que sa reprise, elle, est bien là.
 *
 * # Pourquoi la lecture-modification-écriture, et pas un simple DELETE
 *
 * ⚠️ `DELETE /Users/{id}/PlayedItems/{itemId}` démarque, mais il REMET LA
 * POSITION À ZÉRO — il efface précisément ce qu'on veut sauver.
 *
 * On passe donc par `UserItems/{itemId}/UserData`, et on renvoie l'objet ENTIER
 * qu'on vient de lire, avec le seul `Played` retourné. Le DTO d'écriture porte
 * exactement les mêmes champs que celui de lecture (`Rating`, `IsFavorite`,
 * `PlayCount`, `Likes`…) : renvoyer un objet partiel ferait dépendre le résultat
 * de la façon dont le serveur fusionne, ce qu'on ne veut pas parier.
 */

/** Ce qu'on demande au client — pas la classe entière, pour que ça se teste. */
export interface UserDataClient {
  fetch<T>(path: string, init?: RequestInit): Promise<T>;
}

/** L'objet que Jellyfin rend ET accepte sur cette route. */
type UserDataPayload = Record<string, unknown> & {
  Played?: boolean;
  PlaybackPositionTicks?: number;
};

/**
 * Défait la contradiction si elle existe.
 *
 * Renvoie la position conservée (en ticks Jellyfin) quand quelque chose a été
 * corrigé, `null` sinon — y compris quand le réseau échoue : ce correctif est un
 * confort, jamais une raison de faire échouer une sortie de lecture.
 */
export async function clearPlayedWhenResumable(
  client: UserDataClient,
  itemId: string,
): Promise<number | null> {
  const path = `/UserItems/${itemId}/UserData`;
  const data = await client.fetch<UserDataPayload>(path).catch(() => null);
  if (!data) return null;

  const ticks = typeof data.PlaybackPositionTicks === "number" ? data.PlaybackPositionTicks : 0;
  // Les deux conditions, et rien d'autre : une fin normale rend `Played` avec
  // une position à zéro, et c'est un état parfaitement juste qu'on ne touche pas.
  if (data.Played !== true || ticks <= 0) return null;

  const written = await client
    .fetch(path, { method: "POST", body: JSON.stringify({ ...data, Played: false }) })
    .then(() => true)
    .catch(() => false);
  return written ? ticks : null;
}
