/**
 * La disposition du rail PAR PROFIL (Apple TV, Android TV) — le format
 * stocké et sa lecture. Module pur : ni React, ni stockage.
 *
 * Une TV de salon sert plusieurs personnes : chaque identité (le compte
 * jumelé, ou le profil de la Famille ouvert) a SA disposition — ce qu'elle
 * masque, l'ordre qu'elle a choisi, et si sa préconfiguration est faite.
 * Toujours locale à l'appareil : le salon et la chambre ne regardent pas les
 * mêmes choses.
 *
 * Stockage : UNE clé fixe, `tentacle_tv_rail_profiles`, un objet
 * `{ [userId]: { masquees, order?, setupDone? } }` — fixe pour que le
 * stockage natif la précharge avec les autres.
 *
 * La disposition D'APPAREIL d'avant (`tentacle_webos_rail`, celle que la LG
 * lit et écrit encore) n'est ni renommée ni réécrite : une identité qui n'a
 * pas d'entrée à elle en HÉRITE. Rien ne bouge donc au premier lancement
 * après la mise à jour. Hériter ne vaut pas « préconfiguration faite ».
 */

export const RAIL_PROFILES_STORAGE_KEY = "tentacle_tv_rail_profiles";

/**
 * Une disposition : ce qui est masqué et l'ordre choisi (vide = l'ordre par
 * défaut, `applyRailOrder`). `masquees` garde son nom français : c'est une
 * clé du JSON stocké (voir `railPinning.ts`).
 */
export interface RailLayout {
  masquees: string[];
  order: string[];
}

/** L'entrée d'une identité : sa disposition, et sa préconfiguration. */
export interface ProfileRailEntry extends RailLayout {
  setupDone: boolean;
}

/** Toutes les entrées connues de cet appareil, par identité. */
export type ProfileRails = Readonly<Record<string, ProfileRailEntry>>;

export const EMPTY_RAIL_LAYOUT: RailLayout = Object.freeze({ masquees: [], order: [] }) as RailLayout;

/** Les seules chaînes d'une liste ; autre chose qu'une liste : vide. */
function stringsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((key): key is string => typeof key === "string") : [];
}

/**
 * Une disposition lue d'un JSON quelconque. Abîmée, elle vaut « tout
 * afficher, ordre par défaut » : un rail plein, jamais un rail vide.
 */
export function railLayoutOf(value: unknown): RailLayout {
  if (!value || typeof value !== "object") return EMPTY_RAIL_LAYOUT;
  const loaded = value as { masquees?: unknown; order?: unknown };
  return { masquees: stringsOf(loaded.masquees), order: stringsOf(loaded.order) };
}

/** La disposition d'appareil d'avant (`tentacle_webos_rail`), telle qu'elle est stockée. */
export function parseDeviceRail(raw: string | null): RailLayout {
  if (!raw) return EMPTY_RAIL_LAYOUT;
  try {
    return railLayoutOf(JSON.parse(raw));
  } catch {
    return EMPTY_RAIL_LAYOUT;
  }
}

/**
 * Les entrées par identité. Un JSON illisible vaut « aucune entrée » : chaque
 * identité hérite alors de la disposition d'appareil — le rail reste plein.
 * Une entrée abîmée vaut une disposition vide ; `setupDone` n'est vrai que
 * s'il l'est explicitement.
 */
export function parseProfileRails(raw: string | null): Record<string, ProfileRailEntry> {
  if (!raw) return {};
  let loaded: unknown;
  try {
    loaded = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!loaded || typeof loaded !== "object" || Array.isArray(loaded)) return {};
  const rails: Record<string, ProfileRailEntry> = {};
  for (const [userId, value] of Object.entries(loaded as Record<string, unknown>)) {
    if (!userId) continue;
    const setupDone = !!value && typeof value === "object" && (value as { setupDone?: unknown }).setupDone === true;
    rails[userId] = { ...railLayoutOf(value), setupDone };
  }
  return rails;
}

/**
 * Le JSON stocké : `order` n'y paraît que s'il dit quelque chose, `setupDone`
 * que s'il est vrai — la forme la plus courte, comme `railPinning.ts`.
 */
export function serializeProfileRails(rails: ProfileRails): string {
  const out: Record<string, { masquees: string[]; order?: string[]; setupDone?: true }> = {};
  for (const [userId, entry] of Object.entries(rails)) {
    out[userId] = {
      masquees: entry.masquees,
      ...(entry.order.length > 0 ? { order: entry.order } : {}),
      ...(entry.setupDone ? { setupDone: true as const } : {}),
    };
  }
  return JSON.stringify(out);
}

/**
 * L'entrée qu'une identité VOIT : la sienne, sinon la disposition d'appareil
 * héritée — préconfiguration non faite.
 */
export function profileRailOf(rails: ProfileRails, device: RailLayout, userId: string): ProfileRailEntry {
  return rails[userId] ?? { masquees: device.masquees, order: device.order, setupDone: false };
}

/** Deux listes de clés identiques, clé pour clé. */
function sameKeys(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((key, index) => key === b[index]);
}

/** Deux entrées identiques (de quoi ne notifier qu'un vrai changement). */
export function sameProfileRail(a: ProfileRailEntry, b: ProfileRailEntry): boolean {
  return a.setupDone === b.setupDone && sameKeys(a.masquees, b.masquees) && sameKeys(a.order, b.order);
}
