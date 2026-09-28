/**
 * Le générique d'une fiche, prêt à afficher — pur, commun aux trois clients.
 *
 * Jellyfin rend `People` à plat : une ligne par crédit. Une réalisatrice qui
 * a aussi écrit le film y figure deux fois, un acteur aux deux rôles aussi. La
 * fiche montre UNE carte par personne : l'équipe d'abord (ses métiers
 * réunis), puis la distribution (ses personnages réunis).
 */

import { normalizeCreditRole, type CreditRole } from "./filmography";

/** Un crédit Jellyfin, tel que `MediaItem.People` le porte. */
export interface CastPerson {
  Id: string;
  Name: string;
  Role?: string;
  Type: string;
  PrimaryImageTag?: string;
}

export interface CastCredit {
  id: string;
  name: string;
  imageTag: string | null;
  /** Le crédit par lequel la carte ouvre la personne (`?role=`). */
  linkRole: string;
  /** Équipe : ses métiers sur ce titre, dans l'ordre du générique. */
  crewRoles: CreditRole[];
  /** Distribution : le ou les personnages. */
  character: string | null;
}

/** Les métiers montrés, et combien de personnes au plus pour chacun. */
const CREW_LIMITS: ReadonlyArray<[CreditRole, number]> = [
  ["Director", 4],
  ["Creator", 3],
  ["Writer", 3],
  ["Producer", 2],
  ["Composer", 2],
];

export function castCredits(
  people: readonly CastPerson[] | null | undefined,
  maxActors = 30,
): { crew: CastCredit[]; actors: CastCredit[] } {
  const list = people ?? [];
  const crew = new Map<string, CastCredit>();
  for (const [role, limit] of CREW_LIMITS) {
    let taken = 0;
    for (const p of list) {
      if (taken >= limit) break;
      if (normalizeCreditRole(p.Type) !== role || role === "Actor") continue;
      taken++;
      const known = crew.get(p.Id);
      if (known) {
        if (!known.crewRoles.includes(role)) known.crewRoles.push(role);
        continue;
      }
      crew.set(p.Id, {
        id: p.Id, name: p.Name, imageTag: p.PrimaryImageTag ?? null, linkRole: p.Type, crewRoles: [role], character: null,
      });
    }
  }

  const actors = new Map<string, CastCredit>();
  for (const p of list) {
    if (normalizeCreditRole(p.Type) !== "Actor") continue;
    const character = p.Role?.trim() || null;
    const known = actors.get(p.Id);
    if (known) {
      if (character && known.character !== character && !known.character?.split(" / ").includes(character)) {
        known.character = known.character ? `${known.character} / ${character}` : character;
      }
      continue;
    }
    if (actors.size >= maxActors) continue;
    actors.set(p.Id, {
      id: p.Id, name: p.Name, imageTag: p.PrimaryImageTag ?? null, linkRole: "Actor", crewRoles: [], character,
    });
  }
  return { crew: [...crew.values()], actors: [...actors.values()] };
}
