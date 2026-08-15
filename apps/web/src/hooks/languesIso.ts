/**
 * Ramener deux codes de langue à une forme comparable.
 *
 * Le besoin vient d'une mesure sur une dalle LG : pour la même piste, Jellyfin
 * annonce `fra` — de l'ISO 639-2, et plutôt la variante bibliographique que la
 * terminologique — quand `HTMLMediaElement.audioTracks` répond `fr`, de l'ISO
 * 639-1. Comparer les chaînes telles quelles ne rapproche jamais les deux, et
 * l'appariement des pistes retombe alors sur le rang, c'est-à-dire sur
 * l'hypothèse fausse que le démultiplexeur publie tout ce que le conteneur
 * porte.
 *
 * La forme retenue est **l'ISO 639-1 quand elle existe**, le code à trois
 * lettres inchangé sinon : c'est le plus petit dénominateur commun, et un code
 * absent de la table se compare quand même à lui-même.
 */

/**
 * Trois lettres → deux lettres.
 *
 * Les DEUX orthographes à trois lettres sont présentes quand elles diffèrent —
 * `fre` (bibliographique) et `fra` (terminologique) désignent la même langue, et
 * les sources ne s'accordent pas sur celle qu'elles écrivent. Jellyfin suit
 * ffmpeg, qui suit le conteneur, qui suit celui qui l'a fabriqué.
 *
 * La table s'arrête à ce qu'une médiathèque contient réellement. Une langue
 * absente n'est pas un défaut : son code à trois lettres est rendu tel quel, et
 * il se compare parfaitement à un autre code à trois lettres. Le seul cas perdu
 * serait une source en 639-1 et l'autre en 639-2 sur une langue rare.
 */
const VERS_639_1: Record<string, string> = {
  // Les vingt divergences bibliographique / terminologique de l'ISO 639-2.
  alb: "sq", sqi: "sq", arm: "hy", hye: "hy", baq: "eu", eus: "eu",
  bur: "my", mya: "my", chi: "zh", zho: "zh", cze: "cs", ces: "cs",
  dut: "nl", nld: "nl", fre: "fr", fra: "fr", geo: "ka", kat: "ka",
  ger: "de", deu: "de", gre: "el", ell: "el", ice: "is", isl: "is",
  mac: "mk", mkd: "mk", mao: "mi", mri: "mi", may: "ms", msa: "ms",
  per: "fa", fas: "fa", rum: "ro", ron: "ro", slo: "sk", slk: "sk",
  tib: "bo", bod: "bo", wel: "cy", cym: "cy",
  // Le reste de ce qu'on croise sur une piste audio ou un sous-titre.
  ara: "ar", ben: "bn", bul: "bg", cat: "ca", dan: "da", est: "et",
  fin: "fi", heb: "he", hin: "hi", hrv: "hr", hun: "hu", ind: "id",
  ita: "it", jpn: "ja", kor: "ko", lav: "lv", lit: "lt", nno: "nn",
  nob: "nb", nor: "no", pol: "pl", por: "pt", rus: "ru", slv: "sl",
  spa: "es", srp: "sr", swe: "sv", tam: "ta", tel: "te", tha: "th",
  tur: "tr", ukr: "uk", urd: "ur", vie: "vi", eng: "en",
};

/** Codes qui disent « on ne sait pas » : jamais une clé d'appariement. */
const INDETERMINES = new Set(["und", "mul", "zxx", "qaa", "mis"]);

/**
 * La forme comparable d'un code de langue, ou `null` s'il n'en porte aucune.
 *
 * Rendre `null` plutôt qu'une chaîne vide est délibéré : deux pistes sans
 * langue ne doivent pas s'apparier ENTRE ELLES sous prétexte qu'elles partagent
 * la même absence. C'est à l'ordre du conteneur de trancher ces cas-là.
 */
export function normaliserLangue(brute: string | null | undefined): string | null {
  if (!brute) return null;
  // `fr-FR`, `pt_BR`, `zh-Hans` : la sous-étiquette qualifie une région ou une
  // écriture, jamais la langue. La garder ferait de `fr` et `fr-FR` deux pistes
  // étrangères l'une à l'autre.
  const nu = brute.trim().toLowerCase().split(/[-_]/)[0];
  if (nu.length === 0 || INDETERMINES.has(nu)) return null;
  return VERS_639_1[nu] ?? nu;
}

/** Les deux codes désignent-ils la même langue ? */
export function memeLangue(
  gauche: string | null | undefined,
  droite: string | null | undefined,
): boolean {
  const a = normaliserLangue(gauche);
  const b = normaliserLangue(droite);
  return a !== null && a === b;
}
