/**
 * Verrou global "lecture en cours" pour empêcher tout logout pendant qu'un
 * média joue sur la TV.
 *
 * Pourquoi : si le backend Tentacle redémarre alors que l'utilisateur regarde
 * un film, n'importe quelle erreur réseau transitoire pourrait théoriquement
 * déclencher une cascade qui éjecte vers Login. C'est inacceptable. On installe
 * un invariant : tant que `isPlayingMedia()` retourne true, `doLogout` est
 * bloqué — on attend la fin de la lecture pour redemander une auth si besoin.
 *
 * Le PlayerScreen est responsable d'appeler setPlayingMedia(true) au mount et
 * (false) au unmount via un useEffect.
 */

let _playing = false;

export function setPlayingMedia(playing: boolean): void {
  _playing = playing;
}

export function isPlayingMedia(): boolean {
  return _playing;
}
