import { CARD_STATUS_ORDER, type CardStatusKind } from "./cardMarkers";

/**
 * Le SURVOL d'une carte média — le modèle UNIQUE que toutes les plateformes
 * rendent, comme `cardMarkers.ts` l'est pour le repos.
 *
 * Les marqueurs disent ce que l'utilisateur a déjà fait d'un titre ; le survol
 * dit ce qu'il peut en faire, et reprend ces mêmes états là où on les
 * bascule. Une carte sans survol, ou dont le survol offre moins que sa
 * voisine, se lit comme une autre application : c'est ce qui était arrivé
 * aux recommandations, à la recherche et à certains carrousels mobiles.
 *
 * Trois variantes, UNE grammaire :
 *   • `poster`    — l'affiche 2:3 : rangées, grilles, collections, recherche,
 *                    rails de la fiche, page personne. Le clic ouvre la fiche.
 *   • `landscape` — la vignette 16:9 (Reprendre, Prochains épisodes) : le clic
 *                    y LANCE la lecture, la fiche passe donc par un bouton.
 *   • `reco`      — la carte de recommandation : l'affiche, plus « Ne plus me
 *                    proposer », pour un titre parfois hors bibliothèque.
 *
 * Aucun GROS bouton de lecture sur l'image, dans aucune variante : le clic de
 * la carte fait déjà l'action principale. La lecture reste un geste du
 * plateau, discret et en tête, là seulement où le clic ne la lance pas
 * (`playInTray`) ; une feuille — l'appui long, la télécommande — la garde en
 * tête dans tous les cas, puisqu'elle remplace la carte.
 *
 * Seule l'ENTRÉE change d'une plateforme à l'autre, jamais le fond :
 *   • la souris (web, bureau) : un calque monté au survol ;
 *   • le doigt (mobile, miroir) : la feuille de l'appui long ;
 *   • la télécommande (tvOS, Android TV, webOS) : le focus tient lieu de
 *     survol, l'appui long ouvre les mêmes actions.
 *
 * Ce module ne décide que de CE QUI est offert, dans quel ordre, et sous quel
 * libellé. La forme appartient à chaque plateforme.
 */

export type CardOverlayVariant = "poster" | "landscape" | "reco";

/** Une bascule du survol — exactement un état de la pastille du repos. */
export type CardToggleKind = CardStatusKind;

/**
 * L'ordre du plateau : celui de la pastille d'états (signet, cœur, coche).
 * L'état qu'on voyait au repos se retrouve exactement là où on le bascule.
 */
export const CARD_TOGGLE_ORDER: readonly CardToggleKind[] = CARD_STATUS_ORDER;

/**
 * Ce qui suit les bascules, au bout du plateau, dans cet ordre :
 *   • `offline` — garder hors ligne, là où la plateforme le permet — PAS sur
 *     une recommandation : c'est une surface de découverte, et son plateau,
 *     qui porte déjà « Ne plus me proposer », passerait à six boutons. Sur
 *     l'affiche la plus étroite du bureau (137 px), six cibles ne peuvent pas
 *     tenir l'espacement de WCAG 2.5.8 ; le titre se garde depuis sa fiche ;
 *   • `details` — la fiche, sur une carte dont le clic lance la lecture ;
 *   • `dismiss` — « Ne plus me proposer », sur une recommandation.
 */
export type CardTrayExtra = "offline" | "details" | "dismiss";

export interface CardOverlayInput {
  variant: CardOverlayVariant;
  /** La carte porte un item de la bibliothèque. Faux : recommandation « à la demande ». */
  inLibrary: boolean;
  /** Quelque chose se lance depuis la carte — film, épisode, série. Faux : collection, saison. */
  playable: boolean;
  /** Lecture entamée (film, épisode) ou épisode à suivre (série) : « Reprendre ». */
  resume?: boolean;
  /** Le titre a une identité de notation, ou la carte sait la résoudre. Faux : pas d'étoiles. */
  rateable: boolean;
  /** La plateforme garde hors ligne, et ce titre s'y prête. */
  offline?: boolean;
  /**
   * Titre lu sur le DISQUE (catalogue local, fiche locale), sans le serveur —
   * hors ligne, ou sur la page « Sur cet appareil ». Seule la coche « vu » s'y
   * bascule (en base locale) : Ma liste et les favoris vivent sur le serveur,
   * la note aussi (moteur de notes), et le titre est déjà sur l'appareil.
   */
  local?: boolean;
}

