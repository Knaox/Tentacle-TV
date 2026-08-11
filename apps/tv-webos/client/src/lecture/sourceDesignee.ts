/**
 * Retirer la source désignée d'un manifeste — pour obtenir un découpage régulier.
 *
 * # Le défaut qu'on contourne
 *
 * Jellyfin découpe les manifestes HLS de deux façons. En temps normal, des
 * segments de longueur égale. Mais quand il REMUXE une vidéo et qu'il sait
 * extraire les images-clés du conteneur, il prend un autre chemin —
 * `DynamicHlsPlaylistGenerator.ComputeSegments` — dont la cible de coupe avance
 * en temps ABSOLU au lieu de repartir de la dernière coupe :
 *
 *     desiredCutTime += desiredSegmentLengthTicks;   // et non : = keyframe + …
 *
 * Après un long intervalle sans image-clé, la cible a pris du retard, et la
 * rafale d'images-clés suivante produit une rafale de micro-segments — mesuré
 * sur ce serveur : 15 % des segments sous trois secondes, le plus court à
 * 0,042 s. ffmpeg, lui, coupe correctement : il produit MOINS de segments que la
 * playlist n'en annonce, et l'écart se cumule.
 *
 * En lecture linéaire depuis le début, le lecteur enchaîne et ne consulte jamais
 * les positions annoncées : le mensonge est inoffensif. Ailleurs il est fatal.
 * Mesuré deux fois sur la dalle : le téléviseur détient un segment, n'arrive pas
 * à y raccorder le suivant, et redemande ses deux voisins sans fin — plus de neuf
 * cents fois, en ne lisant que cent quatre-vingt-douze kilo-octets à chaque
 * tentative. La lecture s'arrête pile sur une frontière de segment, alors que son
 * propre tampon annonce dix secondes au-delà, et n'en repart jamais seule.
 *
 * # Pourquoi retirer `MediaSourceId` suffit
 *
 * Ce chemin n'est pris que si les trois conditions tiennent :
 *
 *     request.IsRemuxingVideo && request.MediaSourceId is not null && TryExtractKeyframes(…)
 *
 * On ne peut rien contre la première — c'est notre cas — ni contre la troisième,
 * qui dépend d'un réglage du serveur que nos utilisateurs ne maîtrisent pas. La
 * deuxième, elle, est dans l'URL que nous demandons.
 *
 * # Ce que ça coûte, et la garde
 *
 * Sans elle, Jellyfin retombe sur la source par DÉFAUT de l'item. Sur un film à
 * plusieurs versions — la 4K et la 1080p du même titre — il remuxerait l'autre
 * fichier : durée différente, index de pistes différents, et les index audio et
 * sous-titres que porte l'URL désigneraient les pistes du mauvais fichier.
 * Silencieux, et faux dans les deux dimensions à la fois.
 *
 * On ne retire donc rien dès qu'il y a plus d'une source, et rien non plus hors
 * des manifestes : en lecture directe, l'URL désigne le fichier à servir.
 */

/** Le paramètre ne vaut d'être retiré que sur un manifeste HLS. */
function estManifeste(chemin: string): boolean {
  return /\.m3u8$/i.test(chemin);
}

/**
 * L'URL sans `MediaSourceId`, quand c'est sûr — sinon l'URL telle quelle.
 *
 * `nombreSources` vient de la réponse `PlaybackInfo` : à un, la source désignée
 * est une redondance ; au-delà, c'est le seul moyen de lire la bonne.
 */
export function sansSourceDesignee(url: string | null, nombreSources: number): string | null {
  if (!url || nombreSources !== 1) return url;
  // Base factice : les URL du lecteur sont relatives au proxy (`/api/jellyfin/…`),
  // et `URL` refuse de les analyser seules. On rend la même forme qu'on a reçue.
  let analysee: URL;
  try {
    analysee = new URL(url, "http://tentacle.invalid");
  } catch {
    return url;
  }
  if (!estManifeste(analysee.pathname)) return url;
  if (!analysee.searchParams.has("MediaSourceId")) return url;
  analysee.searchParams.delete("MediaSourceId");
  return `${analysee.pathname}${analysee.search}`;
}
