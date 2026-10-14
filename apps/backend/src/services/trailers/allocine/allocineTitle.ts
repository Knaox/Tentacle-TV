/* ------------------------------------------------------------------ */
/*  Le titre d'une vidéo AlloCiné, lu — pur                             */
/*                                                                     */
/*  AlloCiné publie ses bandes-annonces sur sa chaîne Dailymotion avec */
/*  des titres NORMÉS (mesuré le 2026-10-14) :                         */
/*    « Rick et Morty - saison 6 Bande-annonce VF »                    */
/*    « Rick et Morty - saison 5 Bande-annonce (2) VOST »              */
/*    « Rick et Morty - saison 4 partie 2 Bande-annonce VOST »         */
/*    « Dune : Deuxième Partie Bande-annonce (3) VO »                  */
/*    « Rick et Morty - saison 9 Teaser VO STFR »                      */
/*  La description est vide et les mots-clés répètent le titre : tout  */
/*  se lit là. Seules les bandes-annonces et les teasers comptent —    */
/*  un EXTRAIT, une interview, un « Faux Raccord », un bonus, un clip, */
/*  un épisode (« - saison 5 - épisode 11 Teaser ») n'en sont pas.     */
/* ------------------------------------------------------------------ */

/** La version annoncée par AlloCiné : VF, VOSTFR (VOST, VO STFR), ou VO sans sous-titres. */
export type AllocineVersion = "vf" | "vostfr" | "vo";

export interface AllocineTitle {
  /** Le nom du titre tel qu'écrit (« Rick et Morty », « Dune : Deuxième Partie »). */
  show: string;
  season?: number;
  part?: number;
  kind: "trailer" | "teaser";
  /** Le rang dans la série de bandes-annonces (« (2) »), absent pour la première. */
  index?: number;
  version: AllocineVersion;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Les entités HTML d'un titre de l'API (`&#039;`, `&amp;`, `&#x27;`) rendues en texte. */
export function decodeEntities(raw: string): string {
  return raw.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/*
 * <nom>[ - saison N[ partie P]] <Bande-annonce|Teaser>[ (I)] <VF|VOST|VOSTFR|VO STFR|VO>
 * Le nom est pris au plus court : la saison, si elle est là, lui échappe.
 */
const PATTERN =
  /^(?<show>.+?)(?:\s+-\s+saison\s+(?<season>\d{1,3})(?:\s+partie\s+(?<part>\d{1,2}))?)?\s+(?<kind>bande-annonce|teaser)(?:\s+\((?<index>\d{1,2})\))?\s+(?<version>vo\s*stfr|vostfr|vost|vf|vo)$/i;

function versionOf(raw: string): AllocineVersion {
  const plain = raw.toLowerCase().replace(/\s+/g, "");
  if (plain === "vf") return "vf";
  return plain === "vo" ? "vo" : "vostfr";
}

/** Le titre lu, ou `null` : ce n'est pas une bande-annonce ni un teaser au format d'AlloCiné. */
export function parseAllocineTitle(raw: string): AllocineTitle | null {
  const title = decodeEntities(raw).replace(/[\s\u200b]+/g, " ").trim();
  const match = PATTERN.exec(title);
  const groups = match?.groups;
  if (!groups) return null;
  const show = groups.show.trim();
  // Un épisode (« - saison 5 - épisode 11 ») ou un nom qui garde une saison n'est pas un titre.
  if (!show || / - (?:saison|épisode|episode)\b/i.test(show)) return null;
  const parsed: AllocineTitle = {
    show,
    kind: groups.kind.toLowerCase() === "teaser" ? "teaser" : "trailer",
    version: versionOf(groups.version),
  };
  if (groups.season) parsed.season = Number(groups.season);
  if (groups.part) parsed.part = Number(groups.part);
  if (groups.index) parsed.index = Number(groups.index);
  return parsed;
}
