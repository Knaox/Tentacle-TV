/**
 * Le système de boutons du mobile — la RÈGLE, pure (ni React ni React Native),
 * testée hors appareil. Les composants (`PrimaryButton`, `SecondaryButton`,
 * `PlainButton`, `GlassButton`, `IconButton`) ne font qu'appliquer ce qu'elle
 * rend.
 *
 * Hiérarchie (retour de Damien, 20/10 : « si tout est en couleur on se perd ») :
 * - `primary` : UNE action par écran au plus, au dégradé de marque (Lire,
 *   Continuer, Inviter…) — ou la pilule blanche (`contrast`) là où la marque
 *   est déjà prise par la lecture.
 * - `secondary` : neutre. iOS : capsule grise translucide (le `.bordered`
 *   d'Apple) ; Android : contour fin (M3 « outlined »), jamais de verre.
 * - `plain` : du texte seul, pour les options et les sorties (« Plus tard »,
 *   « Annuler », « Tout retirer »). Le ton `accent` est réservé aux liens.
 * - `glass` : les contrôles qui flottent sur une IMAGE (lecteur, en-tête posé
 *   sur une affiche) — Liquid Glass sur iOS 26, flou avant, voile sombre plein
 *   sur Android.
 * Le danger n'est jamais un pavé rouge : un libellé rouge (`destructive`).
 * Une cible tactile tient TOUJOURS 44 pt (iOS) / 48 dp (Android), même quand
 * le bouton paraît plus petit : la différence passe en `hitSlop`.
 */

export type ButtonPlatform = "ios" | "android";
export type ButtonKind = "primary" | "secondary" | "plain" | "glass";
export type ButtonTone = "neutral" | "accent" | "destructive" | "contrast";
export type ButtonSize = "sm" | "md" | "lg";

/** Ce que la règle lit de la palette (sous-ensemble de `ThemePalette`). */
export interface ButtonPaletteSlice {
  brand: { violet: string; light: string };
  text: { primary: string; secondary: string };
  status: { error: string };
  fill: { soft: string; medium: string };
  border: { strong: string };
  cta: { brandFg: string; primaryBg: string; primaryFg: string; primaryBorder?: string };
  onMedia: { primary: string };
}

/** `brand` = le dégradé de marque (`ctaGradient`) ; `glass` = la matière de verre. */
export type ButtonFill = { kind: "brand" } | { kind: "glass" } | { kind: "solid"; color: string } | { kind: "none" };

export interface ButtonMetrics {
  height: number;
  padX: number;
  fontSize: number;
  iconSize: number;
  gap: number;
}

export interface ButtonLook extends ButtonMetrics {
  radius: number;
  fill: ButtonFill;
  fg: string;
  borderColor: string | null;
  borderWidth: number;
  /** Poids de police : semi-gras sur iOS, medium sur Android (M3 « label large »). */
  weight: "semibold" | "medium";
  letterSpacing: number;
  /** Marge tactile verticale pour atteindre la cible minimale. */
  hitSlopY: number;
}

/** Cible tactile minimale : 44 pt chez Apple, 48 dp chez Google. */
export const MIN_TARGET: Record<ButtonPlatform, number> = { ios: 44, android: 48 };

const METRICS: Record<ButtonPlatform, Record<ButtonSize, ButtonMetrics>> = {
  // Apple : petit 34 (contrôle compact), moyen 44, grand 50 (pleine largeur).
  ios: {
    sm: { height: 34, padX: 14, fontSize: 15, iconSize: 15, gap: 6 },
    md: { height: 44, padX: 20, fontSize: 16, iconSize: 17, gap: 8 },
    lg: { height: 50, padX: 24, fontSize: 17, iconSize: 18, gap: 8 },
  },
  // Material 3 : 32 (compact), 40 (bouton standard), 48 (pleine largeur).
  android: {
    sm: { height: 32, padX: 12, fontSize: 13, iconSize: 16, gap: 6 },
    md: { height: 40, padX: 24, fontSize: 14, iconSize: 18, gap: 8 },
    lg: { height: 48, padX: 24, fontSize: 15, iconSize: 18, gap: 8 },
  },
};

