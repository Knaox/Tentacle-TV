/**
 * Une certification TMDB (pays + chaîne) ramenée sur l'ÉCHELLE de Jellyfin — règle
 * pure. Carnet : docs/DROITS-UTILISATEURS.md § 5.2.
 *
 * L'échelle de Jellyfin 10.11 (`LocalizationManager.GetRatingScore`, relu sur la
 * source v10.11.11) : un SCORE = l'âge minimal (un entier est pris tel quel comme
 * âge), un `subScore` qui départage à score égal, 1000 = adulte (XXX), 1001 = interdit.
 * Ses tables par pays associent les chaînes d'un système de classification à ce
 * score. Jellyfin n'en expose qu'UNE par l'API (`/Localization/ParentalRatings` : celle
 * de son pays de métadonnées) — elle passe en tête (`live`). Pour les autres pays,
 * ces tables-ci, écrites par Tentacle d'après les systèmes officiels, sur la même
 * échelle (les valeurs de US, FR, GB et DE sont celles de Jellyfin).
 *
 * Règle de sûreté : une chaîne qu'aucune table ne reconnaît et qui ne porte pas un
 * âge lisible est INCONNUE (null) — jamais devinée. Un « exempté » ou « non classé »
 * est inconnu lui aussi.
 */

export interface RatingScore {
  score: number;
  subScore: number | null;
}

export interface LiveRatingEntry {
  name: string;
  score: number;
  subScore: number | null;
}

const ADULT = 1000;
const BANNED = 1001;

/** `chaîne=score` ou `chaîne=score.sous-score`, séparées par `|`. Pays en majuscules (ISO 3166-1). */
const TABLES: Record<string, string> = {
  US:
    "G=0.0|TV-G=0.0|TV-Y=0.0|Approved=0.0|TV-Y7=7.0|TV-Y7-FV=7.1|PG=10.0|TV-PG=10.0|PG-13=13.0|TV-14=14.0|" +
    "R=17.0|NC-17=17.1|TV-MA=17.1|TV-X=18.0|TV-AO=18.0|X=1000|XXX=1000",
  FR: "U=0|TP=0|Tous Publics=0|Public Averti=0|10=10|12=12|16=16|18=18|X=1000",
  GB: "U=0.0|Uc=0.0|E=0.0|PG=8.0|12A=12.0|12=12.1|15=15.3|18=18.1|R18=1000.0",
  DE: "0=0|6=6|12=12|16=16|18=18",
  AT: "0=0|6=6|10=10|12=12|14=14|16=16|18=18",
  CH: "0=0|6=6|7=7|10=10|12=12|14=14|16=16|18=18",
  CA: "G=0|PG=10|14A=14|18A=18|R=18|A=18|C=0|C8=8|14+=14|18+=18",
  AU: "G=0|P=0|C=0|PG=10|M=15|MA15+=15|AV15+=15|R18+=18|X18+=1000|RC=1001",
  NZ: "G=0|PG=10|M=16|R13=13|RP13=13|R15=15|R16=16|RP16=16|R18=18|RP18=18|R=18",
  IE: "G=0|PG=10|12A=12|12=12|15A=15|15=15|16=16|18=18",
  ES: "A=0|APTA=0|Ai=0|TP=0|7=7|7i=7|12=12|13=13|16=16|18=18|X=1000",
  IT: "T=0|6+=6|VM14=14|14+=14|VM18=18|18+=18",
  PT: "M/3=3|M/4=4|M/6=6|M/12=12|M/14=14|M/16=16|M/18=18|P=1000",
  NL: "AL=0|6=6|9=9|12=12|14=14|16=16|18=18",
  BE: "AL=0|KT=0|E=0|6=6|9=9|12=12|14=14|16=16|KNT=16|ENA=16|18=18",
  SE: "Btl=0|7=7|11=11|15=15",
  DK: "A=0|7=7|11=11|15=15",
  NO: "A=0|6=6|9=9|12=12|15=15|18=18",
  FI: "S=0|K-7=7|K-12=12|K-16=16|K-18=18|KK=1001",
  BR: "L=0|ER=0|10=10|12=12|14=14|16=16|18=18",
  MX: "AA=0|A=0|B=12|B-15=15|C=18|D=1000",
  JP: "G=0|PG12=12|R15+=15|R18+=18",
  KR: "ALL=0|All=0|12=12|15=15|18=18|19=19|Restricted Screening=1000",
  IN: "U=0|UA=12|U/A=12|UA 7+=7|UA 13+=13|UA 16+=16|A=18|S=1000",
  RU: "0+=0|6+=6|12+=12|16+=16|18+=18",
  PH: "G=0|PG=10|R-13=13|R-16=16|R-18=18|X=1000",
  SG: "G=0|PG=10|PG13=13|NC16=16|M18=18|R21=21",
  HK: "I=0|IIA=0|IIB=15|III=18",
};

