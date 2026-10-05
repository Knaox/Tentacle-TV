import { ExpiredPairingRedesign } from "../redesignWiring/overlays/noticesRedesign";

/**
 * Bandeau discret « jumelage expiré » : la sauvegarde de progression est en
 * pause (playstate impossible via le proxy — clé admin sans contexte user,
 * Jellyfin 10.11) ; sans ce bandeau, la position se perdait en silence.
 * Informatif, non focusable ; disparaît seul dès qu'un token frais revient.
 * Le signal est commun aux deux téléviseurs : `usePairingExpired`.
 */
export function PairingExpiredBanner() {
  return <ExpiredPairingRedesign />;
}
