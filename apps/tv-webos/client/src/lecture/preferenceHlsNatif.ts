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

/**
 * Le palier se change par relance de session — nouvelle PlaybackInfo, nouvelle
 * URL de manifeste, que la dalle recharge comme n'importe quelle source. Le
 * masquage du sélecteur sous HLS natif est une prudence de coquille de bureau
 * qui n'a pas cours ici : sans cette réponse, le téléviseur n'aurait aucun
 * réglage de qualité.
 */
export function nativeHlsSupportsQualitySwitch(): boolean {
  return true;
}
