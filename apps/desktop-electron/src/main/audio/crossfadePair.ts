/**
 * Les deux instances de la transition douce (`crossfadeDecks.ts`) : celle de DEVANT (ses évènements sont ceux
 * du moteur) et celle de RÉSERVE, née seulement transition allumée hors mode exclusif. Ici, ce qui ne dépend
 * pas d'un fondu : naître et partir, porter le gain du fondu dans sa chaîne, recevoir les mêmes réglages et la
 * même sortie, et la SORTIE COURTE d'un titre quitté par un geste.
 */

import type { AudioBridgeCapabilities, AudioBridgeControl, AudioBridgeEvent, AudioBridgeStart } from "./audioBridgeContract";
import { NativeAudioEngine, type EngineConfig } from "./audioEngine";
import { CUT_STEP_MS, cutSteps } from "./crossfadeFilter";
import type { DeckFade } from "./crossfadeRun";

export type Deck = NativeAudioEngine;

export const MANUAL_CUT_MS = 150;
/** Après la dernière courbe, le temps que le tampon de la sortie se vide avant d'arrêter l'instance qui part. */
export const TAIL_MS = 500;

export class DeckPair {
  front: Deck;
  back: Deck | null = null;
  backReady = false;
  private startArgs: AudioBridgeStart | null = null;
  /** Les instances dont la chaîne porte le gain du fondu. */
  private readonly chained = new Set<Deck>();
  /** Volume, sourdine, ReplayGain : redits à la seconde instance à sa naissance. */
  private readonly settings = new Map<string, AudioBridgeControl>();
  private readonly cuts = new Map<Deck, Array<ReturnType<typeof setTimeout>>>();

  constructor(private readonly config: EngineConfig, private readonly onEvent: (deck: Deck, event: AudioBridgeEvent) => void) {
    this.front = this.make();
  }

  private make(): Deck {
    const d: Deck = new NativeAudioEngine(this.config, (event) => this.onEvent(d, event));
    return d;
  }

  all = (): Deck[] => (this.back === null ? [this.front] : [this.front, this.back]);

  /** `deck` passe devant ; l'autre devient la réserve. */
  bringForward(deck: Deck): void {
    if (deck === this.front) return;
    [this.back, this.front] = [this.front, deck];
  }

  async start(start: AudioBridgeStart): Promise<AudioBridgeCapabilities> {
    this.startArgs = start;
    const capabilities = await this.front.start(start);
    if (this.back !== null && this.backReady) await this.back.start(start);
    return capabilities;
  }

  /** La réserve, née à la demande (`ready` une fois prête à charger). */
  ensureBack(ready: () => void): void {
    if (this.back !== null || this.startArgs === null) return;
    const back = this.make();
    this.back = back;
    back.start(this.startArgs).then(() => {
      if (this.back !== back) return;
      for (const c of this.settings.values()) back.control(c);
      this.chain(back);
      this.backReady = true;
      ready();
    }, (error: unknown) => {
      console.warn("[audio] seconde instance de la transition douce refusée", error);
      if (this.back === back) this.back = null;
      void back.dispose();
    });
  }

  /** Plus de transition : la réserve s'en va (sa sortie avec). */
  releaseBack(): void {
    const back = this.back;
    if (back === null) return;
    this.cancelCut(back);
    [this.back, this.backReady] = [null, false];
    this.chained.delete(back);
    void back.dispose();
  }

  /** La chaîne de `deck` porte le gain du fondu (posée une fois, instance au repos ou titre remplacé). */
  chain(deck: Deck): void {
    if (this.chained.has(deck)) return;
    deck.setChain("1");
    this.chained.add(deck);
  }

  isChained = (deck: Deck): boolean => this.chained.has(deck);
  /** Le mode exclusif a changé : les chaînes ont été refaites sans le gain (`audioEngineOutput.ts`). */
  forgetChains = (): void => this.chained.clear();

  /** Un réglage (volume, sourdine, ReplayGain) : aux deux, et gardé pour une réserve à naître. */
  apply(c: AudioBridgeControl): void {
    this.settings.set(c.action, c);
    for (const d of this.all()) d.control(c);
  }

  /**
   * Un GESTE (un titre choisi) : où part le nouveau titre, et dans combien de temps. Transition allumée, le titre
   * quitté sort en 150 ms pendant que le nouveau part sur l'autre instance ; pendant un fondu, les deux sonnent :
   * tous deux sortent, et le nouveau attend qu'une instance ait fini. Coupée : comme avant, même instance.
   */
  gesture(fading: DeckFade<Deck> | null, crossfade: boolean): { deck: Deck; delayMs: number } {
    if (fading !== null) {
      this.cutOut(fading.from);
      this.cutOut(fading.to);
      this.bringForward(fading.to);
      return { deck: fading.to, delayMs: MANUAL_CUT_MS + TAIL_MS };
    }
    const back = this.back;
    if (crossfade && this.backReady && back !== null && this.isChained(this.front) && this.front.timeline().playing) {
      const leaving = this.front;
      this.bringForward(back);
      this.cutOut(leaving);
    } else back?.control({ action: "stop" });
    return { deck: this.front, delayMs: 0 };
  }

  /** La sortie courte d'un titre quitté : des gains pas à pas, puis l'arrêt une fois la sortie vidée. */
  cutOut(deck: Deck): void {
    this.cancelCut(deck);
    const timers = cutSteps(MANUAL_CUT_MS).map((g, i) => setTimeout(() => deck.setGain(g.toFixed(4)), i * CUT_STEP_MS));
    timers.push(setTimeout(() => {
      this.cuts.delete(deck);
      if (deck !== this.front) deck.control({ action: "stop" });
    }, MANUAL_CUT_MS + TAIL_MS));
    this.cuts.set(deck, timers);
  }

  /** `deck` reprend du service : sa sortie courte en cours n'a plus rien à faire. */
  cancelCut(deck: Deck): void {
    for (const t of this.cuts.get(deck) ?? []) clearTimeout(t);
    this.cuts.delete(deck);
  }

  async dispose(): Promise<void> {
    for (const d of [...this.cuts.keys()]) this.cancelCut(d);
    await Promise.all(this.all().map((d) => d.dispose()));
  }
}
