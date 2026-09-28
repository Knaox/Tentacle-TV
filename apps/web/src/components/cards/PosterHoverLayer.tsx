import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { CardActionTray } from "./CardActionTray";
import { PlayGlyph } from "./cardGlyphs";
import { HoverRatingStars } from "../rating/HoverRatingStars";
import { PressableScale } from "../ui/PressableScale";
import { ratingIdentityForItem } from "../../lib/ratingIdentity";

interface PosterHoverLayerProps {
  item: MediaItem;
  /** Cible du fondu : vrai pendant le survol, faux pendant le sursis de sortie. */
  visible: boolean;
  /** « Reprendre » plutôt que « Lire » quand une lecture est entamée. */
  resume: boolean;
  onPlay: (e: React.MouseEvent) => void;
}

/**
 * Le survol d'une affiche 2:3, en trois temps et trois places — rien dans les
 * angles, que les marqueurs du repos occupent :
 *
 *   1. un VOILE qui assombrit l'affiche par le bas (l'image reste lisible en
 *      haut, où montent les puces qualité/langues) ;
 *   2. le bouton LECTURE, au centre, au dégradé de marque — la seule action
 *      primaire, donc la seule en couleur ;
 *   3. en bas, la note à poser (étoiles) puis le PLATEAU : Ma liste, favori,
 *      vu, hors ligne, dans une capsule.
 *
 * Le clic sur le voile tombe sur la carte, qui ouvre la fiche : le bouton
 * « Plus d'infos » d'autrefois faisait doublon.
 *
 * Monté au survol seulement, par l'appelant (`useMountWhile`) : le plateau
 * s'abonne aux Sets de séries et à la liste des notes, et quatre-vingts cartes
 * ne doivent pas les porter au repos. Les trois fondus ne touchent que
 * `opacity` et `transform` (theme/cards.css) ; `.hover-reveal` sur la racine
 * sert aussi de poignée à la feuille de la LG, qui masque tout le survol.
 */
export function PosterHoverLayer({ item, visible, resume, onPlay }: PosterHoverLayerProps) {
  const { t } = useTranslation("cards");
  const ratingIdentity = ratingIdentityForItem(item);
  const playLabel = resume ? t("resume") : t("play");
  const reveal = { "--reveal-ms": "200ms" } as CSSProperties;

  return (
    <div
      className="hover-reveal absolute inset-0 z-20"
      data-shown={visible}
      style={{ ...reveal, pointerEvents: visible ? "auto" : "none" }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "var(--card-hover-veil)" }} />

      {/* L'entrée (`card-hover-pop`) sur une enveloppe : le ressort de
          `PressableScale` écrit son propre `transform` en ligne, qui
          écraserait celui de la feuille. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="card-hover-pop pointer-events-auto" data-shown={visible} style={reveal}>
          <PressableScale
            onClick={onPlay}
            hoverScale={1.08}
            aria-label={`${playLabel} — ${item.Name}`}
            title={playLabel}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand)] to-[var(--brand-accent)] text-cta-brand-fg shadow-[0_8px_24px_rgba(var(--brand-rgb),0.45)] ring-1 ring-white/25"
          >
            <PlayGlyph className="ml-0.5 h-5 w-5" />
          </PressableScale>
        </div>
      </div>

      <div
        className="card-hover-rise absolute inset-x-0 bottom-0 flex flex-col items-stretch gap-1.5 px-2 pb-2.5"
        data-shown={visible}
        style={reveal}
      >
        {ratingIdentity && (
          <div className="flex justify-center">
            <HoverRatingStars identity={ratingIdentity} jellyfinItemId={item.Id} />
          </div>
        )}
        {/* Gabarit `sm` à toute largeur : quatre boutons de 28 px tiennent dans
            la plus étroite des affiches (120 px) et s'écartent sur les autres. */}
        <CardActionTray item={item} size="sm" stretch />
      </div>
    </div>
  );
}