export function buttonMetrics(platform: ButtonPlatform, size: ButtonSize): ButtonMetrics {
  return METRICS[platform][size];
}

/** Couleur d'un libellé selon son ton, sur une surface de l'app (pas sur une image). */
export function toneColor(c: ButtonPaletteSlice, tone: ButtonTone, isDark: boolean): string {
  switch (tone) {
    case "destructive":
      return c.status.error;
    // Le violet vif tombe sous 4,5:1 sur le noir : la nuance claire en sombre.
    case "accent":
      return isDark ? c.brand.light : c.brand.violet;
    default:
      return c.text.primary;
  }
}

export interface ResolveButtonInput {
  platform: ButtonPlatform;
  kind: ButtonKind;
  tone?: ButtonTone;
  size?: ButtonSize;
  isDark: boolean;
  colors: ButtonPaletteSlice;
}

export function resolveButtonLook({ platform, kind, tone = "neutral", size = "md", isDark, colors: c }: ResolveButtonInput): ButtonLook {
  const m = buttonMetrics(platform, size);
  const base = {
    ...m,
    radius: m.height / 2,
    weight: platform === "ios" ? ("semibold" as const) : ("medium" as const),
    letterSpacing: platform === "ios" ? -0.2 : 0.1,
    hitSlopY: Math.max(0, Math.ceil((MIN_TARGET[platform] - m.height) / 2)),
    borderColor: null,
    borderWidth: 0,
  };
  switch (kind) {
    case "primary":
      return tone === "contrast"
        ? {
            ...base,
            fill: { kind: "solid", color: c.cta.primaryBg },
            fg: c.cta.primaryFg,
            borderColor: c.cta.primaryBorder ?? null,
            borderWidth: c.cta.primaryBorder ? 1 : 0,
          }
        : { ...base, fill: { kind: "brand" }, fg: c.cta.brandFg };
    case "secondary":
      return platform === "ios"
        ? { ...base, fill: { kind: "solid", color: c.fill.medium }, fg: toneColor(c, tone, isDark) }
        : {
            ...base,
            fill: { kind: "none" },
            fg: toneColor(c, tone, isDark),
            borderColor: c.border.strong,
            borderWidth: 1,
          };
    case "plain":
      // Un texte seul n'a pas de capsule à remplir : son marge latérale se
      // réduit pour s'aligner sur le contenu.
      return { ...base, padX: Math.min(base.padX, 12), fill: { kind: "none" }, fg: toneColor(c, tone, isDark) };
    case "glass":
      return { ...base, fill: { kind: "glass" }, fg: tone === "destructive" ? c.status.error : c.onMedia.primary };
  }
}

/** Voile d'appui (iOS) ou ondulation (Android), selon ce que porte le bouton. */
export function pressOverlayColor(kind: ButtonKind, tone: ButtonTone, isDark: boolean): string {
  if (kind === "primary") return tone === "contrast" ? "rgba(0, 0, 0, 0.08)" : "rgba(0, 0, 0, 0.18)";
  if (kind === "glass") return "rgba(255, 255, 255, 0.14)";
  return isDark ? "rgba(255, 255, 255, 0.10)" : "rgba(0, 0, 0, 0.07)";
}

/**
 * L'option CHOISIE d'un segmenté ou d'une rangée de puces de réglage : le
 * « pouce » neutre du sélecteur segmenté d'Apple (blanc en clair, gris levé
 * en sombre), libellé du thème — jamais le dégradé de marque. Une page de
 * réglages en alignait une dizaine, autant de pavés violets à l'écran.
 */
export function selectedOptionLook(isDark: boolean, c: Pick<ButtonPaletteSlice, "text">): { bg: string; fg: string; shadowOpacity: number } {
  return isDark
    ? { bg: "rgba(255, 255, 255, 0.18)", fg: c.text.primary, shadowOpacity: 0 }
    : { bg: "#FFFFFF", fg: c.text.primary, shadowOpacity: 0.12 };
}
