import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from "react";
import type { CardOverlayVariant } from "@tentacle-tv/shared";
import { PlayGlyph } from "./cardGlyphs";
import { PressableScale } from "../ui/PressableScale";

interface CardHoverShellProps {
  variant: CardOverlayVariant;
  /** Cible du fondu : vrai pendant le survol, faux pendant le sursis de sortie. */
  visible: boolean;
  /** Le bouton Lecture du centre — absent quand rien ne se lance. */
  play?: { label: string; onPlay: (e: MouseEvent) => void } | null;
  /** Le groupe du bas : étoiles, puis plateau. */
  children: ReactNode;
}

/**
 * La coque du survol — le dessin UNIQUE de toutes les cartes du web, quelle
 * que soit la variante (`cardOverlay.ts`) :
 *
 *   1. un VOILE qui assombrit la carte par le bas ;
 *   2. le bouton LECTURE au centre, au dégradé de marque — la seule action
 *      primaire, donc la seule en couleur ;
 *   3. le GROUPE du bas, étoiles puis plateau : centré et pleine largeur sur
 *      une affiche (`poster`, `reco`), rangé dans le coin bas-droit d'une
 *      vignette 16:9 (`landscape`), dont le coin bas-gauche garde le code et
 *      le titre de l'épisode. Même groupe, même ordre — seule la place change
 *      avec le format.
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
export function CardHoverShell({ variant, visible, play, children }: CardHoverShellProps) {
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

      {/* L'entrée (`card-hover-pop`) sur une enveloppe : le ressort de
          `PressableScale` écrit son propre `transform` en ligne, qui
          écraserait celui de la feuille. */}
      {play && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="card-hover-pop pointer-events-auto" data-shown={visible} style={reveal}>
            <PressableScale
              onClick={play.onPlay}
              hoverScale={1.08}
              aria-label={play.label}
              title={play.label}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand)] to-[var(--brand-accent)] text-cta-brand-fg shadow-[0_8px_24px_rgba(var(--brand-rgb),0.45)] ring-1 ring-white/25"
            >
              <PlayGlyph className="ml-0.5 h-5 w-5" />
            </PressableScale>
          </div>
        </div>
      )}

      <div
        className={`card-hover-rise absolute bottom-0 flex flex-col gap-1.5 ${
          corner ? "right-0 items-end px-2.5 pb-2" : "inset-x-0 items-stretch px-2 pb-2.5"
        }`}
        data-shown={visible}
        style={reveal}
      >
        {children}
      </div>
    </div>
  );
}
