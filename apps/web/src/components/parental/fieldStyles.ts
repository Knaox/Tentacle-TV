/**
 * Les classes des champs des droits et du contrôle parental — celles des
 * réglages (`UsersToolbar`, `InviteForm`), réunies pour ne pas se recopier.
 */
const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

/** Un `<select>` natif : clavier, lecteurs d'écran et menus tactiles sont ceux du système. */
export const SELECT = `h-10 w-full cursor-pointer appearance-none rounded-[10px] border border-line-subtle bg-tentacle-surface pl-3 pr-9 text-[13px] font-medium text-content-primary transition-colors duration-150 hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-tentacle-surface [&>option]:text-content-primary ${FOCUS}`;

export const INPUT = `h-10 w-full rounded-[10px] border border-line-subtle bg-tentacle-surface px-3 text-[13px] text-content-primary placeholder:text-content-quaternary transition-colors duration-150 hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;

export const SMALL_BUTTON = `inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-[10px] border border-line-subtle bg-fill-soft px-3 text-xs font-semibold text-content-primary transition-colors hover:bg-fill-medium disabled:cursor-not-allowed disabled:opacity-45 ${FOCUS}`;

/** Une pastille d'étiquette, avec sa croix. */
export const CHIP = "inline-flex max-w-full items-center gap-1 rounded-full border border-line-subtle bg-fill-soft py-1 pl-3 pr-1 text-xs font-medium text-content-primary";

export const CHIP_REMOVE = `flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-content-tertiary transition-colors hover:bg-fill-medium hover:text-content-primary disabled:opacity-45 ${FOCUS}`;

/** Une case à cocher native, teintée à la marque. */
export const CHECKBOX = `h-4 w-4 shrink-0 cursor-pointer rounded accent-[var(--brand)] disabled:cursor-not-allowed ${FOCUS}`;

export const FIELD_LABEL = "block text-sm font-medium text-content-primary";
export const FIELD_HINT = "mt-0.5 block text-xs leading-relaxed text-content-tertiary";
