/**
 * La MATÉRIALISATION d'un verre (lot lg8) : à l'entrée, il part d'un cadre un
 * peu plus bas et un peu plus petit et s'y pose pendant que son conteneur
 * s'allume ; à la sortie, il y retourne pendant que son conteneur s'éteint.
 *
 * La page joue EXACTEMENT le même geste sur ce qu'elle dessine dans la forme
 * (glyphes, libellés) : même décalage, même échelle, même origine, même
 * durée, même Bézier — elle les envoie (`GlassMaterialize`), le natif ne
 * décide rien. D'où aucune image où le verre et son contenu divergent, au
 * délai d'acheminement près (une image).
 *
 * Pourquoi l'animateur d'AppKit et pas la page image par image : une région
 * suivie image par image a TOUJOURS une image de retard (sa position arrive
 * par IPC) ; animée des deux côtés sur la même courbe, elle part en même temps.
 * Le fondu passe par le CONTENEUR — un verre ignore son propre alpha (§ 2.5).
 */

import type { AppKitRect } from "./geometry";
import type { GlassMaterialize } from "./protocol";
import type { NativeMotion } from "./springCurve";
import type { Timers } from "./stage";

/**
 * Le cadre de départ (et d'arrivée à la sortie) d'un verre posé en `frame`
 * (points AppKit, origine en BAS) : réduit de `scale` autour de l'origine, puis
 * décalé de `rise` px CSS vers le bas de l'écran.
 */
export function materializeFrom(frame: AppKitRect, m: GlassMaterialize, zoom: number): AppKitRect {
  const width = frame.width * m.scale;
  const height = frame.height * m.scale;
  return {
    x: frame.x + (frame.width - width) * m.originX,
    // `originY` compte depuis le HAUT ; l'axe d'AppKit monte.
    y: frame.y + (frame.height - height) * (1 - m.originY) - m.rise * zoom,
    width,
    height,
  };
}

/** L'entrée : durée de la région, Bézier de la page. */
export const enterMotion = (m: GlassMaterialize, durationMs: number): NativeMotion => ({
  durationMs,
  points: [...m.enterEase] as [number, number, number, number],
});

/** La sortie : sa propre durée (plus courte), sa propre Bézier. */
export const exitMotion = (m: GlassMaterialize): NativeMotion => ({
  durationMs: m.exit,
  points: [...m.exitEase] as [number, number, number, number],
});

/**
 * Les entrées DÉCALÉES (l'ordre des formes) : un minuteur par région, annulé si
 * elle part avant d'avoir paru — jamais un geste sur une vue rendue.
 */
export class DelayedEntries {
  private readonly pending = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly timers: Timers) {}

  /**
   * Joue `start` après `delayMs` — TOUJOURS par un minuteur, même à 0 : le cadre de
   * départ doit avoir été validé par Core Animation avant l'animation (mesuré : posé
   * puis animé dans la même passe, le verre saute à destination, sans monter).
   */
  schedule(id: string, delayMs: number, start: () => void): void {
    this.cancel(id);
    this.pending.set(id, this.timers.set(() => {
      this.pending.delete(id);
      start();
    }, Math.max(0, delayMs)));
  }

  /** L'entrée n'a plus lieu d'être (la région part, la page s'en va). */
  cancel(id: string): void {
    const timer = this.pending.get(id);
    if (timer === undefined) return;
    this.timers.clear(timer);
    this.pending.delete(id);
  }

  cancelAll(): void {
    for (const timer of this.pending.values()) this.timers.clear(timer);
    this.pending.clear();
  }
}
