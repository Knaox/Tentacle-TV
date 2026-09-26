/**
 * Les pilules d'action du bandeau (`hero/heroCtaStyles.ts` de l'app),
 * partagées par les diapositives Jellyfin et de recommandation : « Lire » en
 * blanc à l'ombre neutre (44 de haut, 12/26, icône 20, texte 16 gras),
 * « Plus d'infos » en verre sombre CONSTANT posé sur l'affiche (12/20, texte
 * 15 semi-gras). Tablette : 16/34 et 16/24.
 */
export const HERO_CTA_ROW = "flex items-center gap-2.5";

export function heroPlayClass(isTablet: boolean): string {
  return [
    "flex min-h-[44px] items-center gap-[9px] rounded-full border border-cta-primary-border bg-cta-primary-bg",
    "text-base font-bold tracking-[0.1px] text-cta-primary-fg shadow-[0_6px_12px_rgba(0,0,0,0.35)] active:opacity-[0.88]",
    isTablet ? "px-[34px] py-4" : "px-[26px] py-3",
  ].join(" ");
}

export function heroInfoClass(isTablet: boolean): string {
  return [
    "flex min-h-[44px] items-center gap-1.5 rounded-full border text-[15px] font-semibold text-on-media-primary active:opacity-[0.88]",
    isTablet ? "px-6 py-4" : "px-5 py-3",
  ].join(" ");
}

/** Le verre sombre de « Plus d'infos » : constant dans les deux thèmes (posé sur média). */
export const HERO_INFO_STYLE = {
  background: "rgba(var(--scrim-media-rgb), 0.45)",
  borderColor: "var(--on-media-muted)",
} as const;

/** Ombre portée du texte sur affiche (`onMedia.shadow`). */
export const TITLE_SHADOW = "0 3px 12px var(--on-media-shadow)";
export const TEXT_SHADOW = "0 1px 4px var(--on-media-shadow)";
