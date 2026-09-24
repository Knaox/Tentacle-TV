/**
 * Les petites lignes des résultats de recherche : ce qu'est un titre (« Série ·
 * 2008–2013 · ★ 9,5 ») et pourquoi il est là (« Avec Tom Hanks »). Partagé par
 * l'omnibox et la page de résultats — les deux doivent dire la même chose.
 */

import type { TFunction } from "i18next";
import type { SearchMatch, SearchMediaItem, SearchPersonHit } from "./searchTypes";

const MATCH_ROLES = new Set(["Actor", "Director", "Writer", "Creator"]);

/** « 2008–2013 » pour une série terminée, « 2008– » en cours, l'année sinon. */
function years(item: SearchMediaItem): string | null {
  if (item.ProductionYear === undefined) return null;
  if (item.Type !== "Series") return String(item.ProductionYear);
  const end = item.EndDate ? new Date(item.EndDate).getUTCFullYear() : null;
  if (end !== null && Number.isFinite(end) && end !== item.ProductionYear) return `${item.ProductionYear}–${end}`;
  return item.Status === "Continuing" ? `${item.ProductionYear}–` : String(item.ProductionYear);
}

/** La ligne d'identité d'un titre : type, années, note publique. */
export function itemMeta(t: TFunction, item: SearchMediaItem, locale: string): string {
  const parts: string[] = [t(`search:type_${item.Type}`)];
  const span = years(item);
  if (span !== null) parts.push(span);
  if (item.Type === "BoxSet" && item.ChildCount) parts.push(t("search:titles", { count: item.ChildCount }));
  if (item.CommunityRating) parts.push(`★ ${item.CommunityRating.toLocaleString(locale, { maximumFractionDigits: 1 })}`);
  return parts.join(" · ");
}

/** Pourquoi ce titre répond — `null` quand c'est son titre (ça se voit). */
export function matchReason(t: TFunction, match: SearchMatch): string | null {
  switch (match.field) {
    case "people":
      if (!match.value) return null;
      return t(`search:match_people_${match.role && MATCH_ROLES.has(match.role) ? match.role : "Actor"}`, { name: match.value });
    case "originalTitle":
    case "genre":
    case "studio":
      return match.value ? t(`search:match_${match.field}`, { value: match.value }) : null;
    default:
      return null;
  }
}

/** « Réalisation · Interprétation — 5 titres » : ce qu'une personne représente ici. */
export function personMeta(t: TFunction, person: SearchPersonHit): string {
  const roles = person.roles
    .filter((role) => MATCH_ROLES.has(role))
    .slice(0, 2)
    .map((role) => t(`search:role_${role}`));
  const count = t("search:titles", { count: person.count });
  return roles.length > 0 ? `${roles.join(" · ")} — ${count}` : count;
}

/** Les initiales d'un nom, pour un portrait absent. */
export function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}
