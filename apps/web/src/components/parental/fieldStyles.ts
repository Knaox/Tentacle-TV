/**
 * Les classes des champs des droits et du contrôle parental — des raccourcis vers
 * les contrôles du socle (`theme/buttons.css`, `theme/overlays.css`), réunis pour
 * ne pas se recopier : le champ, la pilule, la pression et le focus sont dans la classe.
 */
const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

/** Un `<select>` natif : clavier, lecteurs d'écran et menus tactiles sont ceux du système. */
export const SELECT = "field cursor-pointer appearance-none pl-3 pr-9 text-[13px] font-medium disabled:cursor-not-allowed [&>option]:bg-surface-2 [&>option]:text-content-primary";

export const INPUT = "field px-3 text-[13px]";

/** L'action posée à côté d'un champ : la pilule secondaire, à sa hauteur (40 px). */
export const SMALL_BUTTON = "btn btn-soft text-[13px]";

/** Une pastille d'étiquette, avec sa croix. */
export const CHIP = "inline-flex max-w-full items-center gap-1 rounded-full bg-fill-soft py-1 pl-3 pr-1 text-xs font-medium text-content-primary";

export const CHIP_REMOVE = "icon-btn h-6 w-6 text-content-tertiary";

/** Une case à cocher native, à la teinte franche. */
export const CHECKBOX = `h-4 w-4 shrink-0 cursor-pointer rounded accent-[var(--accent)] disabled:cursor-not-allowed ${FOCUS}`;

export const FIELD_LABEL = "block text-sm font-medium text-content-primary";
export const FIELD_HINT = "mt-0.5 block text-xs leading-relaxed text-content-tertiary";
