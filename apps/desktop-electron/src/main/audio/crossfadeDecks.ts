/**
 * La TRANSITION DOUCE du bureau : deux instances mpv (`DeckPair`), devant lesquelles la page ne voit qu'UN
 * moteur. Une seule joue d'ordinaire — celle de DEVANT, dont les évènements sont ceux du moteur. Un fondu de
 * `D` s entre A (devant) et B :
 * 1. le suivant que la page dit à fondre (`crossfadeMs`) n'entre pas dans la liste de A : il est chargé EN PAUSE
 *    sur la réserve, sa courbe d'entrée dans les options de son fichier (`crossfadeFilter.ts`) ;
 * 2. deux secondes avant `durée − D`, la courbe de sortie est posée sur A (`af-command`) et une minuterie lance B
 *    à l'instant voulu (`crossfadeTiming.ts`) ; à mi-fondu, B passe devant (`advanced`) ; au bout, A s'arrête.
 * Les courbes suivent le flux de chaque instance : une pause gèle les deux ensemble. Tout titre qui ne se fond
 * pas (même album dans l'ordre, fin de file, transition coupée, mode exclusif) suit le chemin d'avant : la
 * liste de mpv, sans blanc. Un geste, transition allumée : le titre quitté sort en 150 ms (`DeckPair.gesture`).
 */

import type {
  AudioBridgeCapabilities, AudioBridgeControl, AudioBridgeEvent, AudioBridgeOutput, AudioBridgeSource, AudioBridgeStart, AudioBridgeTrack,
} from "./audioBridgeContract";
import type { EngineConfig } from "./audioEngine";
import { fadeOutExpr, type FadedSource } from "./crossfadeFilter";
import { DeckPair, TAIL_MS, type Deck } from "./crossfadePair";
import { DeckFade, type Pending } from "./crossfadeRun";
import { armDecision } from "./crossfadeTiming";

const MAX_FADE_S = 12;

export class CrossfadeDecks {
  private readonly pair: DeckPair;
  private crossfadeMs = 0;
  private exclusive = false;
  private paused = false;
  /** La clé du titre de l'instance devant (le `fromKey` d'un fondu). */
  private frontKey: string | null = null;
  private pending: Pending | null = null;
  /** `pending` est chargé, en pause, sur la réserve. */
  private prepared = false;
  private fade: DeckFade<Deck> | null = null;
  private armTimer: ReturnType<typeof setTimeout> | null = null;
  /** Un geste pendant un fondu : le nouveau titre attend qu'une instance ait fini de sortir. */
  private delayed: ReturnType<typeof setTimeout> | null = null;
  /** Le titre entré par un fondu : sa courbe d'entrée vit dans son fichier — un saut avant sa fin le relit sans elle. */
  private fadedIn: (Pending & { deck: Deck }) | null = null;
  private readonly deferredSwaps = new Map<string, AudioBridgeSource>();

  constructor(config: EngineConfig, private readonly emit: (event: AudioBridgeEvent) => void) {
    this.pair = new DeckPair(config, (deck, event) => this.onDeck(deck, event));
    this.pair.onCutDone = () => this.preparePending(); // la réserve sortait (un geste) : le suivant s'y charge maintenant
  }

  private get front(): Deck {
    return this.pair.front;
  }

  private available = (): boolean => this.crossfadeMs > 0 && !this.exclusive;
  private ensureBack = (): void => (this.available() ? this.pair.ensureBack(() => this.preparePending()) : undefined);

  async start(start: AudioBridgeStart): Promise<AudioBridgeCapabilities> {
    this.exclusive = start.exclusive;
    const capabilities = await this.pair.start(start);
    this.ensureBack();
    return capabilities;
  }

  private onDeck(d: Deck, event: AudioBridgeEvent): void {
    if (event.type === "needSource") {
      if (d === this.front || (this.prepared && d === this.pair.back) || this.fade?.to === d) this.emit(event);
      return;
    }
    if (d !== this.front) return;
    if (event.type === "advanced") [this.frontKey, this.fadedIn] = [event.toKey, null];
    if (event.type !== "state") return this.emit(event);
    // Le titre qui part finit avant la mi-fondu (durée annoncée trop longue) : le suivant passe devant.
    if (this.fade !== null && !this.fade.passedMid && event.state.status === "ended") return this.passMid();
    this.emit(event);
    if (this.fade === null) this.arm();
  }

