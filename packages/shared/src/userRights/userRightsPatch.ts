import {
  ACCESS_SCHEDULE_DAYS,
  UNRATED_ITEM_TYPES,
  USER_RIGHTS_FIELDS,
  isUserRightsKey,
  type AccessScheduleDto,
  type UserRightsFieldSpec,
  type UserRightsKey,
  type UserRightsOptions,
  type UserRightsPatch,
} from "./userRightsContract";

/**
 * La validation STRICTE d'un correctif de droits — une règle pure, la même pour
 * l'administration (ne pas offrir un geste voué au refus) et pour le serveur
 * (qui la rejoue toujours). Rien n'est deviné ni corrigé en silence : une clé
 * inconnue, un type faux, une valeur hors bornes refusent le correctif ENTIER.
 *
 * MIROIR : `apps/backend/src/userRights/userRightsPatch.ts`, octet pour octet.
 */

/** Au plus, par liste (étiquettes, bibliothèques, plages). */
export const USER_RIGHTS_LIST_MAX = 500;
/** Une étiquette : 1 à 200 caractères, sans saut de ligne. */
export const USER_RIGHTS_TAG_MAX = 200;

export type PatchParse = { ok: true; patch: UserRightsPatch } | { ok: false; fields: UserRightsKey[] };

const GUID = /^[0-9a-f]{32}$/;

/** Un identifiant Jellyfin, sans tirets, en minuscules (Jellyfin mêle les deux formes). */
export function normalizeJellyfinId(id: string): string {
  return id.replace(/-/g, "").toLowerCase();
}

function parseSchedule(value: unknown): AccessScheduleDto | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entry = value as Record<string, unknown>;
  if (Object.keys(entry).some((key) => key !== "dayOfWeek" && key !== "startHour" && key !== "endHour")) return null;
  const { dayOfWeek, startHour, endHour } = entry;
  if (typeof dayOfWeek !== "string" || !(ACCESS_SCHEDULE_DAYS as readonly string[]).includes(dayOfWeek)) return null;
  if (typeof startHour !== "number" || typeof endHour !== "number") return null;
  if (!Number.isFinite(startHour) || !Number.isFinite(endHour)) return null;
  if (startHour < 0 || endHour > 24 || startHour >= endHour) return null;
  return { dayOfWeek: dayOfWeek as AccessScheduleDto["dayOfWeek"], startHour, endHour };
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

/** La valeur d'UN champ, validée et mise en forme ; `undefined` : refusée. */
function parseValue(spec: UserRightsFieldSpec, value: unknown): unknown {
  switch (spec.kind) {
    case "boolean":
      return typeof value === "boolean" ? value : undefined;
    case "integer":
      if (value === null) return spec.nullable ? null : undefined;
      if (typeof value !== "number" || !Number.isInteger(value)) return undefined;
      if (spec.min !== undefined && value < spec.min) return undefined;
      if (spec.max !== undefined && value > spec.max) return undefined;
      return value;
    case "enum":
      return typeof value === "string" && (spec.values ?? []).includes(value) ? value : undefined;
    case "stringList": {
      if (!Array.isArray(value) || value.length > USER_RIGHTS_LIST_MAX) return undefined;
      const tags = value.map((tag) => (typeof tag === "string" ? tag.trim() : ""));
      if (tags.some((tag) => tag.length === 0 || tag.length > USER_RIGHTS_TAG_MAX || /[\r\n]/.test(tag))) return undefined;
      return uniqueStrings(tags);
    }
    case "folderList": {
      if (!Array.isArray(value) || value.length > USER_RIGHTS_LIST_MAX) return undefined;
      if (value.some((id) => typeof id !== "string")) return undefined;
      const ids = (value as string[]).map(normalizeJellyfinId);
      return ids.every((id) => GUID.test(id)) ? uniqueStrings(ids) : undefined;
    }
    case "unratedList": {
      if (!Array.isArray(value)) return undefined;
      if (value.some((item) => typeof item !== "string" || !(UNRATED_ITEM_TYPES as readonly string[]).includes(item))) return undefined;
      return uniqueStrings(value as string[]);
    }
    case "schedules": {
      if (!Array.isArray(value) || value.length > USER_RIGHTS_LIST_MAX) return undefined;
      const schedules = value.map(parseSchedule);
      return schedules.every((entry) => entry !== null) ? schedules : undefined;
    }
  }
}

/** Le correctif tel qu'il arrive (corps JSON) : objet, au moins une clé, toutes connues et valides. */
export function parseUserRightsPatch(body: unknown): PatchParse {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, fields: [] };
  const entries = Object.entries(body as Record<string, unknown>);
  if (entries.length === 0) return { ok: false, fields: [] };
  const patch: Record<string, unknown> = {};
  const refused: UserRightsKey[] = [];
  for (const [key, value] of entries) {
    // Une clé inconnue refuse tout, sans être nommée : elle ne sort pas du contrat.
    if (!isUserRightsKey(key)) return { ok: false, fields: [] };
    const parsed = parseValue(USER_RIGHTS_FIELDS[key], value);
    if (parsed === undefined) refused.push(key);
    else patch[key] = parsed;
  }
  return refused.length > 0 ? { ok: false, fields: refused } : { ok: true, patch: patch as UserRightsPatch };
}

/**
 * Ce qui doit EXISTER dans Jellyfin : bibliothèques et canaux nommés, note de sa
 * table. Rend les clés refusées (vide : tout existe).
 */
export function patchAgainstOptions(patch: UserRightsPatch, options: UserRightsOptions): UserRightsKey[] {
  const libraries = new Set(options.libraries.map((library) => normalizeJellyfinId(library.id)));
  const channels = new Set(options.channels.map((channel) => normalizeJellyfinId(channel.id)));
  const refused: UserRightsKey[] = [];
  for (const key of Object.keys(patch) as UserRightsKey[]) {
    const spec: UserRightsFieldSpec = USER_RIGHTS_FIELDS[key];
    if (spec.kind === "folderList") {
      const known = spec.among === "channels" ? channels : libraries;
      if (!(patch[key] as string[]).every((id) => known.has(normalizeJellyfinId(id)))) refused.push(key);
    }
  }
  const rating = patch.maxParentalRating;
  if (typeof rating === "number" && !options.parentalRatings.some((entry) => entry.score === rating)) {
    refused.push("maxParentalRating");
  }
  const subRating = patch.maxParentalSubRating;
  if (typeof subRating === "number") {
    const scores = options.parentalRatings.filter((entry) => entry.subScore !== null);
    // Une sous-note n'a de sens que si la table en porte ; sinon, refusée.
    if (!scores.some((entry) => entry.subScore === subRating)) refused.push("maxParentalSubRating");
  }
  return refused;
}
