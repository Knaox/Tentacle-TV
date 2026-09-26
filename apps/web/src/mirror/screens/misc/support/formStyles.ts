import type { CSSProperties } from "react";

/** `sectionLabelStyle` du composeur de l'app : 12 gras, capitales, 0,6, texte à 85 %. */
export const FIELD_LABEL_STYLE: CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.6,
  marginBottom: 8,
  color: "color-mix(in srgb, var(--text-primary) 85%, transparent)",
};

/**
 * `inputStyle` de l'app : `fill.subtle`, filet subtil, rayon 8, padding 12 × 14.
 * Seul écart : 16 au lieu de 15 — sous 16 px, Safari iOS zoome la page au
 * focus d'un champ (le viewport du web ne l'interdit pas).
 */
export const INPUT_FONT_SIZE = 16;

export const INPUT_CLASS =
  "w-full rounded-lg border border-line-subtle bg-fill-subtle text-content-primary outline-none placeholder:text-content-quaternary focus:border-[var(--brand)]";

export const INPUT_STYLE: CSSProperties = { padding: "12px 14px", fontSize: INPUT_FONT_SIZE };
