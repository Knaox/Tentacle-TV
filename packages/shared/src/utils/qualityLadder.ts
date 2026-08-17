import type { MediaSource } from "../types/media";
import { QUALITY_PRESETS, type QualityKey, type QualityPreset } from "./mediaQuality";

/**
 * Échelle de qualité calculée d'après la source.
 *
 * # Le défaut corrigé
 *
 * La liste fixe (30 / 10 / 4 Mb/s) proposait un « 1080p 30 Mb/s » sur une
 * source 1080p à 12 Mb/s : un transcodage plus lourd que l'original, pour une
 * image strictement moins bonne, et du travail serveur pur. Le défaut est
 * ouvert et non corrigé chez Jellyfin (jellyfin-web #3669, discussion #4795).
 *
 * # La règle
 *
 * Toute qualité proposée est STRICTEMENT inférieure au débit de la source, et
 * ne dépasse jamais sa définition. « Originale » reste en tête, sans plafond.
 *
 * Les paliers s'inspirent des recommandations Apple HLS Authoring pour H.264,
 * relevés pour du réseau local — on ne cherche pas à tenir sur un lien mobile,
 * mais à alléger un serveur.
 */
const ECHELLE: readonly QualityPreset[] = [
  { key: "quality1080pHigh", bitrate: 20_000_000, width: 1920, height: 1080 },
  { key: "quality1080p",     bitrate:  8_000_000, width: 1920, height: 1080 },
  { key: "quality720p",      bitrate:  4_500_000, width: 1280, height:  720 },
  { key: "quality480p",      bitrate:  1_400_000, width:  854, height:  480 },
] as const;

/** Toujours en tête de liste : le fichier tel quel, aucun plafond. */
const ORIGINAL: QualityPreset = QUALITY_PRESETS[0];

/** Part du débit source retenue quand aucun palier fixe ne convient. */
const PART_ADAPTATIVE = 0.7;

interface DebitSource {
  bitrate: number | null;
  height: number | null;
}

/**
 * Débit et définition de la source. Le débit du conteneur prime — il inclut
 * toutes les pistes, donc ce que le réseau porte réellement — et la piste
 * vidéo sert de repli. ⚠️ La casse diffère entre les deux : `MediaSource.Bitrate`
 * et `MediaStream.BitRate`, c'est l'API Jellyfin qui est ainsi.
 */
function lireSource(source: MediaSource | null | undefined): DebitSource {
  const video = source?.MediaStreams?.find((s) => s.Type === "Video");
  const bitrate = source?.Bitrate ?? video?.BitRate ?? null;
  return {
    bitrate: bitrate && bitrate > 0 ? bitrate : null,
    height: video?.Height && video.Height > 0 ? video.Height : null,
  };
}

/**
 * Arrondit un débit à une valeur lisible : au mégabit au-dessus de 10 Mb/s,
 * au demi-mégabit en dessous. Le résultat reste sous le débit source — un
 * palier qui l'atteindrait n'aurait aucun intérêt.
 */
function arrondirDebit(bps: number, plafond: number): number {
  const mbps = bps / 1_000_000;
  const arrondi = mbps >= 10 ? Math.round(mbps) : Math.round(mbps * 2) / 2;
  const valeur = Math.max(0.5, arrondi) * 1_000_000;
  return valeur < plafond ? valeur : Math.max(500_000, Math.floor(bps));
}

/**
 * Construit la liste des qualités proposables pour une source donnée.
 *
 * Débit source inconnu → on retombe sur la liste fixe historique : mieux vaut
 * un barème approximatif qu'un sélecteur vide.
 */
