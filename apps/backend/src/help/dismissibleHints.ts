/**
 * Les rappels qu'un compte peut masquer « pour de bon » — et le contrat de
 * `GET/PUT /api/preferences/hints`. Une préférence du COMPTE, pas de
 * l'appareil : masqué depuis le téléphone, un rappel disparaît aussi du web,
 * du bureau et des téléviseurs, où l'on ne peut pas le masquer à la
 * télécommande.
 *
 * MIROIR : ce fichier est recopié octet pour octet dans
 * `apps/backend/src/help/dismissibleHints.ts` (le backend ne dépend pas de
 * `@tentacle-tv/shared` — tsc CommonJS, image Docker sans packages/). On le
 * modifie ICI, puis :
 *
 *   cp packages/shared/src/help/dismissibleHints.ts apps/backend/src/help/
 *
 * `hintsMirror.test.ts` (backend) refuse toute divergence. Aucun import : le
 * fichier doit compiler seul des deux côtés.
 */

/**
 * Liste FERMÉE : le serveur refuse tout autre nom, et un nom retiré d'ici
 * disparaît des réponses (une ligne ancienne ne ressuscite rien).
 *
 * - `trailerHelp` : « Vous ne voyez pas les bandes-annonces ? », sur la fiche
 *   d'un titre sans bande-annonce quand le serveur est mal réglé.
 */
export const DISMISSIBLE_HINTS = ["trailerHelp"] as const;

export type DismissibleHint = (typeof DISMISSIBLE_HINTS)[number];

export function isDismissibleHint(value: unknown): value is DismissibleHint {
  return typeof value === "string" && (DISMISSIBLE_HINTS as readonly string[]).includes(value);
}

/** `GET /api/preferences/hints`, et la réponse de chaque `PUT`. */
export interface DismissedHintsResponse {
  /** Les rappels masqués par le compte, dans l'ordre de `DISMISSIBLE_HINTS`. */
  dismissed: DismissibleHint[];
}

/** Le corps de `PUT /api/preferences/hints/:hint`. */
export interface DismissHintRequest {
  /** `true` : masquer ; `false` : réafficher. */
  dismissed: boolean;
}

/**
 * La liste lue en base, nettoyée : les seuls noms connus, chacun une fois,
 * dans l'ordre du contrat. Une valeur illisible vaut « rien de masqué » —
 * au pire le rappel revient, jamais d'erreur.
 */
export function normalizeDismissedHints(raw: unknown): DismissibleHint[] {
  const values = Array.isArray(raw) ? raw : [];
  return DISMISSIBLE_HINTS.filter((hint) => values.includes(hint));
}
