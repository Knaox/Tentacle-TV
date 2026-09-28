import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from "react";
import { PlayGlyph } from "./cardGlyphs";
import { PressableScale } from "../ui/PressableScale";

interface PosterHoverShellProps {
  /** Cible du fondu : vrai pendant le survol, faux pendant le sursis de sortie. */
  visible: boolean;
  /** Le bouton Lecture du centre — absent quand rien n'est lisable (hors bibliothèque). */
  play?: { label: string; onPlay: (e: MouseEvent) => void } | null;
  /** Le bas de l'affiche : étoiles, plateau. */
  children: ReactNode;
}

/**
 * La coque du survol d'une affiche 2:3 — le dessin UNIQUE que partagent
 * l'affiche de bibliothèque (`PosterHoverLayer`) et la carte de
 * recommandation (`RecoPosterHoverLayer`) :
 *
 *   1. un VOILE qui assombrit l'affiche par le bas ;
 *   2. le bouton LECTURE au centre, au dégradé de marque — la seule action
 *      primaire, donc la seule en couleur ;
 *   3. en bas, ce que l'appelant y pose (étoiles, plateau).
 *
 * Montée au survol seulement, par l'appelant (`useMountWhile`). Les trois
 * fondus ne touchent que `opacity` et `transform` (theme/cards.css) ;
 * `.hover-reveal` sur la racine sert aussi de poignée à la feuille de la LG,
 * qui masque tout le survol.
 *
 * Les touches pressées sur un bouton du survol ne remontent pas : la carte
 * entière réagit à Entrée/Espace pour ouvrir la fiche, et un bouton focalisé
 * par le clic déclencherait les deux.
 */
export function PosterHoverShell({ visible, play, children }: PosterHoverShellProps) {
  const reveal = { "--reveal-ms": "200ms" } as CSSProperties;
  const stopKeys = (e: KeyboardEvent) => e.stopPropagation();

  return (
    <div
      className="hover-reveal absolute inset-0 z-20"
      data-shown={visible}
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
        className="card-hover-rise absolute inset-x-0 bottom-0 flex flex-col items-stretch gap-1.5 px-2 pb-2.5"
        data-shown={visible}
        style={reveal}
      >
        {children}
      </div>
    </div>
  );
}