export function construireEchelleQualite(source: MediaSource | null | undefined): QualityPreset[] {
  const { bitrate, height } = lireSource(source);
  if (bitrate == null) return [...QUALITY_PRESETS];

  // Un palier ne survit que s'il allège vraiment : moins de débit, et pas plus
  // de pixels que la source (aucun 1080p proposé sur une source 720p).
  const pertinents = ECHELLE.filter((p) => height == null || (p.height ?? 0) <= height);
  const candidats = pertinents.filter((p) => (p.bitrate ?? 0) < bitrate);

  // Palier adaptatif : le niveau de définition de la source est pertinent mais
  // tous ses paliers fixes sont trop lourds. Plutôt que de n'offrir qu'une
  // définition inférieure, on en fabrique un à ~70 % du débit source. Il
  // emprunte la clé du palier de BASE de son niveau — « 1080p » et non
  // « 1080p Haut », qui mentirait sur un débit revu à la baisse — donc aucune
  // clé i18n supplémentaire à inventer.
  const hauteurNiveau = pertinents[0]?.height;
  const niveauSource = pertinents.filter((p) => p.height === hauteurNiveau).pop();
  if (niveauSource && !candidats.some((p) => p.height === niveauSource.height)) {
    candidats.unshift({
      ...niveauSource,
      bitrate: arrondirDebit(bitrate * PART_ADAPTATIVE, bitrate),
    });
  }

  // `ECHELLE` est ordonnée par définition puis débit décroissants, et les
  // filtres conservent cet ordre : un simple passage suffit à écarter les
  // paliers dominés — une définition plus basse pour un débit plus élevé n'a
  // aucun sens dans un sélecteur dont le but est d'alléger.
  const monotone: QualityPreset[] = [];
  for (const p of candidats) {
    const dernier = monotone[monotone.length - 1];
    if (!dernier || (p.bitrate ?? 0) < (dernier.bitrate ?? 0)) monotone.push(p);
  }

  return [ORIGINAL, ...monotone];
}

/**
 * Le preset d'une clé DANS une échelle donnée. Retombe sur « Originale »
 * lorsque la clé n'y figure pas — c'est le garde-fou du changement de média :
 * un palier proposé sur un fichier peut ne plus l'être sur le suivant, et il
 * ne doit alors jamais rester une clé fantôme.
 */
export function trouverPreset(key: QualityKey, echelle: readonly QualityPreset[]): QualityPreset {
  return echelle.find((p) => p.key === key) ?? echelle[0] ?? ORIGINAL;
}

/** Vrai si la clé courante est encore proposée par l'échelle. */
export function presetEstPropose(key: QualityKey, echelle: readonly QualityPreset[]): boolean {
  return echelle.some((p) => p.key === key);
}

/** Le cap ne se déclenche que si le débit mesuré ne couvre pas source × 1,2 :
 *  en deçà de cette marge, la lecture directe tiendrait sans doute, mais au
 *  premier pic du fichier elle calerait. */
export const MARGE_DECLENCHEMENT = 1.2;
/** Part du débit mesuré qu'un palier peut consommer : viser 100 % laisserait
 *  zéro place aux pics d'encodage et au reste du trafic du téléviseur. */
export const MARGE_APPLICATION = 0.8;

/**
 * Palier à imposer quand la connexion MESURÉE ne porte pas le fichier.
 *
 * `null` = aucun cap : mesure absente (échec, serveur sans BitrateTest — la
 * dégradation gracieuse par excellence), débit source inconnu, ou connexion
 * assez large (≥ source × MARGE_DECLENCHEMENT). Sinon : le meilleur palier de
 * l'échelle (hors « Originale ») dont le débit tient dans mesure ×
 * MARGE_APPLICATION — et s'il n'en reste aucun, le plus bas proposé : mieux
 * vaut une image modeste qu'un lecteur qui bufferise.
 */
export function capPourDebit(
  source: MediaSource | null | undefined,
  debitMesureBps: number | null,
): QualityPreset | null {
  if (debitMesureBps == null) return null;
  const { bitrate } = lireSource(source);
  if (bitrate == null) return null;
  if (debitMesureBps >= bitrate * MARGE_DECLENCHEMENT) return null;

  const paliers = construireEchelleQualite(source).filter((p) => p.bitrate != null);
  if (paliers.length === 0) return null;
  const budget = debitMesureBps * MARGE_APPLICATION;
  return paliers.find((p) => (p.bitrate ?? 0) <= budget) ?? paliers[paliers.length - 1];
}
