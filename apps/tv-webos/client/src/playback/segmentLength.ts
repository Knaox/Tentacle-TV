/**
 * Imposer une longueur de segment courte, pour que la playlist cesse de mentir.
 *
 * # Le défaut
 *
 * Quand Jellyfin remuxe et sait extraire les images-clés du conteneur, il
 * calcule les frontières de segments avec une cible qui avance en temps ABSOLU
 * au lieu de repartir de la dernière coupe :
 *
 *     desiredCutTime += desiredSegmentLengthTicks;   // ComputeSegments
 *
 * Après un long intervalle sans image-clé, la cible a pris du retard, et la
 * rafale suivante produit une coupe à CHAQUE image-clé — mesuré ici : 15 % des
 * segments sous trois secondes, le plus court à 0,042 s. ffmpeg, lui, applique
 * la règle correcte : première image-clé au moins `hls_time` après sa dernière
 * coupe. Il fusionne donc ce que la playlist annonce séparément, et l'écart se
 * cumule.
 *
 * La pile média de LG prend les durées annoncées pour argent comptant. Mesuré
 * deux fois sur la dalle : le téléviseur n'arrive pas à raccorder un fragment,
 * redemande ses voisins jusqu'à vingt-sept mille fois en n'en lisant que 192 Ko,
 * et n'en repart pas.
 *
 * # Pourquoi une cible courte suffit
 *
 * Les deux règles divergent seulement quand `hls_time` dépasse l'intervalle
 * entre images-clés — c'est ce dépassement qui fait fusionner ffmpeg. En
 * dessous, chacune coupe à chaque image-clé, et les deux coïncident.
 *
 * Images-clés à 0, 3, 6, 30, 31, 32, 33, 36 :
 *
 *     six secondes → annoncé 6, 24, 1, 1, 1, 3   produit 6, 24, 6      ✗
 *     une seconde  → annoncé 3, 3, 24, 1, 1, 1, 3  produit à l'identique  ✓
 *
 * Le défaut de Jellyfin subsiste ; il devient sans conséquence. C'est le
 * contournement qu'un tiers a validé sur exactement ce symptôme
 * (jellyfin#13560, « LG webOS player hangs when resuming server-remuxed Dolby
 * Vision video »).
 *
 * # Ce que ça coûte
 *
 * Une requête par image-clé plutôt qu'une toutes les six secondes. Le débit
 * mesuré vers la dalle — 53 à 190 Mbit/s pour un flux qui en demande 27 en
 * pointe — laisse la marge, mais c'est le point à surveiller.
 */

/**
 * Longueur de segment demandée, en secondes.
 *
 * Une seconde : la valeur validée en amont, et la seule qui garantisse la
 * convergence quel que soit l'espacement des images-clés du film. Monter
 * réintroduirait le défaut sur les contenus aux images-clés rapprochées — ceux
 * de l'animation, précisément là où on l'a mesuré.
 */
export const SEGMENT_LENGTH_S = 1;

/** Un manifeste HLS, et lui seul : la lecture directe n'a pas de segments. */
function isManifest(path: string): boolean {
  return /\.m3u8$/i.test(path);
}

/**
 * L'URL avec la longueur de segment imposée — sinon l'URL telle quelle.
 *
 * On AJOUTE un paramètre que le serveur accepte (`[FromQuery] int? segmentLength`
 * sur `GetMasterHlsVideoPlaylist`), on n'en retire aucun : en retirer un fait
 * répondre 400, ce qui a été mesuré à nos dépens. Un paramètre déjà posé par
 * l'appelant est respecté.
 */
export function withShortSegments(url: string | null, seconds = SEGMENT_LENGTH_S): string | null {
  if (!url) return url;
  let parsed: URL;
  try {
    // Base factice : les URL du lecteur sont relatives au proxy (`/api/jellyfin/…`),
    // et `URL` refuse de les analyser seules. On rend la forme qu'on a reçue.
    parsed = new URL(url, "http://tentacle.invalid");
  } catch {
    return url;
  }
  if (!isManifest(parsed.pathname)) return url;
  if (parsed.searchParams.has("segmentLength")) return url;
  parsed.searchParams.set("segmentLength", String(seconds));
  return `${parsed.pathname}${parsed.search}`;
}
