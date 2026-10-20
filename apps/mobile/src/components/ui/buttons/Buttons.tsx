import { memo } from "react";

import { ButtonBase, type ButtonProps } from "./ButtonBase";

/**
 * Les quatre boutons du mobile. Règle d'emploi (détail : `buttonLook.ts`) :
 * UN `PrimaryButton` par écran au plus ; le reste en `SecondaryButton` ou
 * `PlainButton` ; `GlassButton` seulement sur une image.
 */

export interface PrimaryButtonProps extends ButtonProps {
  /**
   * `brand` (défaut) : le dégradé violet → rose. `contrast` : la pilule
   * blanche, quand la marque est déjà prise par la lecture sur l'écran.
   */
  tone?: "brand" | "contrast";
}

/** L'action principale de l'écran — une seule. */
export const PrimaryButton = memo(function PrimaryButton({ tone = "brand", ...rest }: PrimaryButtonProps) {
  return <ButtonBase {...rest} kind="primary" tone={tone === "contrast" ? "contrast" : "neutral"} />;
});

export interface NeutralButtonProps extends ButtonProps {
  /** `destructive` : libellé rouge, jamais de pavé rouge. `accent` (plain) : un lien. */
  tone?: "neutral" | "accent" | "destructive";
}

/** Une action à côté de la principale : capsule grise (iOS), contour fin (Android). */
export const SecondaryButton = memo(function SecondaryButton({ tone = "neutral", ...rest }: NeutralButtonProps) {
  return <ButtonBase {...rest} kind="secondary" tone={tone} />;
});

/** Du texte seul : options, sorties (« Plus tard », « Annuler »), liens. */
export const PlainButton = memo(function PlainButton({ tone = "neutral", ...rest }: NeutralButtonProps) {
  return <ButtonBase {...rest} kind="plain" tone={tone} />;
});

export interface GlassButtonProps extends ButtonProps {
  tone?: "neutral" | "destructive";
}

/**
 * Un bouton à libellé posé sur une IMAGE : Liquid Glass (iOS 26), flou
 * (iOS d'avant), voile sombre (Android). Jamais sur une surface de l'app.
 */
export const GlassButton = memo(function GlassButton({ tone = "neutral", ...rest }: GlassButtonProps) {
  return <ButtonBase {...rest} kind="glass" tone={tone} />;
});
