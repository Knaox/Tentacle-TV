import type { ViewingStatsPerson } from "./contract";
import type { TitleTotal } from "./accumulate";
import type { PersonRef, TitleInfo } from "./dataset";
import { NOISE_SECONDS, secondsOf } from "./distributions";

export const ACTORS_MAX = 8;
export const DIRECTORS_MAX = 6;
/**
 * Au plus deux visages d'un même titre parmi ceux qui n'ont QUE lui : sinon
 * le casting d'une seule série remplit la rangée. Quelqu'un qu'on retrouve
 * dans plusieurs titres n'est jamais écarté par cette règle.
 */
const SINGLE_TITLE_FACES = 2;

interface PersonTally {
  ref: PersonRef;
  titles: number;
  seconds: number;
  /** Le titre qui lui apporte le plus de temps — pour varier les visages. */
  mainTitle: string;
  mainSeconds: number;
}

/**
 * Les visages les plus retrouvés : d'abord au nombre de TITRES distincts où
 * la personne figure — une série de quinze saisons compte pour un, un film
 * pour un —, puis au temps passé devant eux, qui ne fait que départager. Un
 * titre ne compte que s'il a vraiment été regardé : vu, ou une minute au
 * moins (une lecture d'essai n'en fait pas un).
 */
function topPeople(
  totals: readonly TitleTotal[],
  titles: Map<string, TitleInfo>,
  pick: (info: TitleInfo) => PersonRef[],
  role: ViewingStatsPerson["role"],
  max: number
): ViewingStatsPerson[] {
  const tally = new Map<number, PersonTally>();
  for (const t of totals) {
    const info = titles.get(t.titleId);
    const s = secondsOf(t);
    if (!info || (t.played === 0 && s < NOISE_SECONDS)) continue;
    const seen = new Set<number>();
    for (const ref of pick(info)) {
      if (seen.has(ref.id)) continue;
      seen.add(ref.id);
      const cur = tally.get(ref.id) ?? { ref, titles: 0, seconds: 0, mainTitle: info.id, mainSeconds: -1 };
      cur.titles += 1;
      cur.seconds += s;
      if (s > cur.mainSeconds) Object.assign(cur, { mainTitle: info.id, mainSeconds: s });
      tally.set(ref.id, cur);
    }
  }
  const singles = new Map<string, number>();
  const out: ViewingStatsPerson[] = [];
  const sorted = [...tally.values()].sort(
    (a, b) => b.titles - a.titles || b.seconds - a.seconds || a.ref.id - b.ref.id
  );
  for (const p of sorted) {
    if (p.titles === 1) {
      const used = singles.get(p.mainTitle) ?? 0;
      if (used >= SINGLE_TITLE_FACES) continue;
      singles.set(p.mainTitle, used + 1);
    }
    out.push({ tmdbId: p.ref.id, name: p.ref.name, profilePath: null, role, titles: p.titles, seconds: Math.round(p.seconds) });
    if (out.length >= max) break;
  }
  return out;
}

export function peopleOf(
  totals: readonly TitleTotal[],
  titles: Map<string, TitleInfo>
): { actors: ViewingStatsPerson[]; directors: ViewingStatsPerson[] } {
  return {
    actors: topPeople(totals, titles, (i) => i.cast, "actor", ACTORS_MAX),
    directors: topPeople(totals, titles, (i) => i.directors, "director", DIRECTORS_MAX),
  };
}
