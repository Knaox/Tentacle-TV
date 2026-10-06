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
 * - `serverUpdate` : l'invitation « Pour profiter des dernières nouveautés,
 *   mettez à jour votre serveur » (administrateurs ; avertissement
 *   `serverNews`). Masquée jusqu'aux prochaines nouveautés : sa marque retient
 *   la version qu'apportait la nouveauté manquante la plus récente, et
 *   l'invitation revient dès qu'un client en connaît une plus récente
 *   (`notices/serverUpdateNotice.ts`). Le nom date de l'avertissement d'avant
 *   — un serveur livré le connaît : il ne se renomme pas. Le serveur SOUS
 *   l'exigence du client, lui, ne se masque plus.
 * - `tmdbKey` : « Aucune clé TMDB » (administrateurs) — l'avertissement
 *   surgissant des clients.
 * - `adminPublicUrl`, `adminDirectPlay`, `adminTmdbKey`, `adminJellyfin`,
 *   `adminSegmentPlugins` : les RECOMMANDATIONS du tableau de bord
 *   d'administration (lien public et HTTPS, lecture directe, clé TMDB,
 *   réglages conseillés de Jellyfin, greffons de passages). Une
 *   recommandation masquée se retrouve sous « N recommandations masquées ».
 *   Distinctes des fenêtres des clients : masquer l'une ne masque pas l'autre.
 * - `autoQuality` : « Qualité réduite » sur le lecteur — pourquoi la qualité
 *   baisse en Auto (`notices/qualityDropNotice.ts`). Masqué, le message ne
 *   paraît plus ; la raison reste lisible dans le menu Qualité.
 */
export const DISMISSIBLE_HINTS = [
  "trailerHelp", "serverUpdate", "tmdbKey", "adminPublicUrl", "adminDirectPlay", "adminTmdbKey", "adminJellyfin",
  "autoQuality", "adminSegmentPlugins",
] as const;

export type DismissibleHint = (typeof DISMISSIBLE_HINTS)[number];

/**
 * Ce que savait retenir un serveur d'avant la liste `known` : le contrat
 * d'origine. Un client n'offre « Ne plus afficher » que pour un rappel que SON
 * serveur sait retenir — sinon le geste échouerait.
 */
export const LEGACY_KNOWN_HINTS: readonly DismissibleHint[] = ["trailerHelp"];

/** Une marque est une version (« 1.23.0 ») : courte, sans espace. */
export const HINT_MARK_MAX_LENGTH = 32;

export function isDismissibleHint(value: unknown): value is DismissibleHint {
  return typeof value === "string" && (DISMISSIBLE_HINTS as readonly string[]).includes(value);
}

export function isHintMark(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= HINT_MARK_MAX_LENGTH && /^[\w.+-]+$/.test(value);
}

/** Les marques retenues, par rappel qui en porte une. */
export type DismissedHintMarks = Partial<Record<DismissibleHint, string>>;

/** `GET /api/preferences/hints`, et la réponse de chaque `PUT`. */
export interface DismissedHintsResponse {
  /** Les rappels masqués par le compte, dans l'ordre de `DISMISSIBLE_HINTS`. */
  dismissed: DismissibleHint[];
  /** La marque retenue au masquage. Absent d'un serveur d'avant les marques. */
  marks?: DismissedHintMarks;
  /** La liste fermée de CE serveur. Absent d'un serveur d'avant : `LEGACY_KNOWN_HINTS`. */
  known?: DismissibleHint[];
}

/** Le corps de `PUT /api/preferences/hints/:hint`. */
export interface DismissHintRequest {
  /** `true` : masquer ; `false` : réafficher. */
  dismissed: boolean;
  /** Ce que le masquage retient (`serverUpdate` : la version des nouveautés proposées). */
  mark?: string;
}

/**
 * Une entrée rangée en base : le nom seul, ou le nom et sa marque. Un serveur
 * d'avant les marques ne lit que les noms seuls — il ignore les objets, et ne
 * connaît de toute façon pas les rappels qui en portent.
 */
export type StoredHintEntry = DismissibleHint | { hint: DismissibleHint; mark: string };

function entryName(entry: unknown): unknown {
  return typeof entry === "object" && entry !== null ? (entry as { hint?: unknown }).hint : entry;
}

/**
 * La liste lue en base, nettoyée : les seuls noms connus, chacun une fois,
 * dans l'ordre du contrat. Une valeur illisible vaut « rien de masqué » —
 * au pire le rappel revient, jamais d'erreur.
 */
export function normalizeDismissedHints(raw: unknown): DismissibleHint[] {
  const names = (Array.isArray(raw) ? raw : []).map(entryName);
  return DISMISSIBLE_HINTS.filter((hint) => names.includes(hint));
}

/**
 * Les marques d'une liste lue en base (entrées `{ hint, mark }`) ou d'une
 * réponse (objet `marks`). Une marque illisible est ignorée : le rappel
 * masqué sans marque revient à la prochaine exigence, jamais d'erreur.
 */
export function normalizeHintMarks(raw: unknown): DismissedHintMarks {
  const marks: DismissedHintMarks = {};
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (typeof entry !== "object" || entry === null) continue;
      const { hint, mark } = entry as { hint?: unknown; mark?: unknown };
      if (isDismissibleHint(hint) && isHintMark(mark)) marks[hint] = mark;
    }
  } else if (typeof raw === "object" && raw !== null) {
    for (const [hint, mark] of Object.entries(raw)) {
      if (isDismissibleHint(hint) && isHintMark(mark)) marks[hint] = mark;
    }
  }
  return marks;
}

/** La liste fermée annoncée par un serveur ; `LEGACY_KNOWN_HINTS` s'il n'en annonce pas. */
export function normalizeKnownHints(raw: unknown): DismissibleHint[] {
  if (!Array.isArray(raw)) return [...LEGACY_KNOWN_HINTS];
  return DISMISSIBLE_HINTS.filter((hint) => raw.includes(hint));
}

/** Ce qui s'écrit en base : les noms, et la marque de ceux qui en portent une. */
export function storedHintEntries(dismissed: readonly DismissibleHint[], marks: DismissedHintMarks): StoredHintEntry[] {
  return normalizeDismissedHints(dismissed).map((hint) => {
    const mark = marks[hint];
    return isHintMark(mark) ? { hint, mark } : hint;
  });
}
