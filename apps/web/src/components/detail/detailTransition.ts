export interface DetailOrigin {
  itemId: string;
  /** Rectangle du visuel cliqué, en coordonnées de fenêtre. */
  rect: { top: number; left: number; width: number; height: number };
  /** Visuel affiché par la carte — première image de l'animation d'ouverture. */
  imageUrl: string;
  /** Rayon du visuel de départ, pour que le coin s'ouvre au lieu de sauter. */
  radius: number;
  /**
   * L'écran de départ couvrait DÉJÀ tout — la recherche plein écran.
   *
   * Le calque d'ouverture fait normalement fondre sa base opaque depuis rien,
   * par-dessus la page d'où l'on part, qui reste visible dessous : le fondu
   * est un enchaînement. Depuis un takeover, ce n'est plus vrai. Le takeover
   * disparaît d'un coup à la navigation, et le temps du fondu on voit
   * ressurgir la page qu'il masquait — pendant que le visuel, lui, vole depuis
   * une grille de résultats qui n'existe plus. La base démarre donc visible :
   * le takeover passe le relais à un écran déjà couvert.
   */
  covered: boolean;
  stamp: number;
}

/**
 * Origine de la prochaine ouverture de fiche.
 *
 * Un module et non un contexte React : la valeur est posée pendant le
 * `onClick`, JUSTE avant `navigate()`, et relue au montage de la page de
 * destination. Un state React serait perdu dans le démontage de la route
 * source, et un contexte imposerait un provider autour de tout l'arbre pour
 * une donnée qui vit trois cents millisecondes.
 */
let pending: DetailOrigin | null = null;

/** Au-delà, l'origine est périmée : navigation arrière, lien direct, onglet ré-ouvert. */
const MAX_AGE_MS = 1200;

/**
 * Mémorise d'où part l'ouverture. À appeler dans le `onClick` de la carte,
 * avant la navigation — c'est le seul moment où son rectangle existe encore.
 *
 * `element` doit être le VISUEL, pas la carte : le rectangle sert de cadre à
 * une image en `object-cover`, donc son rapport de forme est tout ce qui compte.
 * Une racine de carte embarque le bloc titre, un panneau d'aperçu embarque son
 * tiroir déplié — dans les deux cas l'image part écrasée, puis se « déplie »
 * en arrivant. Les appelants visent `[data-card-visual]` / `[data-preview-visual]`.
 */
export function captureDetailOrigin(
  element: HTMLElement | null,
  itemId: string,
  imageUrl: string,
  radius = 12,
  covered = false,
): void {
  if (!element) {
    pending = null;
    return;
  }
  const r = element.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) {
    pending = null;
    return;
  }
  pending = {
    itemId,
    rect: { top: r.top, left: r.left, width: r.width, height: r.height },
    imageUrl,
    radius,
    covered,
    stamp: Date.now(),
  };
}

/**
 * Instant de la dernière SORTIE de lecteur. Zéro : jamais joué.
 *
 * L'autre façon d'arriver sur une fiche sans l'ouvrir. Une origine dit « voilà
 * d'où part le vol » ; ceci dit « il n'y a rien à ouvrir, la fiche était déjà
 * là ». Les deux mènent au même endroit — une page qui rend son état final
 * d'emblée (cf. `skipEntrance` dans `MediaDetail`) — et vivent donc ensemble.
 */
let playerExitAt = 0;

/**
 * À appeler juste AVANT la navigation de sortie du lecteur, comme
 * `captureDetailOrigin` l'est avant celle d'une carte.
 *
 * Toutes les sorties, pas seulement le bouton retour : raccourci Échap, fin de
 * média sans épisode suivant, arrêt depuis les contrôles système. Ce qui compte
 * n'est pas le geste mais la page qu'on retrouve.
 */
export function markPlayerExit(): void {
  playerExitAt = Date.now();
}

/** Vrai si la navigation en cours sort du lecteur. Lecture non destructive. */
export function arrivesFromPlayer(): boolean {
  return playerExitAt > 0 && Date.now() - playerExitAt <= MAX_AGE_MS;
}

