/**
 * Les classes des boutons de la page Famille — celles des réglages
 * (`MyDevicesSection`, `ConfirmDialog`), réunies pour ne pas se recopier
 * d'un composant à l'autre. Le bouton de marque porte en plus
 * `BRAND_BUTTON_STYLE` (le dégradé profond, lisible sous un libellé blanc).
 */
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

export const SMALL_BUTTON = `inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg border border-line-subtle bg-fill-soft px-3 text-xs font-semibold text-content-primary transition-colors hover:bg-fill-medium disabled:cursor-not-allowed disabled:opacity-45 ${FOCUS}`;

export const SMALL_DANGER_BUTTON = `inline-flex min-h-[36px] items-center justify-center rounded-lg bg-danger-surface px-3 text-xs font-semibold text-status-error-fg transition-colors hover:bg-danger-surface-hover disabled:cursor-not-allowed disabled:opacity-45 ${FOCUS}`;

export const BRAND_BUTTON = `inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-cta-brand-fg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45 ${FOCUS}`;

export const SECONDARY_BUTTON = `inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line-subtle bg-fill-soft px-4 text-sm font-semibold text-content-primary transition-colors hover:bg-fill-medium disabled:cursor-not-allowed disabled:opacity-45 ${FOCUS}`;

export const BRAND_BUTTON_STYLE = { backgroundImage: "var(--cta-brand-gradient)" } as const;

/** Un champ de saisie des réglages. */
export const FIELD = `h-11 w-full rounded-lg border border-line-subtle bg-tentacle-surface px-3 text-sm text-content-primary placeholder:text-content-quaternary ${FOCUS}`;
