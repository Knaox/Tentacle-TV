/**
 * Sur un téléviseur, le HLS est toujours confié au moteur.
 *
 * Le stub de hls.js répond déjà `isSupported() → false`, ce qui suffirait à
 * écarter le démultiplexeur en JavaScript. Mais la branche choisie dépendrait
 * alors de ce que `canPlayType("application/vnd.apple.mpegurl")` répond sur la
 * dalle — une réponse qui varie d'un modèle à l'autre, et dont le commentaire
 * de `videoSourceHelpers` note déjà qu'elle n'est pas fiable sur Chromium.
 *
 * En répondant oui, on rend le chemin déterministe : `<video src>` sur l'URL
 * du manifeste, décodé par la puce, sans qu'aucune sonde ne puisse en décider
 * autrement.
 */
export function preferNativeHls(): boolean {
  return true;
}