/**
 * Instant de la dernière navigation demandée par un GREFFON. Zéro : jamais.
 *
 * La seule arrivée où l'écran de départ ne PEUT PAS déposer d'origine. Un
 * greffon vit dans une iframe sandboxée : il ne voit pas ce module, il demande
 * la navigation par `postMessage` (cf. `PluginIframe`), et son document est
 * détruit d'un bloc au changement de route. Le rectangle de son visuel est dans
 * un repère qui n'existe déjà plus quand la fiche se monte.
 *
 * Le marqueur n'est pas posé selon la route visée : il dit d'où vient la
 * navigation, et seule la fiche média s'en sert. Rien à craindre d'une origine
 * posée entre-temps — le calque l'emporte, et le régime est le même.
 */
let pluginNavAt = 0;

/** À appeler juste AVANT `navigate()` sur demande d'un greffon. */
export function markPluginNavigation(): void {
  pluginNavAt = Date.now();
}

/** Vrai si la navigation en cours vient d'un greffon. Lecture non destructive. */
export function arrivesFromPlugin(): boolean {
  return pluginNavAt > 0 && Date.now() - pluginNavAt <= MAX_AGE_MS;
}

/**
 * Chemin d'atterrissage du DOCUMENT — figé à l'import, donc une fois par
 * chargement de page. `BrowserRouter` (cf. `main.tsx`) : le chemin de la route
 * EST celui de l'URL.
 */
const landingPath = typeof window === "undefined" ? "" : window.location.pathname;

/**
 * La fiche rend-elle son état FINAL d'emblée, sans jouer son entrée ?
 *
 * Quatre façons d'arriver sur une fiche sans l'ouvrir, une seule règle : cette
 * page ne s'OUVRE pas, donc elle ne joue rien.
 *
 * 1. **Le calque s'en charge** (`origin`). Il recouvre l'écran pendant que la
 *    page, dessous, jouerait sa PROPRE entrée — voile de page, cascade de texte,
 *    fondu de l'affiche, fondu du backdrop. Les deux ne peuvent pas être
 *    synchronisées : le calque ne part qu'une fois la requête revenue ET
 *    l'affiche mesurée, donc s'efface tantôt avant, tantôt après la fin de la
 *    cascade. Quand c'est avant, on découvre le titre et l'affiche à mi-opacité,
 *    puis l'entrée se termine sous nos yeux.
 * 2. **On sort du lecteur** (`arrivesFromPlayer`) : la fiche était là avant la
 *    lecture, on ne l'ouvre pas, on la retrouve.
 * 3. **Le document vient d'être chargé sur cette fiche** (`landingPath`) :
 *    rechargement, lien direct, onglet restauré. Personne n'a cliqué sur rien.
 * 4. **La navigation vient d'un greffon** (`arrivesFromPlugin`) : quelqu'un a
 *    bien cliqué, mais dans une iframe sandboxée qui ne peut rien déposer ici.
 *    Le cadre du greffon disparaît d'un bloc et la fiche se monte sur du vide —
 *    le décor de l'ouverture n'a alors PLUS RIEN à quoi s'enchaîner.
 *
 * Dans les cas 2, 3 et 4, l'entrée se jouait en entier par-dessus un écran encore
 * noir — dont le fondu plein cadre du backdrop, le geste MÊME du calque. Ça se
 * lit comme une transition qui rate son départ, pas comme une arrivée.
 */
export function skipsEntrance(origin: DetailOrigin | null): boolean {
  return origin !== null
    || arrivesFromPlayer()
    || arrivesFromPlugin()
    || (typeof window !== "undefined" && window.location.pathname === landingPath);
}

/**
 * Relit l'origine si elle concerne bien cet item et vient d'être posée. Toute
 * autre entrée sur la fiche (lien partagé, rechargement, retour navigateur)
 * retombe sur un simple fondu.
 *
 * La lecture est NON DESTRUCTIVE, et c'est essentiel : appelée depuis un
 * initialiseur `useState`, elle est exécutée DEUX FOIS par React en mode
 * strict (cf. `<StrictMode>` dans main.tsx). La version qui remettait
 * `pending` à null au premier appel renvoyait donc null au second — la fiche
 * ne recevait jamais son origine et l'animation d'ouverture ne se déclenchait
 * pas du tout en développement. Ce sont l'identifiant et l'ancienneté qui
 * bornent la validité, pas l'effet de bord de la lecture.
 */
export function consumeDetailOrigin(itemId: string | undefined): DetailOrigin | null {
  const origin = pending;
  if (!origin || !itemId || origin.itemId !== itemId) return null;
  if (Date.now() - origin.stamp > MAX_AGE_MS) return null;
  return origin;
}
