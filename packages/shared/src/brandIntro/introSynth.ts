/**
 * La SYNTHÈSE du « ta-dum » (Web Audio), sur n'importe quel contexte : un
 * `AudioContext` pour le jouer (web, bureau), un `OfflineAudioContext` pour en
 * dériver le fichier des plateformes natives. Le site en est la source
 * (`introSound.js`, `createVoices`) ; seule différence voulue, les bruits
 * (vague, réverbération) suivent un tirage FIXE : le fichier dérivé se
 * régénère à l'identique.
 *
 * Aucun appel ici au chargement : rien de cette page ne tourne sur un
 * téléviseur ni un téléphone, qui n'ont pas Web Audio.
 */
import { INTRO_SCORE, INTRO_SOUND_TA_OFFSET_S, TA_DUM_GAP_S, seededRandom, type ThumpSpec } from "./introScore";

/** Réponse impulsionnelle sombre : du bruit lissé qui s'éteint, après un pré-délai. */
function impulse(ctx: BaseAudioContext, random: () => number): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * INTRO_SCORE.reverb.seconds);
  const predelay = Math.floor(rate * INTRO_SCORE.reverb.predelay);
  const buffer = ctx.createBuffer(2, length, rate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    let smooth = 0;
    for (let i = predelay; i < length; i += 1) {
      smooth = smooth * 0.55 + (random() * 2 - 1) * 0.45;
      data[i] = smooth * (1 - i / length) ** 2.8;
    }
  }
  return buffer;
}

/** Bruit brun (le grondement d'une vague), normalisé. */
function brownNoise(ctx: BaseAudioContext, seconds: number, random: () => number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  let peak = 0;
  for (let i = 0; i < length; i += 1) {
    last = (last + 0.02 * (random() * 2 - 1)) / 1.02;
    data[i] = last;
    peak = Math.max(peak, Math.abs(last));
  }
  for (let i = 0; i < length; i += 1) data[i] = (data[i] as number) / (peak || 1);
  return buffer;
}

/**
 * Programme tout le son sur `ctx`, le « ta » à `ta` secondes (temps du
 * contexte), le « dum » `TA_DUM_GAP_S` après ; rend le gain maître (pour
 * l'éteindre en douceur).
 */
