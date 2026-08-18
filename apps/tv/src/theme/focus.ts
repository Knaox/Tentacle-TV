import { BRAND } from "@tentacle-tv/shared";
import { TV_CARD_FOCUS, TV_FOCUS_RING } from "@tentacle-tv/theme";

export type FocusVariant = "card" | "button" | "row" | "default";

/** @deprecated Le focus n'est plus animé au ressort — voir `FocusTiming`. */
export const FocusSpring = { damping: 18, stiffness: 200 } as const;

/**
 * La durée du focus, reprise de la référence webOS.
 *
 * Un ressort donne un rebond, et un rebond sur une grille d'affiches se lit
 * comme une hésitation : la carte dépasse sa taille puis revient, alors que
 * l'utilisateur a déjà appuyé sur la flèche suivante. Une durée courte et une
 * sortie franche collent au rythme d'une télécommande.
 */
export const FocusTiming = { duration: TV_CARD_FOCUS.duree } as const;

/**
 * L'agrandissement au focus, par variante.
 *
 * Les cartes reprennent la valeur de la référence — voir `TV_CARD_FOCUS`, où
 * elle est partagée avec la LG.
 */
export const FocusScale = {
  card: TV_CARD_FOCUS.echelle,
  button: 1.07,
  row: 1.0,
  default: TV_CARD_FOCUS.echelle,
  normal: 1.0,
  /** Hero CTA gets a subtle 1.02 scale — applied manually inside hero. */
  hero: 1.02,
} as const;

/**
 * L'anneau net dessiné autour de l'élément focalisé.
 *
 * **Blanc, et non violet.** Une affiche peut être de n'importe quelle couleur,
 * y compris violette ; seul le blanc s'y détache à coup sûr. C'est le choix de
 * la référence, et il est partagé — voir `TV_FOCUS_RING`.
 *
 * Pleinement opaque : un anneau translucide se confond avec le bord clair d'une
 * affiche, exactement là où il doit trancher.
 */
export const FocusBorder = {
  width: TV_FOCUS_RING.epaisseur,
  color: TV_FOCUS_RING.teinte,
  opacity: 1,
} as const;

/**
 * Le halo de marque, derrière l'anneau.
 *
 * C'est lui qui décolle l'élément du fond : l'anneau blanc dit OÙ, le halo dit
 * DEVANT. Ses mesures viennent de `TV_FOCUS_RING`, partagées avec la LG — où le
 * même effet s'écrit `0 0 18px 4px rgba(brand, .5)`.
 *
 * L'étalement (`spread`) du CSS n'a pas d'équivalent natif ; le flou l'absorbe.
 */
export const FocusGlow = {
  color: BRAND.glow,
  opacity: TV_FOCUS_RING.haloOpacite,
  shadowColor: BRAND.violet,
  shadowOpacity: TV_FOCUS_RING.haloOpacite,
  shadowRadius: TV_FOCUS_RING.haloFlou,
  elevation: 12,
} as const;

/**
 * Variante « ligne » — entrées du rail, lignes de liste, panneaux de choix.
 *
 * Alignée sur la référence webOS, qui remplit la ligne d'un blanc translucide
 * au lieu d'y poser une barre violette : `--fill-strong` au focus,
 * `--fill-soft` pour la ligne active. La barre a disparu pour la même raison —
 * elle n'existe sur aucune des trois cibles de référence, et deux repères
 * concurrents sur la même ligne se disputent le regard.
 *
 * Les valeurs viennent des jetons partagés : ce sont exactement celles que la
 * feuille de la LG applique à `.rail-entree:focus` et `[data-active="true"]`.
 */
export const FocusRowStyle = {
  /** `--fill-strong` — la ligne qui porte le focus. */
  bgColor: "rgba(255, 255, 255, 0.28)",
  /** `--fill-soft` — la ligne de la page où l'on se trouve. */
  activeBgColor: "rgba(255, 255, 255, 0.08)",
} as const;

/**
 * Button variant — focus state for action buttons (Play, More info, etc.).
 */
export const FocusButtonStyle = {
  bgColor: "rgba(139, 92, 246, 0.20)",
  borderColor: "rgba(139, 92, 246, 0.6)",
  borderWidth: 2,
} as const;
