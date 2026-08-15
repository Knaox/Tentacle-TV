import type { AudioTrack } from "../components/player/videoPlayer.types";
import { normaliserLangue } from "./languesIso";

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
export interface PisteNative {
  readonly id?: string;
  readonly label?: string;
  readonly language?: string;
}

/** Le rang natif de chaque piste Jellyfin, dans l'ordre de la liste reçue. */
export type Appariement = ReadonlyArray<number | null>;

/** Une piste que le lecteur ne publiera jamais ne réclame aucun rang. */
export type Publiable = (piste: AudioTrack) => boolean;

export function apparier(
  natives: readonly PisteNative[],
  pistes: readonly AudioTrack[],
  publiable: Publiable = () => true,
): Appariement {
  // Le filtre passe AVANT tout le reste, et c'est lui qui rend juste le cas
  // dur — deux pistes de la même langue dont une seule est démultiplexable.
  // Sans lui, la TrueHD française réclamerait le rang de la DTS française : on
  // entendrait du DTS en croyant écouter de l'Atmos, et rien ne le dirait.
  const candidates = pistes.map((piste) => (publiable(piste) ? piste : null));

  return parIdentifiant(natives, candidates)
    ?? parLangue(natives, candidates)
    ?? parRang(natives, candidates);
}

/** Le rang natif de la piste d'index Jellyfin `voulue`, ou `null`. */
export function rangDe(
  appariement: Appariement,
  pistes: readonly AudioTrack[],
  voulue: number,
): number | null {
  const position = pistes.findIndex((piste) => piste.index === voulue);
  if (position === -1) return null;
  return appariement[position] ?? null;
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
function parIdentifiant(
  natives: readonly PisteNative[],
  candidates: ReadonlyArray<AudioTrack | null>,
): Appariement | null {
  if (natives.length === 0) return null;

  const rangParIndex = new Map<number, number>();
  for (let rang = 0; rang < natives.length; rang++) {
    const brut = natives[rang].id;
    if (brut === undefined || !/^\d+$/.test(brut)) return null;
    const index = Number(brut);
    if (rangParIndex.has(index)) return null;
    rangParIndex.set(index, rang);
  }

  const resultat = candidates.map((piste) =>
    piste ? rangParIndex.get(piste.index) ?? null : null,
  );
  // Tous les rangs natifs doivent être réclamés : s'il en reste un que personne
  // ne désigne, l'identifiant ne veut pas dire ce qu'on croit sur ce moteur.
  const attribues = new Set(resultat.filter((rang): rang is number => rang !== null));
  return attribues.size === natives.length ? resultat : null;
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
function parLangue(
  natives: readonly PisteNative[],
  candidates: ReadonlyArray<AudioTrack | null>,
): Appariement | null {
  const files = new Map<string, number[]>();
  for (let rang = 0; rang < natives.length; rang++) {
    const langue = normaliserLangue(natives[rang].language);
    if (langue === null) return null;
    const file = files.get(langue);
    if (file) file.push(rang);
    else files.set(langue, [rang]);
  }

  let apparies = 0;
  const resultat = candidates.map((piste) => {
    const langue = piste ? normaliserLangue(piste.lang) : null;
    if (langue === null) return null;
    const file = files.get(langue);
    if (!file || file.length === 0) return null;
    apparies += 1;
    return file.shift() ?? null;
  });

  return apparies === natives.length ? resultat : null;
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
function parRang(
  natives: readonly PisteNative[],
  candidates: ReadonlyArray<AudioTrack | null>,
): Appariement {
  const retenues = candidates.filter((piste): piste is AudioTrack => piste !== null);
  if (retenues.length !== natives.length) return candidates.map(() => null);

  let rang = 0;
  return candidates.map((piste) => (piste ? rang++ : null));
}
