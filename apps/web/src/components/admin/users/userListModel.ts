import { matchesSearch } from "@tentacle-tv/shared";

/**
 * Ce que l'écran Admin > Utilisateurs calcule sur la liste des comptes :
 * filtres, recherche, tri, compteurs, temps écoulé. Pur — les composants ne
 * font que l'appeler, et le banc le vérifie sans navigateur.
 */

/** Un compte tel que `GET /api/admin/users` le rend. */
export interface AdminUser {
  id: string;
  name: string;
  hasAvatar: boolean;
  /** Étiquette de la photo — serveur 1.19.3 ou plus, absente avant. */
  imageTag?: string | null;
  lastActivityDate: string | null;
  /** Serveur 1.19.3 ou plus : absente avant, `null` pour « jamais ». */
  lastLoginDate?: string | null;
  isAdministrator: boolean;
  isDisabled: boolean;
}

export type UserFilter = "all" | "admins" | "disabled";
export type UserSort = "name" | "activity" | "role";

export const USER_FILTERS: readonly UserFilter[] = ["all", "admins", "disabled"];
export const USER_SORTS: readonly UserSort[] = ["name", "activity", "role"];

function matchesFilter(user: AdminUser, filter: UserFilter): boolean {
  if (filter === "admins") return user.isAdministrator;
  if (filter === "disabled") return user.isDisabled;
  return true;
}

/** Le nombre de comptes derrière chaque filtre — affiché dans le filtre même. */
export function countByFilter(users: readonly AdminUser[]): Record<UserFilter, number> {
  return {
    all: users.length,
    admins: users.filter((u) => u.isAdministrator).length,
    disabled: users.filter((u) => u.isDisabled).length,
  };
}

/** Horodatage d'une date Jellyfin ; 0 pour « jamais », qui se range après tout le reste. */
function timeOf(iso: string | null | undefined): number {
  const time = iso ? Date.parse(iso) : Number.NaN;
  return Number.isNaN(time) ? 0 : time;
}

/** Les comptes actifs depuis `since` (horodatage) — « jamais » n'en est pas. */
export function countActiveSince(users: readonly AdminUser[], since: number): number {
  return users.filter((u) => {
    const time = timeOf(u.lastActivityDate);
    return time > 0 && time >= since;
  }).length;
}

export interface UserListView {
  query: string;
  filter: UserFilter;
  sort: UserSort;
}

/**
 * Les comptes à afficher, dans l'ordre demandé. La recherche passe par le
 * comparateur partagé : accents, casse et ponctuation ignorés — « jean luc »
 * retrouve « Jean-Luc », comme partout ailleurs. Le nom départage toujours,
 * par la collation de la langue de l'interface.
 */
export function visibleUsers(
  users: readonly AdminUser[],
  { query, filter, sort }: UserListView,
  collator: Intl.Collator,
): AdminUser[] {
  const q = query.trim();
  const list = users.filter((u) => matchesFilter(u, filter) && (q === "" || matchesSearch(u.name, q)));
  const byName = (a: AdminUser, b: AdminUser) => collator.compare(a.name, b.name);
  const compare =
    sort === "activity"
      ? (a: AdminUser, b: AdminUser) => timeOf(b.lastActivityDate) - timeOf(a.lastActivityDate) || byName(a, b)
      : sort === "role"
        ? (a: AdminUser, b: AdminUser) =>
            Number(b.isAdministrator) - Number(a.isAdministrator) ||
            Number(a.isDisabled) - Number(b.isDisabled) ||
            byName(a, b)
        : byName;
  return [...list].sort(compare);
}

/**
 * Jellyfin écrit ses identifiants tantôt avec tirets, tantôt sans, et la casse
 * varie selon l'appelant : on compare leur forme nue.
 */
export function normalizeUserId(id: string): string {
  return id.replace(/-/g, "").toLowerCase();
}

export function sameUserId(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && normalizeUserId(a) === normalizeUserId(b);
}

/** Regroupe des éléments (appareils jumelés…) par compte, clé normalisée. */
export function groupByUser<T>(items: readonly T[], userIdOf: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = normalizeUserId(userIdOf(item));
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return map;
}

const SECOND = 1000;
const STEPS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 3600 * SECOND],
  ["month", 30 * 24 * 3600 * SECOND],
  ["week", 7 * 24 * 3600 * SECOND],
  ["day", 24 * 3600 * SECOND],
  ["hour", 3600 * SECOND],
  ["minute", 60 * SECOND],
];

/**
 * « il y a 3 heures », « hier », « maintenant » — `null` pour une date absente
 * ou illisible, que l'appelant dit à sa façon (« Jamais connecté »).
 *
 * Une date dans le futur (horloges décalées entre Jellyfin et ce poste) vaut
 * « maintenant » : dire « dans 2 minutes » d'une activité n'aurait aucun sens.
 */
export function relativeTime(iso: string | null | undefined, now: number, locale: string): string | null {
  const time = iso ? Date.parse(iso) : Number.NaN;
  if (Number.isNaN(time)) return null;
  const elapsed = Math.max(0, now - time);
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const [unit, size] of STEPS) {
    if (elapsed >= size) return format.format(-Math.round(elapsed / size), unit);
  }
  return format.format(0, "second");
}

/** La date complète, pour l'infobulle d'un temps relatif. */
export function absoluteTime(iso: string | null | undefined, locale: string): string | null {
  const time = iso ? Date.parse(iso) : Number.NaN;
  if (Number.isNaN(time)) return null;
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" }).format(time);
}