export function scheduleIntroSound(ctx: BaseAudioContext, ta: number): GainNode {
  const random = seededRandom(INTRO_SCORE.noiseSeed);
  const master = new GainNode(ctx, { gain: INTRO_SCORE.master });
  const compressor = new DynamicsCompressorNode(ctx, INTRO_SCORE.compressor);
  master.connect(compressor).connect(ctx.destination);
  const reverb = new ConvolverNode(ctx, { buffer: impulse(ctx, random) });
  reverb.connect(new GainNode(ctx, { gain: INTRO_SCORE.reverb.wet })).connect(master);

  /** Un nœud de sortie : une part sèche, une part dans la réverbération. */
  const out = (dry: number, send: number): GainNode => {
    const node = new GainNode(ctx, { gain: dry });
    node.connect(master);
    node.connect(new GainNode(ctx, { gain: send })).connect(reverb);
    return node;
  };

  // Une enveloppe qui part de presque rien : jamais de clic.
  const envelope = (param: AudioParam, at: number, peak: number, attack: number, decay: number) => {
    param.setValueAtTime(0.0001, at);
    param.exponentialRampToValueAtTime(peak, at + attack);
    param.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  };

  // Un coup rond : fondamentale, harmoniques 2 et 3 (pour les petits
  // haut-parleurs), un sous-grave, une attaque feutrée — une mailloche dans du coton.
  const thump = (at: number, spec: ThumpSpec) => {
    const tone = new BiquadFilterNode(ctx, { type: "lowpass", frequency: 950, Q: 0.4 });
    tone.connect(out(0.9, 0.35));
    const mallet = new AudioBufferSourceNode(ctx, { buffer: brownNoise(ctx, 0.2, random) });
    const malletAmp = new GainNode(ctx, { gain: 0 });
    envelope(malletAmp.gain, at, spec.felt, 0.004, 0.07);
    mallet.connect(new BiquadFilterNode(ctx, { type: "lowpass", frequency: 1400, Q: 0.5 })).connect(malletAmp).connect(tone);
    mallet.start(at);
    mallet.stop(at + 0.15);
    const voices: [OscillatorType, number, number][] = [
      ["sine", 1, spec.gain],
      ["triangle", 2, spec.gain * 0.3],
      ["sine", 3, spec.gain * 0.12],
      ["sine", 0.5, spec.sub],
    ];
    for (const [type, ratio, level] of voices) {
      if (!level) continue;
      const osc = new OscillatorNode(ctx, { type, frequency: spec.from * ratio });
      osc.frequency.setValueAtTime(spec.from * ratio, at);
      osc.frequency.exponentialRampToValueAtTime(spec.to * ratio, at + 0.16);
      const amp = new GainNode(ctx, { gain: 0 });
      envelope(amp.gain, at, level, 0.018, spec.decay);
      osc.connect(amp).connect(tone);
      osc.start(at);
      osc.stop(at + spec.decay + 0.1);
    }
  };

  const bloom = (at: number) => {
    const tone = new BiquadFilterNode(ctx, { type: "lowpass", frequency: 380, Q: 0.5 });
    tone.frequency.setValueAtTime(380, at);
    tone.frequency.exponentialRampToValueAtTime(2200, at + 0.9);
    tone.frequency.exponentialRampToValueAtTime(650, at + 3.2);
    tone.connect(out(0.75, 0.6));
    for (const [frequency, level] of INTRO_SCORE.chord) {
      // Deux voix par note, légèrement désaccordées : la chaleur d'un chœur.
      for (const [type, cents, share] of [["sine", -5, 1], ["triangle", 6, 0.45]] as const) {
        const osc = new OscillatorNode(ctx, { type, frequency, detune: cents });
        const amp = new GainNode(ctx, { gain: 0 });
        amp.gain.setValueAtTime(0.0001, at);
        amp.gain.exponentialRampToValueAtTime(level * share, at + 0.5);
        amp.gain.setTargetAtTime(0.0001, at + 0.9, 0.7);
        osc.connect(amp).connect(tone);
        osc.start(at);
        osc.stop(at + INTRO_SCORE.length);
      }
    }
  };

  const wave = (at: number) => {
    const source = new AudioBufferSourceNode(ctx, { buffer: brownNoise(ctx, 4, random) });
    const tone = new BiquadFilterNode(ctx, { type: "lowpass", frequency: 240, Q: 0.7 });
    tone.frequency.setValueAtTime(240, at);
    tone.frequency.exponentialRampToValueAtTime(1300, at + 1.1);
    tone.frequency.exponentialRampToValueAtTime(260, at + 3.6);
    const amp = new GainNode(ctx, { gain: 0 });
    amp.gain.setValueAtTime(0.0001, at);
    amp.gain.exponentialRampToValueAtTime(0.2, at + 1.1);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + 3.8);
    const pan = new StereoPannerNode(ctx, { pan: -0.45 });
    pan.pan.setValueAtTime(-0.45, at);
    pan.pan.linearRampToValueAtTime(0.45, at + 3.6);
    source.connect(tone).connect(amp).connect(pan).connect(out(0.8, 0.3));
    source.start(at);
    source.stop(at + 4);
  };

  const bubbles = (at: number) => {
    const draw = seededRandom(INTRO_SCORE.bubbles.seed);
    for (let index = 0; index < INTRO_SCORE.bubbles.count; index += 1) {
      const when = at + 0.35 + draw() * 1.7;
      const from = 420 + draw() * 420;
      const osc = new OscillatorNode(ctx, { type: "sine", frequency: from });
      osc.frequency.setValueAtTime(from, when);
      osc.frequency.exponentialRampToValueAtTime(from * 1.8, when + 0.07);
      const amp = new GainNode(ctx, { gain: 0 });
      envelope(amp.gain, when, 0.018 + draw() * 0.02, 0.006, 0.1);
      osc.connect(amp).connect(new StereoPannerNode(ctx, { pan: draw() * 1.2 - 0.6 })).connect(out(0.3, 0.8));
      osc.start(when);
      osc.stop(when + 0.2);
    }
  };

  const dum = ta + TA_DUM_GAP_S;
  wave(ta - INTRO_SOUND_TA_OFFSET_S);
  thump(ta, INTRO_SCORE.ta);
  thump(dum, INTRO_SCORE.dum);
  bloom(dum);
  bubbles(dum);
  return master;
}

/** La durée d'un rendu complet : de la vague au silence. */
export const INTRO_SOUND_SECONDS = INTRO_SOUND_TA_OFFSET_S + INTRO_SCORE.length;
