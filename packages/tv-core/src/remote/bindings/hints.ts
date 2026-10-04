/**
 * Les INDICATIONS DE TOUCHES : tout texte à l'écran qui nomme une touche de la
 * télécommande (« Maintenir OK : plus d'options », « Lecture/Pause :
 * demander »…). Il vient de la table de la plateforme, jamais d'une clé i18n
 * écrite en dur dans une vue : une télécommande qui n'a pas la touche, ou qui
 * la nomme autrement, dit autre chose sans qu'aucun écran ne change.
 *
 * Chaque indication est une clé i18n complète (`espace:clé`), ou `null` quand
 * la plateforme n'a rien à dire (l'écran ne montre alors pas l'indication).
 * Les mots restent dans `packages/shared/src/i18n/locales/{fr,en}/` ; la table
 * ne choisit que LAQUELLE.
 *
 * Une nouvelle indication : un identifiant ici, sa clé dans CHAQUE table
 * (le typage l'exige), et la vue qui la lit par `remoteHint(id)` (adaptateur).
 *
 * Module pur : ni DOM, ni React Native.
 */

export const REMOTE_HINT_IDS = [
  /** Sous une carte focalisée : l'appui maintenu ouvre le grand panneau. */
  "holdForOptions",
  /** Le rail ouvert : l'appui maintenu organise les entrées. */
  "railOrganize",
  /** Le rail en déplacement d'une entrée : la croix déplace… */
  "railMove",
  /** … OK pose, Retour annule. */
  "railDrop",
  /** Réglages, ordre de la navigation : OK déplace… */
  "navigationMove",
  /** … et en déplacement : haut, bas, OK pose. */
  "navigationMoving",
  /** Pied de la feuille des saisons : le raccourci qui demande. */
  "seasonsShortcut",
  /** Sous une carte absente : OK demande. */
  "absentRequest",
  /** Sous une carte absente ou une série à compléter : OK ouvre les saisons. */
  "absentSeasons",
  /** L'échelle de la note : la croix choisit, OK note. */
  "ratingRuler",
  /** Lecteur, déplacement dans la vidéo : OK lit ici… */
  "scrubConfirm",
  /** … Retour annule. */
  "scrubCancel",
  /** Lecteur, le décompte d'un déplacement : OK lit ici… */
  "scrubPlayHere",
  /** … Retour revient au point de départ. */
  "scrubGoBack",
  /** Un geste qui demande un second OK (déjumeler). */
  "unpairAgain",
  /** Un geste qui demande un second OK (confirmer). */
  "pressAgainToConfirm",
] as const;

export type RemoteHintId = (typeof REMOTE_HINT_IDS)[number];

/** Une clé i18n complète par indication ; `null` : rien à dire. */
export type RemoteHints = Readonly<Record<RemoteHintId, string | null>>;

/**
 * Les mots d'une télécommande de salon à croix, OK, Retour et Lecture/Pause —
 * ceux de la Siri Remote, que les autres tables reprennent en ne changeant que
 * ce qui diffère.
 */
export const BASE_REMOTE_HINTS: RemoteHints = {
  holdForOptions: "cards:holdForOptions",
  railOrganize: "nav:railHintOrganize",
  railMove: "nav:railHintMove",
  railDrop: "nav:railHintDrop",
  navigationMove: "preferences:navigationMoveHint",
  navigationMoving: "preferences:navigationMovingHint",
  seasonsShortcut: "requests:seasonsShortcut",
  absentRequest: "requests:hintRequest",
  absentSeasons: "requests:hintSeasons",
  ratingRuler: "cards:ratingRulerHint",
  scrubConfirm: "player:scrubConfirmHint",
  scrubCancel: "player:scrubCancelHint",
  scrubPlayHere: "player:scrubOtherPlayHere",
  scrubGoBack: "player:scrubOtherGoBack",
  unpairAgain: "pairing:tvUnpairHint",
  pressAgainToConfirm: "preferences:tvPressAgainToConfirm",
};
