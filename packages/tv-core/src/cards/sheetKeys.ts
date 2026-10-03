/**
 * Les CLÉS du grand panneau des cartes — celles que la vue pose sur ses
 * cibles et que les règles du focus visent : la croix, les crans de l'échelle
 * de la note, les pictos, et les trois groupes qui les portent, chacun sur
 * toute la largeur du panneau.
 *
 * Une clé est un nom, pas une décision : la vue, les règles d'ici, le
 * branchement de chaque plateforme et les scénarios de référence la
 * partagent. Les renommer casse les guides en silence.
 */

/** Les valeurs du bureau : 1 à 10, une étoile = 2 (demi-étoiles comprises). */
export const RATING_SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/** Le cran d'entrée sans note posée : 5/10, deux étoiles et demie — jamais un
 *  bout de l'échelle, qu'un OK réflexe validerait. */
export const RATING_ENTRY = 5;

/** La croix Retour, dans le coin haut-gauche du panneau. */
export const SHEET_CLOSE_KEY = "sheet:close";

/** Le groupe de l'en-tête (la croix), celui de l'échelle, celui des pictos. */
export const SHEET_HEADER_GROUP = "sheet:header";
export const SHEET_SCALE_GROUP = "sheet:scale";
export const SHEET_ACTIONS_GROUP = "sheet:actions";

const SCALE_PREFIX = "sheet:scale:";
const ACTION_PREFIX = "sheet:action:";

/** La clé d'un cran (`sheet:scale:7`), ou du retrait (`sheet:scale:remove`). */
export const scaleFocusKey = (score: number | null): string => `${SCALE_PREFIX}${score ?? "remove"}`;

/** Toutes les clés de l'échelle, retrait compris. */
export const SCALE_FOCUS_KEYS: readonly string[] = [...RATING_SCORES.map(scaleFocusKey), scaleFocusKey(null)];

/** La clé d'un picto (`sheet:action:watchlist`). */
export const sheetActionKey = (kind: string): string => `${ACTION_PREFIX}${kind}`;

/** Un cran de l'échelle, retrait compris. */
export const isScaleKey = (key: string): boolean => key.startsWith(SCALE_PREFIX);

/** Un picto. */
export const isActionKey = (key: string): boolean => key.startsWith(ACTION_PREFIX);

/** Ce que vise une clé de l'échelle : un cran, le retrait, ou rien. */
export function scaleAimOf(key: string | null): number | "remove" | null {
  if (!key?.startsWith(SCALE_PREFIX)) return null;
  const rest = key.slice(SCALE_PREFIX.length);
  if (rest === "remove") return "remove";
  const score = Number(rest);
  return Number.isInteger(score) && score >= 1 && score <= 10 ? score : null;
}

const GUARDED = /^sheet:(action|scale):|^sheet:close$/;

/**
 * Les cibles du panneau sous la garde anti-clic fantôme (`pressGuard`) :
 * l'échelle, les pictos et la croix. Le panneau s'ouvre sous un OK encore
 * enfoncé (l'appui maintenu), dont le relâchement ne doit rien valider —
 * surtout pas une note.
 */
export function isSheetGuardedKey(key: string): boolean {
  return GUARDED.test(key);
}
