/**
 * L'adresse de la page d'une personne — partagée par le bureau et le miroir.
 *
 * Le rôle par lequel on l'atteint (`?role=Director` depuis le générique) suit
 * dans l'adresse : la page s'ouvre sur ce métier, et le plugin de filmographie
 * hors bibliothèque met d'abord en avant ce que la personne y a fait. Une
 * adresse sans rôle reste valable (lien partagé, recherche).
 */

export interface PersonLinkTarget {
  Id: string;
  /** Le type Jellyfin du crédit (`Actor`, `Director`…). */
  Type?: string | null;
}

export function personPath(person: PersonLinkTarget): string {
  const role = typeof person.Type === "string" && /^[A-Za-z]{1,30}$/.test(person.Type) ? person.Type : null;
  const base = `/person/${encodeURIComponent(person.Id)}`;
  return role !== null && role !== "Actor" ? `${base}?role=${role}` : base;
}
