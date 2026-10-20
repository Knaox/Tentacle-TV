/**
 * Watch Together — le PORT lecteur, tel que le moteur de synchro partagé le
 * commande (forme de `apps/web/src/watchTogether/playerTransport.ts`).
 *
 * Copie PROVISOIRE de la seule interface : l'extraction du moteur vers les
 * paquets partagés (wt-socle) la publie sous le nom `WtPlayerPort` (api-client) ; à la reprise de sa branche, ce
 * fichier ne fait plus que la ré-exporter. Positions en secondes « film »
 * (0 → durée), jamais en position de flux.
 */
export interface WtPlayerPort {
  precision?: "fine" | "coarse";
  play(): void;
  pause(): void;
  seekTo(seconds: number): void;
  getPositionSeconds(): number;
  isPaused(): boolean;
  setRate(rate: number): void;
  cancelAutoNext?(): void;
  isMediaReady?(): boolean;
  isSeeking?(): boolean;
  isSettledAt?(targetSeconds: number): boolean;
  primeGesture?(): void;
}
