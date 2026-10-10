/**
 * QUAND recaler la fenêtre de mpv : un recalage par image après une rafale
 * d'évènements, et une veille permanente.
 *
 * Sorti de `macosSurface.ts`, qui sait COMMENT recaler : les deux horloges et
 * leur arrêt sont un métier à part, et la surface dépassait 300 lignes.
 */

/** Un recalage par image suffit — voir `schedule`. */
const ALIGN_MS = 16;
/**
 * Et une VEILLE : les évènements d'Electron ne suffisent pas.
 *
 * ⚠️ macOS repositionne la fenêtre de mpv de son propre chef, sans qu'aucun
 * `resize`, `move` ni `enter-full-screen` ne parvienne à Electron — mesuré de
 * l'extérieur, 110 ms après un calage parfait. Une réaction aux évènements ne
 * peut PAS l'attraper. Coût : deux lectures de rectangle par tick, en lecture.
 */
const WATCHDOG_MS = 100;

export class AlignClock {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private watchdog: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly align: () => void) {}

  /**
   * Un recalage par image, pas un par évènement : attraper un bord de fenêtre à
   * la souris tire des dizaines de `resize` par seconde. Front descendant — le
   * premier évènement arme le minuteur, les suivants sont absorbés, et le calage
   * a lieu juste après le dernier.
   */
  schedule(): void {
    if (this.timer !== null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.align();
    }, ALIGN_MS);
  }

  /** Arme la veille — une fois la fenêtre trouvée : avant, rien à surveiller. */
  watch(): void {
    if (this.watchdog === null) this.watchdog = setInterval(() => this.align(), WATCHDOG_MS);
  }

  /** Désarme la veille seule. Idempotent. */
  stopWatch(): void {
    if (this.watchdog !== null) clearInterval(this.watchdog);
    this.watchdog = null;
  }

  /** Désarme les deux. Idempotent. */
  stop(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.stopWatch();
  }
}
