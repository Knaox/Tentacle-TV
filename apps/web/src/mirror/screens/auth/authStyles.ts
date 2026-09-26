import type { CSSProperties } from "react";

/**
 * `makeAuthStyles` de l'app (`components/auth/authStyles.ts`), en styles DOM.
 * Titre 28 extra-gras −0,6 centré ; sous-titre 13 medium `brand.light` 0,3 ;
 * champ 44, rayon 8, `fill.subtle`, filet subtil, retrait 16 ; lien 13 medium
 * `brand.light` 0,2.
 */
export const AUTH_TITLE: CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  letterSpacing: -0.6,
  textAlign: "center",
  marginBottom: 6,
  color: "var(--text-primary)",
};

export const AUTH_SUBTITLE: CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  letterSpacing: 0.3,
  textAlign: "center",
  marginBottom: 24,
  color: "var(--brand-light)",
};

/**
 * 16 au lieu des 15 de l'app : sous 16 px, Safari iOS zoome au focus.
 */
export const AUTH_INPUT_CLASS =
  "block w-full rounded-lg border border-line-subtle bg-fill-subtle text-content-primary outline-none placeholder:text-content-quaternary focus:border-[var(--brand)]";
export const AUTH_INPUT_STYLE: CSSProperties = { height: 44, padding: "0 16px", fontSize: 16 };

export const AUTH_LINK: CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  letterSpacing: 0.2,
  color: "var(--brand-light)",
};

/** Les messages d'erreur rouges des écrans d'authentification (13 medium). */
export const AUTH_ERROR: CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  marginTop: 12,
  color: "var(--status-error)",
};

/** Les liens secondaires : 44 de haut, centrés. */
export const AUTH_LINK_ROW =
  "flex w-full items-center justify-center active:opacity-70";
