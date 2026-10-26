/**
 * Les boutons d'une ligne de réglage du web large (`SettingItem`) : un geste
 * ponctuel (changer de serveur, vider le cache), ou destructif (zone sensible).
 * Cible de 36 px au moins, focus visible.
 */
export const SETTING_BUTTON =
  "min-h-9 rounded-full border border-line-strong px-4 py-1.5 text-sm text-content-secondary transition-colors hover:bg-fill-soft hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus disabled:opacity-50";

export const SETTING_DANGER_BUTTON =
  "min-h-9 rounded-full border border-danger-border bg-danger-surface px-4 py-1.5 text-sm font-medium text-status-error transition-colors hover:bg-danger-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus disabled:opacity-50";
