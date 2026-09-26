import type { CSSProperties } from "react";

/**
 * Les en-têtes de section de l'app (`sectionHeaderStyle` d'`AboutScreen` et de
 * `CreditsScreen`) : 12 gras, capitales, interlettrage 0,8, opacité 0,85,
 * marge basse 12, retrait 4.
 */
export const SECTION_HEADER_STYLE: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.8,
  opacity: 0.85,
  marginBottom: 12,
  paddingLeft: 4,
  paddingRight: 4,
  color: "var(--text-primary)",
};

/** La pastille d'icône de marque (fond `brand.soft`, icône `brand.light`). */
export function brandTile(size: number, radius: number): CSSProperties {
  return {
    width: size,
    height: size,
    borderRadius: radius,
    background: "var(--brand-soft)",
    color: "var(--brand-light)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };
}
