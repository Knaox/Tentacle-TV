import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import type { CardOverlayVariant } from "@tentacle-tv/shared";

interface CardHoverShellProps {
  variant: CardOverlayVariant;
  /** Cible du fondu : vrai pendant le survol, faux pendant le sursis de sortie. */
  visible: boolean;
  /** Le groupe du bas : étoiles, puis plateau. */
  children: ReactNode;
}

/**
 * La coque du survol — le dessin UNIQUE de toutes les cartes du web, quelle
 * que soit la variante (`cardOverlay.ts`) :
 *
 *   1. un VOILE qui assombrit la carte par le bas ;
 *   2. le GROUPE du bas, étoiles puis plateau : centré et pleine largeur sur
 *      une affiche (`poster`, `reco`), rangé dans le coin bas-droit d'une
 *      vignette 16:9 (`landscape`), dont le coin bas-gauche garde le code et
 *      le titre de l'épisode. Même groupe, même ordre — seule la place change
 *      avec le format.
 *
 * RIEN au centre de l'image : un gros bouton de lecture y a vécu, au dégradé
 * de marque. Il répétait le clic de la carte et masquait l'affiche au moment
 * même où on la regardait. L'action primaire d'une carte — « Lire » sur une
 * affiche, « Demander » sur une carte Vigie — est désormais le premier bouton
 * du plateau (`CardTrayPrimaryButton`) ; une vignette 16:9, dont le clic EST
 * la lecture, n'en a pas.
 *
 * Montée au survol seulement, par l'appelant (`useMountWhile`) : jamais
 * laissée à `opacity: 0`. Les fondus ne touchent que `opacity` et `transform`
 * (theme/cards.css). `.hover-reveal` sert aussi de poignée à la feuille de la
 * LG, et `data-card-overlay` aux feuilles qui voudraient une variante.
 *
 * Les touches pressées sur un bouton du survol ne remontent pas : la carte
 * entière réagit à Entrée/Espace, et un bouton focalisé par le clic
 * déclencherait les deux.
 */
export function CardHoverShell({ variant, visible, children }: CardHoverShellProps) {
  const reveal = { "--reveal-ms": "200ms" } as CSSProperties;
  const stopKeys = (e: KeyboardEvent) => e.stopPropagation();
  const corner = variant === "landscape";

  return (
    <div
      className="hover-reveal absolute inset-0 z-20"
      data-shown={visible}
      data-card-overlay={variant}
      onKeyDown={stopKeys}
      style={{ ...reveal, pointerEvents: visible ? "auto" : "none" }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "var(--card-hover-veil)" }} />

      {/* `max-w-full` : sur une affiche étroite, le plateau se resserre au
          lieu de déborder de la carte (cf. `CardTrayCapsule`). 4 px de marge
          seulement sur une affiche : à 137 px de large (la plus étroite du
          bureau, fenêtre de 996 px), c'est ce qui laisse à ses cinq boutons
          l'espacement de WCAG 2.5.8 — des centres à 24 px au moins. */}
      <div
        className={`card-hover-rise absolute bottom-0 flex max-w-full flex-col gap-1.5 ${
          corner ? "right-0 items-end px-2.5 pb-2" : "inset-x-0 items-stretch px-1 pb-2.5"
        }`}
        data-shown={visible}
        style={reveal}
      >
        {children}
      </div>
    </div>
  );
}