export interface CardOverlay {
  variant: CardOverlayVariant;
  /** La lecture — « Lire » ou « Reprendre » —, `null` quand rien ne se lance. */
  play: { labelKey: "play" | "resume" } | null;
  /**
   * La lecture a sa place EN TÊTE DU PLATEAU du survol : seulement quand le
   * clic de la carte ne la lance pas déjà. Une affiche ouvre la fiche au clic,
   * son plateau offre donc « Lire » ; la vignette 16:9 EST la lecture, son
   * plateau n'en répète rien. Les feuilles ignorent ce champ.
   */
  playInTray: boolean;
  /** Ce que fait le clic (le tap, la validation) sur la carte, hors boutons. */
  open: "details" | "play";
  /** Les étoiles de notation. */
  rate: boolean;
  /** Les bascules, dans l'ordre du plateau. Vides hors bibliothèque. */
  toggles: readonly CardToggleKind[];
  /** Ce qui suit les bascules, dans l'ordre. */
  extras: readonly CardTrayExtra[];
}

const NO_TOGGLES: readonly CardToggleKind[] = [];
const LOCAL_TOGGLES: readonly CardToggleKind[] = ["watched"];

/**
 * Le survol d'une carte.
 *
 * Hors bibliothèque, il n'y a ni lecture ni bascule — rien à mettre dans Ma
 * liste, rien à marquer vu —, mais la note reste (elle vit sur le tmdb) et
 * le refus d'une recommandation aussi.
 */
export function resolveCardOverlay(input: CardOverlayInput): CardOverlay {
  const { variant } = input;
  const local = input.local === true;
  // Un titre gardé sur l'appareil vient de la bibliothèque, même lu sans elle.
  const inLibrary = input.inLibrary || local;
  const playable = inLibrary && input.playable;
  // La vignette 16:9 se LANCE au clic : c'est tout l'objet de « Reprendre ».
  // Une vignette qui n'a rien à lire retombe sur la fiche, comme une affiche.
  const open = variant === "landscape" && playable ? "play" : "details";

  const extras: CardTrayExtra[] = [];
  if (inLibrary && !local && input.offline === true && variant !== "reco") extras.push("offline");
  if (open === "play") extras.push("details");
  if (variant === "reco") extras.push("dismiss");

  return {
    variant,
    play: playable ? { labelKey: input.resume === true ? "resume" : "play" } : null,
    playInTray: playable && open !== "play",
    open,
    rate: input.rateable && !local,
    toggles: local ? LOCAL_TOGGLES : inLibrary ? CARD_TOGGLE_ORDER : NO_TOGGLES,
    extras,
  };
}

/** L'état des trois bascules d'une carte (`useCardToggles`). */
export type CardToggleStates = Readonly<Record<CardToggleKind, boolean>>;

/**
 * Des bascules fournies par l'appelant plutôt que lues sur le serveur — un
 * titre `local`, dont la coche « vu » vit en base sur l'appareil.
 */
export interface CardToggleHandlers {
  states: CardToggleStates;
  onToggle: (kind: CardToggleKind) => void;
}

const TOGGLE_LABEL_KEYS: Record<CardToggleKind, readonly [add: string, remove: string]> = {
  watchlist: ["addToWatchlist", "removeFromWatchlist"],
  favorite: ["addToFavorites", "removeFromFavorites"],
  watched: ["markWatched", "markUnwatched"],
};

/**
 * Clé (espace `cards`) du libellé d'une bascule : il dit ce que fera le geste,
 * donc il dépend de l'état — « Ajouter à ma liste » / « Retirer de ma liste ».
 */
export function cardToggleLabelKey(kind: CardToggleKind, active: boolean): string {
  const [add, remove] = TOGGLE_LABEL_KEYS[kind];
  return active ? remove : add;
}

const EXTRA_LABEL_KEYS: Record<CardTrayExtra, string> = {
  offline: "keepOffline",
  details: "moreInfo",
  dismiss: "dismiss",
};

/** Clé (espace `cards`) du libellé d'un extra du plateau. */
export function cardExtraLabelKey(extra: CardTrayExtra): string {
  return EXTRA_LABEL_KEYS[extra];
}

/** Une action de carte, telle qu'une feuille ou un menu la présente. */
export interface CardActionEntry {
  kind: "play" | CardToggleKind | CardTrayExtra;
  /** Clé du libellé, espace `cards`. */
  labelKey: string;
  /** L'état courant — bascules seulement. */
  active?: boolean;
}

/**
 * Les actions du survol, à plat, dans l'ordre où une FEUILLE les présente —
 * l'appui long du mobile, le menu de la télécommande : la lecture d'abord
 * (quelle que soit la variante : la feuille remplace la carte, son clic
 * n'est plus là), puis les bascules, puis les extras. La note n'y figure
 * pas : elle se rend en étoiles, à part (`overlay.rate`).
 */
export function cardActionEntries(overlay: CardOverlay, states: CardToggleStates): CardActionEntry[] {
  const entries: CardActionEntry[] = [];
  if (overlay.play) entries.push({ kind: "play", labelKey: overlay.play.labelKey });
  for (const kind of overlay.toggles) {
    const active = states[kind] === true;
    entries.push({ kind, labelKey: cardToggleLabelKey(kind, active), active });
  }
  for (const extra of overlay.extras) entries.push({ kind: extra, labelKey: cardExtraLabelKey(extra) });
  return entries;
}
