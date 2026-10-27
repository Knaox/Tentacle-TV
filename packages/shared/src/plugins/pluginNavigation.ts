/**
 * La NAVIGATION d'une extension, réglée à l'exécution (capacité serveur
 * `plugins.navigation`) : le nom de chacune de ses pages et sa place, dans la
 * barre principale, dans « Plus », ou nulle part. L'extension le déclare dans
 * son manifeste,
 *
 *   "navigation": "/navigation"
 *
 * une route GET de SON serveur (runtime isolé) qui rend
 *
 *   { "items": [{ "path": "/ma/page", "label": "Mon nom" | null, "primary": true, "hidden"?: true }] }
 *
 * et qu'elle écrit elle-même (son administration, PUT sur la même route). Le
 * cœur la lit sur la socket de l'invité, la valide, et la FUSIONNE dans les
 * `navItems` de `/api/plugins/active` : un nom choisi remplace les libellés du
 * manifeste (un seul nom, toutes langues), `primary` dit le DÉFAUT de la barre
 * — le geste de l'utilisateur sur son appareil l'emporte toujours. Sans ce
 * champ, rien ne change : la page est épinglée d'office, comme avant.
 *
 * `hidden: true` MASQUE la page de toute la navigation, sur tous les clients
 * (barre, « Plus », barre d'onglets, miroir, « Personnaliser la barre ») — et
 * aucune épingle d'appareil ne l'y ramène ; sa ROUTE reste, et un lien direct
 * l'ouvre toujours (`isPluginNavHidden`). Absent : faux. Une page masquée
 * part avec `primary: false` : un client d'avant, qui ignore `hidden`, la
 * range dans « Plus », jamais dans la barre.
 *
 * MIROIR : recopié octet pour octet dans
 * `apps/backend/src/plugins/runtime/navigation/` (le backend ne dépend pas de
 * shared ; test : plugins/runtime/runtimeMirror.test.ts). On modifie ICI, on
 * recopie là-bas. Aucun nom d'extension ici : le contrat est générique.
 */

/** Un nom de page : court — il tient dans un onglet de la barre. */
export const PLUGIN_NAV_LABEL_MAX = 40;
/** Au-delà, la réponse de l'extension n'est pas lue : une barre n'a pas cent pages. */
export const PLUGIN_NAV_ITEMS_MAX = 20;

export interface PluginNavigationItem {
  /** Une entrée NON admin des `navItems` du manifeste ; toute autre est ignorée. */
  path: string;
  /** Le nom choisi, ou `null` : les libellés du manifeste. */
  label: string | null;
  /** Dans la barre principale par défaut (`true`), ou dans « Plus » seulement. */
  primary: boolean;
  /** Masquée de toute la navigation (sa route reste) ; posé seulement quand c'est vrai. */
  hidden?: boolean;
}

export interface PluginNavigationDoc {
  items: PluginNavigationItem[];
}

const SAFE_PATH = /^\/[A-Za-z0-9_\-/]{1,100}$/;

/** Le chemin d'une route d'extension, ou `null` s'il n'est pas sûr. */
export function safeNavigationPath(value: unknown): string | null {
  return typeof value === "string" && SAFE_PATH.test(value) && !value.includes("//") ? value : null;
}

/** La route `navigation` déclarée par un manifeste, ou `null`. */
export function readNavigationRoute(manifest: unknown): string | null {
  if (!manifest || typeof manifest !== "object") return null;
  return safeNavigationPath((manifest as { navigation?: unknown }).navigation);
}

function isControl(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return code < 0x20 || code === 0x7f;
}

/**
 * Un nom de page, en TEXTE NU : espaces resserrés, bornes rognées ; refusé
 * (`null`) s'il est vide, trop long, ou porte un caractère de contrôle ou de
 * balisage (`<`, `>`) — jamais du HTML, même échappé ailleurs.
 */
export function normalizeNavLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length === 0 || [...text].length > PLUGIN_NAV_LABEL_MAX) return null;
  if (/[<>]/.test(text) || [...text].some(isControl)) return null;
  return text;
}

/** Une réponse de la route, lue sans rien croire ; `null` si sa forme n'est pas celle du contrat. */
export function readNavigationDoc(raw: unknown): PluginNavigationDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items) || items.length > PLUGIN_NAV_ITEMS_MAX) return null;
  const out: PluginNavigationItem[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") return null;
    const { path, label, primary, hidden } = item as Record<string, unknown>;
    const safe = safeNavigationPath(path);
    if (!safe || typeof primary !== "boolean") return null;
    if (hidden !== undefined && typeof hidden !== "boolean") return null;
    if (label !== null && label !== undefined && normalizeNavLabel(label) === null) return null;
    const read: PluginNavigationItem = { path: safe, label: label == null ? null : normalizeNavLabel(label), primary };
    out.push(hidden ? { ...read, hidden: true } : read);
  }
  return { items: out };
}

/**
 * Une page des `navItems` est-elle MASQUÉE de la navigation ? Seul `true` le
 * dit (rien d'autre ne se croit) ; sa route, elle, reste enregistrée.
 */
export function isPluginNavHidden(nav: { hidden?: unknown }): boolean {
  return nav.hidden === true;
}

interface MergeableNavItem {
  path: string;
  admin?: unknown;
  label?: unknown;
  labels?: unknown;
}

/**
 * Les `navItems` du manifeste, avec ce que l'extension a réglé : `primary` (et
 * `hidden`) sur chaque page qu'elle décrit, et son nom choisi à la place des
 * libellés. Une entrée d'administration ne bouge jamais ; une page que le
 * document ne décrit pas reste telle quelle (épinglée d'office, comme avant).
 * Une page décrite a la place que dit le document, et elle seule : masquée
 * (`hidden: true`, et alors `primary: false`), sinon plus jamais masquée.
 */
export function mergeNavigation<T extends MergeableNavItem>(
  navItems: readonly T[],
  doc: PluginNavigationDoc | null,
): Array<T & { primary?: boolean; hidden?: boolean }> {
  if (!doc) return [...navItems];
  const byPath = new Map(doc.items.map((item) => [item.path, item]));
  return navItems.map((nav) => {
    const set = nav.admin ? undefined : byPath.get(nav.path);
    if (!set) return nav;
    // Un `hidden` du manifeste ne survit pas au document : la page décrite a SA place, et elle seule.
    const { hidden: _hidden, ...visible } = nav as T & { hidden?: unknown };
    const place = set.hidden ? { primary: false, hidden: true } : { primary: set.primary };
    if (set.label === null) return { ...visible, ...place } as T & { primary: boolean };
    const { labels: _labels, ...rest } = visible;
    return { ...rest, label: set.label, ...place } as T & { primary: boolean };
  });
}