  /** Le fondu s'arme près de la fin du titre devant, si le suivant est prêt sur la réserve. */
  private arm(): void {
    const [p, back] = [this.pending, this.pair.back];
    if (p === null || back === null || !this.prepared || this.armTimer !== null || this.paused || !this.pair.isChained(this.front)) return;
    const decision = armDecision(this.front.timeline(), p.fadeS);
    if (decision.kind === "wait") return;
    if (decision.kind === "late") return this.giveUp();
    // Le suivant n'a pas fini de se charger : on réessaie au prochain état (le délai « late » tranche).
    if (!back.timeline().loaded) return;
    this.front.setGain(fadeOutExpr(decision.startS, p.fadeS));
    this.armTimer = setTimeout(() => this.startFade(), decision.delayMs);
  }

  private clearArm(): void {
    if (this.armTimer === null) return;
    clearTimeout(this.armTimer);
    this.armTimer = null;
    this.front.setGain("1");
  }

  /** Trop tard pour fondre (ou plus de transition) : le suivant passe à l'instance devant, enchaînement d'avant. */
  private giveUp(): void {
    const p = this.pending;
    if (p === null) return;
    this.dropPrepared();
    this.pending = null;
    this.front.setNext(p.track, p.source);
  }

  private startFade(): void {
    this.armTimer = null;
    const [from, to, p] = [this.front, this.pair.back, this.pending];
    if (to === null || p === null) return;
    [this.pending, this.prepared] = [null, false];
    to.control({ action: "resume" });
    this.fade = new DeckFade(from, to, p, this.frontKey, { mid: () => this.passMid(), end: () => this.finish() }, TAIL_MS);
  }

  /** Mi-fondu : le titre qui arrive passe devant. */
  private passMid(): void {
    const f = this.fade;
    if (f === null || f.passedMid) return;
    f.passedMid = true;
    this.pair.bringForward(f.to);
    this.frontKey = f.pending.track.trackKey;
    this.fadedIn = { ...f.pending, deck: f.to };
    this.emit({ type: "advanced", fromKey: f.fromKey, toKey: f.pending.track.trackKey });
  }

  private finish(): void {
    const f = this.fade;
    if (f === null) return;
    this.passMid();
    f.cancel();
    this.fade = null;
    f.from.control({ action: "stop" });
    for (const [key, source] of this.deferredSwaps) this.swap(key, source);
    this.deferredSwaps.clear();
    this.preparePending();
  }

  private preparePending(): void {
    const [p, back] = [this.pending, this.pair.back];
    if (p === null || back === null || !this.pair.backReady || this.fade !== null || this.prepared || this.pair.isCutting(back)) return;
    this.pair.chain(back);
    const faded: FadedSource = { ...p.source, fadeInS: p.fadeS };
    back.play(p.track, faded, 0, true);
    this.prepared = true;
  }

  private dropPrepared(): void {
    if (!this.prepared) return;
    this.prepared = false;
    this.pair.back?.control({ action: "stop" });
  }

  /** Un fondu interrompu (saut, autre suivant) : celui qui arrivait se tait ; `keep` le recharge prêt. */
  private abortFade(keep: boolean): void {
    const f = this.fade;
    if (f === null) return;
    f.cancel();
    this.fade = null;
    if (f.passedMid) return this.pair.cutOut(f.from);
    f.to.control({ action: "stop" });
    this.front.setGain("1");
    if (!keep) return;
    this.pending = f.pending;
    this.preparePending();
  }

  play(track: AudioBridgeTrack, source: AudioBridgeSource, startMs: number): void {
    this.clearArm();
    this.dropPrepared();
    this.cancelDelayed();
    [this.pending, this.fadedIn, this.paused, this.frontKey] = [null, null, false, track.trackKey];
    const fading = this.fade;
    this.fade = null;
    fading?.cancel();
    const { deck, delayMs } = this.pair.gesture(fading, this.available());
    if (delayMs === 0) return this.startOn(deck, track, source, startMs);
    this.delayed = setTimeout(() => this.startOn(deck, track, source, startMs), delayMs);
  }

  private startOn(deck: Deck, track: AudioBridgeTrack, source: AudioBridgeSource, startMs: number): void {
    this.delayed = null;
    this.pair.cancelCut(deck);
    if (this.available()) this.pair.chain(deck);
    deck.play(track, source, startMs);
  }

  private cancelDelayed(): void {
    if (this.delayed !== null) clearTimeout(this.delayed);
    this.delayed = null;
  }

