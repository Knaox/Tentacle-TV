import type { MediaSource } from "../types/media";
import { QUALITY_PRESETS, type QualityKey, type QualityPreset } from "./mediaQuality";
import { TRANSCODE_TIERS, codecEfficiency, frameRateFactor, reservedAudioBitrate } from "./transcodeTarget";

/**
 * Échelle de qualité calculée d'après la source.
 *
 * # Les défauts corrigés
 *
 * La liste fixe (30 / 10 / 4 Mb/s) proposait un « 1080p 30 Mb/s » sur une
 * source 1080p à 12 Mb/s : un transcodage plus lourd que l'original, pour une
 * image strictement moins bonne (jellyfin-web #3669, discussion #4795).
 *
 * La version suivante taillait un palier « adaptatif » à 70 % du débit de la
 * source, quelle que soit sa définition. Un épisode 1080p en HEVC à 2 Mb/s y
 * recevait un « 1080p » à 1,5 Mb/s : en H.264, soit l'équivalent de 0,9 Mb/s
 * du HEVC d'origine, que Jellyfin servait en 540p et qui partait en blocs à la
 * première scène d'action (banc du 03/10 : VMAF des 5 % pires images à 32).
 *
 * # La règle
 *
 * Un palier n'existe que s'il ALLÈGE vraiment le flux (au plus 80 % du débit
 * de la source) sans descendre sous le plancher de sa définition
 * (`TRANSCODE_TIERS`). Son débit vidéo est le plus bas de trois valeurs : sa
 * cible, ce que vaut la source en H.264, et ce budget d'allègement. Un palier
 * qui ne tiendrait pas l'action à sa définition n'est pas proposé : celui du
 * dessous, plus doux mais net, l'est. « Originale » reste en tête, sans plafond.
 */

/** Toujours en tête de liste : le fichier tel quel, aucun plafond. */
const ORIGINAL: QualityPreset = QUALITY_PRESETS[0];

/** Un palier doit alléger le flux d'au moins 20 % — sinon « Originale » fait mieux, et plus léger. */
export const RELIEF_SHARE = 0.8;

/** Pas d'arrondi des débits proposés : lisibles au menu, jamais arrondis vers le haut. */
const ROUNDING = 100_000;

interface SourceFacts {
  /** Débit total du conteneur — ce que le réseau porte réellement. */
  total: number | null;
  /** Débit de la piste vidéo ; le total quand Jellyfin ne le donne pas (estimation haute). */
  video: number | null;
  codec: string | null;
  height: number | null;
  fps: number | null;
}

const positive = (value: number | null | undefined): number | null => (value && value > 0 ? value : null);

/**
 * Ce que l'échelle lit de la source. ⚠️ La casse diffère entre les deux débits :
 * `MediaSource.Bitrate` et `MediaStream.BitRate`, c'est l'API Jellyfin qui est ainsi.
 */
function readSource(source: MediaSource | null | undefined): SourceFacts {
  const video = source?.MediaStreams?.find((s) => s.Type === "Video");
  const total = positive(source?.Bitrate) ?? positive(video?.BitRate);
  return {
    total,
    video: positive(video?.BitRate) ?? total,
    codec: video?.Codec ?? null,
    height: positive(video?.Height),
    fps: positive(video?.RealFrameRate) ?? positive(video?.AverageFrameRate),
  };
}

/**
 * Construit la liste des qualités proposables pour une source donnée.
 *
 * Débit source inconnu → la liste de repli (les cibles de `TRANSCODE_TIERS`) :
 * mieux vaut un barème approximatif qu'un sélecteur vide. Une source déjà plus
 * légère que tout palier sain n'a que « Originale » : il n'y a rien à alléger.
 */
