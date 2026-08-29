import type { AudioTrack } from "../components/player/videoPlayer.types";
import { normalizeLanguage } from "./isoLanguages";

/**
 * Apparier les pistes annoncées par le serveur à celles que le lecteur publie.
 *
 * Le code d'origine faisait l'hypothèse la plus simple — le n-ième audio de
 * Jellyfin est le n-ième de `video.audioTracks` — et cette hypothèse est fausse
 * dès que le démultiplexeur en omet une. Mesuré sur une LG C3 en webOS 25, sur
 * un MKV portant un DTS-HD MA 5.1 français et un TrueHD 7.1 Atmos anglais :
 *
 *     Jellyfin  index 1 dts fra   index 2 truehd eng
 *     natif     une seule entrée, id « 1 », language « fr »
 *
 * Le TrueHD n'est démultiplexé par AUCUNE génération de webOS. Le rang 1 ne
 * désigne donc rien, et le rang 0 désigne le français — demander l'anglais
 * laissait le film en français, sans le moindre signe.
 *
 * Trois clés, de la plus sûre à la plus faible. Chacune n'est retenue que si
 * elle apparie **toute** la liste native : une correspondance partielle veut
 * dire que la clé ne convient pas à ce moteur, pas qu'il manque des pistes.
 */

/** Ce qu'une entrée de `video.audioTracks` expose, réduit à ce qu'on lit. */
export interface NativeTrack {
  readonly id?: string;
  readonly label?: string;
  readonly language?: string;
}

/** Le rang natif de chaque piste Jellyfin, dans l'ordre de la liste reçue. */
export type TrackMapping = ReadonlyArray<number | null>;

/** Une piste que le lecteur ne publiera jamais ne réclame aucun rang. */
export type Publishable = (track: AudioTrack) => boolean;

export function matchTracks(
  natives: readonly NativeTrack[],
  tracks: readonly AudioTrack[],
  publishable: Publishable = () => true,
): TrackMapping {
  // Le filtre passe AVANT tout le reste, et c'est lui qui rend juste le cas
  // dur — deux pistes de la même langue dont une seule est démultiplexable.
  // Sans lui, la TrueHD française réclamerait le rang de la DTS française : on
  // entendrait du DTS en croyant écouter de l'Atmos, et rien ne le dirait.
  const candidates = tracks.map((track) => (publishable(track) ? track : null));

  return byIdentifier(natives, candidates)
    ?? byLanguage(natives, candidates)
    ?? byRank(natives, candidates);
}

/** Le rang natif de la piste d'index Jellyfin `wanted`, ou `null`. */
export function rankOf(
  mapping: TrackMapping,
  tracks: readonly AudioTrack[],
  wanted: number,
): number | null {
  const position = tracks.findIndex((track) => track.index === wanted);
  if (position === -1) return null;
  return mapping[position] ?? null;
}

/**
 * **L'identifiant natif porte l'index de flux du conteneur** — mesuré sur
 * webOS, où la piste d'index Jellyfin 1 rend `id: "1"`. C'est une
 * correspondance exacte, pas une heuristique, et elle survit à n'importe quelle
 * omission du démultiplexeur.
 *
 * Elle n'est retenue que si CHAQUE entrée native trouve son index, sans
 * doublon. Un moteur qui numérote ses pistes audio à partir de zéro — donc un
 * compteur, pas un index de flux — échouera le plus souvent à ce test, et l'on
 * passera à la clé suivante plutôt que d'inventer une correspondance.
 */
function byIdentifier(
  natives: readonly NativeTrack[],
  candidates: ReadonlyArray<AudioTrack | null>,
): TrackMapping | null {
  if (natives.length === 0) return null;

  const rankByIndex = new Map<number, number>();
  for (let rank = 0; rank < natives.length; rank++) {
    const raw = natives[rank].id;
    if (raw === undefined || !/^\d+$/.test(raw)) return null;
    const index = Number(raw);
    if (rankByIndex.has(index)) return null;
    rankByIndex.set(index, rank);
  }

  const result = candidates.map((track) =>
    track ? rankByIndex.get(track.index) ?? null : null,
  );
  // Tous les rangs natifs doivent être réclamés : s'il en reste un que personne
  // ne désigne, l'identifiant ne veut pas dire ce qu'on croit sur ce moteur.
  const claimed = new Set(result.filter((rank): rank is number => rank !== null));
  return claimed.size === natives.length ? result : null;
}

/**
 * À défaut d'identifiant, la langue — normalisée, car les deux bouts ne
 * l'écrivent pas dans la même norme (`fra` contre `fr`).
 *
 * Une file par langue, consommée dans l'ordre d'apparition : deux pistes
 * françaises prennent les deux sorties françaises dans l'ordre du fichier.
 * C'est la seule hypothèse conservée sur l'ordre, et elle tient — le
 * démultiplexeur publie dans l'ordre du conteneur.
 */
function byLanguage(
  natives: readonly NativeTrack[],
  candidates: ReadonlyArray<AudioTrack | null>,
): TrackMapping | null {
  const queues = new Map<string, number[]>();
  for (let rank = 0; rank < natives.length; rank++) {
    const language = normalizeLanguage(natives[rank].language);
    if (language === null) return null;
    const queue = queues.get(language);
    if (queue) queue.push(rank);
    else queues.set(language, [rank]);
  }

  let matched = 0;
  const result = candidates.map((track) => {
    const language = track ? normalizeLanguage(track.lang) : null;
    if (language === null) return null;
    const queue = queues.get(language);
    if (!queue || queue.length === 0) return null;
    matched += 1;
    return queue.shift() ?? null;
  });

  return matched === natives.length ? result : null;
}

/**
 * Le repli, sous condition stricte de comptage.
 *
 * C'est exactement le comportement d'avant — le n-ième pour le n-ième — et il
 * reste juste tant que les deux listes ont la même longueur : le lecteur a
 * alors publié tout ce que le serveur annonce, l'ordre est celui du conteneur
 * des deux côtés. Dès qu'elles diffèrent, on ne devine rien : les pistes
 * excédentaires rendent `null`, ce qui déclenchera une session serveur au lieu
 * d'un silence.
 */
function byRank(
  natives: readonly NativeTrack[],
  candidates: ReadonlyArray<AudioTrack | null>,
): TrackMapping {
  const kept = candidates.filter((track): track is AudioTrack => track !== null);
  if (kept.length !== natives.length) return candidates.map(() => null);

  let rank = 0;
  return candidates.map((track) => (track ? rank++ : null));
}