function parseTable(table: string): Map<string, RatingScore> {
  const map = new Map<string, RatingScore>();
  for (const entry of table.split("|")) {
    const at = entry.lastIndexOf("=");
    const [score, sub] = entry.slice(at + 1).split(".");
    map.set(entry.slice(0, at).toLowerCase(), { score: Number(score), subScore: sub === undefined ? null : Number(sub) });
  }
  return map;
}

const PARSED = new Map(Object.entries(TABLES).map(([country, table]) => [country, parseTable(table)]));

/** Les chaînes qui ne disent RIEN (Jellyfin : `_unratedValues`), plus les exemptions. */
const UNRATED = new Set(["", "n/a", "na", "nr", "unrated", "not rated", "exempt", "e/exempt", "tbc", "-", "?"]);

/** Un âge lisible : « 12 », « 12+ », « -12 », « FSK 16 », « K-12 », « M/16 », « NC16 », « R21 ». */
const AGE = /^(?:[a-z]{1,4}[-/ ]?)?-?(\d{1,2})\+?$/i;

/** Ce que Jellyfin ferait d'un âge lisible (un entier est un âge). Pur. */
export function ageOf(certification: string): number | null {
  const match = AGE.exec(certification.trim());
  if (!match) return null;
  const age = Number(match[1]);
  return age <= 21 ? age : null;
}

/**
 * Le score d'UNE certification, ou null si elle n'en dit rien d'exploitable :
 * 1. la table VIVANTE de Jellyfin si le pays est son pays de métadonnées ;
 * 2. la table de ce pays ;
 * 3. un âge lisible, ou la table américaine (le repli de Jellyfin) : la plus stricte.
 */
export function scoreCertification(
  country: string,
  certification: string,
  context: { metadataCountry: string | null; live: readonly LiveRatingEntry[] },
): RatingScore | null {
  const cert = certification.trim();
  const key = cert.toLowerCase();
  if (UNRATED.has(key)) return null;
  const cc = country.toUpperCase();
  if (context.metadataCountry && cc === context.metadataCountry.toUpperCase()) {
    const live = context.live.find((entry) => {
      const name = entry.name.toLowerCase();
      return name === key || name === `${cc.toLowerCase()}-${key}`;
    });
    if (live) return { score: live.score, subScore: live.subScore };
  }
  const own = PARSED.get(cc)?.get(key);
  if (own) return own;
  const age = ageOf(cert);
  // Les deux derniers recours se départagent au plus strict (« NC-17 » : 17, sous-score 1).
  return stricter(age === null ? null : { score: age, subScore: null }, PARSED.get("US")?.get(key) ?? null);
}

/** Le plus strict de deux scores (le plus haut). */
export function stricter(a: RatingScore | null, b: RatingScore | null): RatingScore | null {
  if (!a) return b;
  if (!b) return a;
  if (a.score !== b.score) return a.score > b.score ? a : b;
  return (a.subScore ?? 0) >= (b.subScore ?? 0) ? a : b;
}

export const RATING_ADULT = ADULT;
export const RATING_BANNED = BANNED;