  setNext(track: AudioBridgeTrack | null, source: AudioBridgeSource | null, crossfadeMs = 0): void {
    const f = this.fade;
    if (f !== null && !f.passedMid && track?.trackKey === f.pending.track.trackKey) return;
    if (f !== null && !f.passedMid) this.abortFade(false);
    this.clearArm();
    const fadeS = Math.min(MAX_FADE_S, crossfadeMs / 1000);
    const p = this.pending;
    // Le titre qui joue sans gain de fondu (transition allumée en pleine écoute) : l'enchaînement d'avant, jamais un blanc.
    if (track !== null && source !== null && fadeS > 0 && this.available() && this.pair.back !== null && this.pair.isChained(this.front)) {
      if (p !== null && p.track.trackKey === track.trackKey && p.source.url === source.url && p.fadeS === fadeS) return;
      this.dropPrepared();
      this.pending = { track, source, fadeS };
      this.front.setNext(null, null);
      this.preparePending();
      return;
    }
    this.dropPrepared();
    this.pending = null;
    this.front.setNext(track, source);
  }

  swap(trackKey: string, source: AudioBridgeSource): void {
    const f = this.fade;
    // Pendant un fondu, la bascule attend sa fin : la courbe d'un titre ne se perd pas dans une relecture.
    if (f !== null && (trackKey === f.pending.track.trackKey || trackKey === f.fromKey)) return void this.deferredSwaps.set(trackKey, source);
    if (this.pending?.track.trackKey === trackKey) {
      this.pending = { ...this.pending, source };
      this.dropPrepared();
      return this.preparePending();
    }
    if (this.fadedIn?.track.trackKey === trackKey) this.fadedIn = { ...this.fadedIn, source };
    this.front.swap(trackKey, source);
  }

  control(c: AudioBridgeControl): void {
    switch (c.action) {
      case "pause":
        this.paused = true;
        this.clearArm();
        this.fade?.pause();
        return this.front.control(c);
      case "resume":
        this.paused = false;
        this.fade?.resume();
        return this.front.control(c);
      case "stop":
        this.clearArm();
        this.cancelDelayed();
        this.dropPrepared();
        this.pending = null;
        this.fade?.cancel();
        this.fade = null;
        for (const d of this.pair.all()) d.control(c);
        return;
      case "seek":
        return this.seek(c.value);
      case "crossfade":
        return this.setCrossfade(c.value);
      default:
        this.pair.apply(c);
    }
  }

  private seek(valueMs: number): void {
    if (this.fade !== null) this.abortFade(!this.fade.passedMid);
    this.clearArm();
    const fi = this.fadedIn;
    // Un saut dans la courbe d'entrée d'un titre entré par un fondu : relu à la cible, sans elle.
    if (fi !== null && fi.deck === this.front && valueMs / 1000 < fi.fadeS) {
      this.fadedIn = null;
      return this.front.play(fi.track, fi.source, valueMs, this.paused);
    }
    this.front.control({ action: "seek", value: valueMs });
  }

  private setCrossfade(ms: number): void {
    this.crossfadeMs = Math.max(0, Math.min(MAX_FADE_S * 1000, ms));
    if (this.available()) return this.ensureBack();
    this.giveUp();
    if (this.fade === null) this.pair.releaseBack();
  }

  listOutputs = (): Promise<AudioBridgeOutput[]> => this.front.listOutputs();

  async setOutput(deviceId: string | null, exclusive: boolean): Promise<void> {
    const changed = exclusive !== this.exclusive;
    this.exclusive = exclusive;
    if (changed) {
      // La chaîne suit le mode exclusif (`audioEngineOutput.ts`) : le gain du fondu repart à la prochaine lecture.
      if (this.fade !== null) this.abortFade(false);
      this.giveUp();
      this.pair.forgetChains();
    }
    await Promise.all(this.pair.all().map((d) => d.setOutput(deviceId, exclusive)));
    if (this.available()) this.ensureBack();
    else if (this.fade === null) this.pair.releaseBack();
  }

  sourceCut = (url: string): void => this.pair.all().forEach((d) => d.sourceCut(url));
  level = (): Promise<number | null> => this.front.level();
  readProperty = (name: string): Promise<string | null> => this.front.readProperty(name);
  benchDecks = (): Deck[] => this.pair.all(); // le banc lit chaque instance (`bench/audio/crossfadeScenarios.mts`)

  async dispose(): Promise<void> {
    this.clearArm();
    this.cancelDelayed();
    this.fade?.cancel();
    await this.pair.dispose();
  }
}
