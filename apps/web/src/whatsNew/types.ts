import type { ComponentType } from "react";

export type WhatsNewKind = "new" | "improved" | "fixed";

/**
 * Ce que reçoit une scène. `active` : elle est sur scène ET visible (onglet au
 * premier plan, cadre à l'écran) — à faux elle se met en pause, elle ne se
 * démonte pas : c'est l'écran qui ne monte que la scène courante. `reduced` :
 * mouvement réduit, l'image finale, fixe.
 */
export interface SceneProps {
  active: boolean;
  reduced: boolean;
}

export interface WhatsNewFeature {
  /** Unique dans sa release ; jamais de suffixe `_one`/`_other` (pluriels i18next). */
  id: string;
  kind: WhatsNewKind;
  /** Clés NUES de l'espace `whatsNew` — l'écran préfixe. */
  titleKey: string;
  bodyKey: string;
  Scene: ComponentType<SceneProps>;
  /** Lien profond « Voir dans l'app » : un chemin absolu de l'app. */
  route?: string;
}

export interface WhatsNewRelease {
  /** Version desktop, telle que `versions.json → desktop`. */
  version: string;
  /** Vide = « rien à montrer », en connaissance de cause. */
  features: WhatsNewFeature[];
}

/** Une nouveauté retenue pour l'écran, annotée de la version qui l'a livrée. */
export type WhatsNewSelectedFeature = WhatsNewFeature & { version: string };
