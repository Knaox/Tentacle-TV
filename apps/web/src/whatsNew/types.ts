import type { ComponentType } from "react";
import type { ServerCapability } from "@tentacle-tv/shared";

export type WhatsNewKind = "new" | "improved" | "fixed";

/**
 * Ce que CET appareil sait faire et dont une nouveauté dépend, hors serveur :
 * `liquidGlass` — le verre natif de macOS 26 (le système le permet, quel que
 * soit le réglage). Liste FERMÉE, lue par `clientTraits.ts`.
 */
export type WhatsNewClientTrait = "liquidGlass";

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
  /** Réservée à un public : `admin` n'est montrée qu'aux administrateurs (cf. `forAudience`). */
  audience?: "admin";
  /**
   * La capacité du serveur sans laquelle la fonction n'existe pas dans l'app
   * (`serverCapabilities.ts`, shared) : face à un serveur qui ne la déclare
   * pas, la nouveauté n'est pas montrée (cf. `forServer`) — elle parlerait
   * d'une fonction que l'app cache.
   */
  capability?: ServerCapability;
  /**
   * Le trait de l'appareil sans lequel la fonction n'existe pas ici (cf.
   * `forClient`) : ailleurs, la nouveauté n'est pas montrée — jamais une
   * scène d'une fonction que cet appareil ne peut pas avoir.
   */
  requires?: WhatsNewClientTrait;
}

export interface WhatsNewRelease {
  /** Version desktop, telle que `versions.json → desktop`. */
  version: string;
  /** Vide = « rien à montrer », en connaissance de cause. */
  features: WhatsNewFeature[];
}

/** Une nouveauté retenue pour l'écran, annotée de la version qui l'a livrée. */
export type WhatsNewSelectedFeature = WhatsNewFeature & { version: string };