export function buildQualityLadder(source: MediaSource | null | undefined): QualityPreset[] {
  const facts = readSource(source);
  if (facts.total == null) return [...QUALITY_PRESETS];

  const boost = frameRateFactor(facts.fps);
  const sourceAsH264 = (facts.video ?? facts.total) / codecEfficiency(facts.codec);
  const tiers: QualityPreset[] = [];
  for (const tier of TRANSCODE_TIERS) {
    // Jamais plus de pixels que la source : aucun 1080p sur une source 720p.
    if (facts.height != null && tier.height > facts.height) continue;
    const audio = reservedAudioBitrate(tier.height);
    const wanted = Math.min(tier.nominal * boost, sourceAsH264, facts.total * RELIEF_SHARE - audio);
    const video = Math.floor(wanted / ROUNDING) * ROUNDING;
    if (video < tier.floor * boost) continue;
    // Des débits strictement décroissants : un palier qui ne coûte pas moins
    // que le précédent n'a aucun sens dans un menu dont le but est d'alléger.
    const previous = tiers[tiers.length - 1];
    if (previous && video + audio >= (previous.bitrate ?? 0)) continue;
    tiers.push({ key: tier.key, bitrate: video + audio, width: tier.width, height: tier.height });
  }
  return [ORIGINAL, ...tiers];
}

/**
 * Le preset d'une clé DANS une échelle donnée. Retombe sur « Originale »
 * lorsque la clé n'y figure pas — c'est le garde-fou du changement de média :
 * un palier proposé sur un fichier peut ne plus l'être sur le suivant, et il
 * ne doit alors jamais rester une clé fantôme.
 */
export function findPreset(key: QualityKey, ladder: readonly QualityPreset[]): QualityPreset {
  return ladder.find((p) => p.key === key) ?? ladder[0] ?? ORIGINAL;
}

/** Vrai si la clé courante est encore proposée par l'échelle. */
export function isPresetOffered(key: QualityKey, ladder: readonly QualityPreset[]): boolean {
  return ladder.some((p) => p.key === key);
}

/** Le cap ne se déclenche que si le débit mesuré ne couvre pas source × 1,2 :
 *  en deçà de cette marge, la lecture directe tiendrait sans doute, mais au
 *  premier pic du fichier elle calerait. */
export const TRIGGER_MARGIN = 1.2;
/** Part du débit mesuré qu'un palier peut consommer : viser 100 % laisserait
 *  zéro place aux pics d'encodage et au reste du trafic du téléviseur. */
export const APPLY_MARGIN = 0.8;

/**
 * Palier à imposer quand la connexion MESURÉE ne porte pas le fichier.
 *
 * `null` = aucun cap : mesure absente (échec, serveur sans BitrateTest — la
 * dégradation gracieuse par excellence), débit source inconnu, connexion
 * assez large (≥ source × TRIGGER_MARGIN), ou aucun palier plus léger que la
 * source.
 *
 * Sinon, la plus haute définition de l'échelle que le budget (mesure ×
 * APPLY_MARGIN) porte AU-DESSUS de son plancher, avec tout ce budget : le
 * débit s'adapte à la connexion à l'intérieur d'une définition, il ne saute
 * pas d'un palier fixe au suivant. Sans cela, un lien un peu court pour le
 * 720p du menu tombait d'une définition entière alors qu'un 720p à son plancher tenait. Si
 * rien ne tient, le palier le plus bas : mieux vaut une image modeste qu'un
 * lecteur qui bufferise.
 */
export function capForBitrate(
  source: MediaSource | null | undefined,
  measuredBps: number | null,
): QualityPreset | null {
  if (measuredBps == null) return null;
  const { total, fps } = readSource(source);
  if (total == null) return null;
  if (measuredBps >= total * TRIGGER_MARGIN) return null;

  const tiers = buildQualityLadder(source).filter((p) => p.bitrate != null);
  if (tiers.length === 0) return null;
  const budget = measuredBps * APPLY_MARGIN;
  const boost = frameRateFactor(fps);
  for (const preset of tiers) {
    const floor = (TRANSCODE_TIERS.find((t) => t.key === preset.key)?.floor ?? 0) * boost;
    const audio = reservedAudioBitrate(preset.height);
    const video = Math.floor((Math.min(preset.bitrate ?? 0, budget) - audio) / ROUNDING) * ROUNDING;
    if (video >= floor) return { ...preset, bitrate: video + audio };
  }
  return tiers[tiers.length - 1];
}
