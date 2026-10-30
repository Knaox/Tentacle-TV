/**
 * Octave (mobile) — la PULSATION du fond du lecteur plein écran (`ambientBeat.test.ts`).
 *
 * Le REPLI quand le moteur ne mesure pas le son : Android le mesure (`LevelMeter`, la crête de `useEngineWave`
 * l'emporte alors), mais le mpv embarqué sur iOS n'a pas de filtre de mesure (`audio_level` y rend `null`), et ni
 * Jellyfin, ni MusicBrainz, ni l'extension ne donnent le BPM d'un titre. Le fond bat donc une PULSATION posée sur la POSITION
 * DE LECTURE : un temps fort tous les quatre, à un tempo propre à chaque titre (stable, tiré de sa clé, dans la
 * plage où vit l'essentiel de la pop et du rock), qui part du début du titre, suit le saut dans la barre, se fige
 * en pause et pendant une attente du réseau. Discrète exprès : elle donne le mouvement de la musique sans
 * prétendre en lire chaque coup.
 *
 * Fonctions de travail (worklets) : elles tournent sur le fil d'interface, à chaque image.
 */

/** Plage des tempos (BPM), par pas de 2. */
export const BEAT_MIN_BPM = 92;
export const BEAT_MAX_BPM = 124;
/** La montée d'un temps (part du temps) : un attaque franche mais pas un saut d'une image. */
const ATTACK = 0.06;
/** La retombée après le coup (plus grand = plus sec). */
const DECAY = 4.5;
/** Un temps faible pèse ça d'un temps fort. */
const WEAK = 0.55;
/** Au-delà de cet écart (s) entre l'horloge du fond et la position du lecteur, l'horloge se recale (saut, titre suivant). */
export const BEAT_RESYNC_S = 0.3;

/** Le tempo d'un titre (BPM) : le même titre, le même tempo, d'une écoute à l'autre. */
export function trackTempo(key: string | null | undefined): number {
  let hash = 0x811c9dc5;
  const text = key ?? "";
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const steps = (BEAT_MAX_BPM - BEAT_MIN_BPM) / 2 + 1;
  return BEAT_MIN_BPM + (hash % steps) * 2;
}

/** L'intensité du battement (0..1) à `seconds` du début du titre : un coup, puis une retombée ; le premier de quatre plus fort. */
export function beatPulse(seconds: number, bpm: number): number {
  "worklet";
  if (!(seconds >= 0) || !(bpm > 0)) return 0;
  const phase = (seconds * bpm) / 60;
  const beat = Math.floor(phase);
  const within = phase - beat;
  const accent = beat % 4 === 0 ? 1 : WEAK;
  const envelope = within < ATTACK ? within / ATTACK : Math.exp(-(within - ATTACK) * DECAY);
  return accent * envelope;
}

/** L'horloge du fond doit-elle se recaler sur la position du lecteur ? */
export function beatNeedsResync(clockSeconds: number, positionSeconds: number): boolean {
  return !Number.isFinite(clockSeconds) || Math.abs(clockSeconds - positionSeconds) > BEAT_RESYNC_S;
}
