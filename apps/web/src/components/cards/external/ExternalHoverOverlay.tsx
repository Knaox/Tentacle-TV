import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { EyeOff, Loader2, Plus } from "lucide-react";
import { externalWatchlistLabelKey, resolveExternalCardOverlay, type ExternalCardVariant } from "@tentacle-tv/shared";
import { CardHoverShell } from "../CardHoverShell";
import { CardTrayButton, CardTrayCapsule, TRAY_SIZE } from "../CardActionTray";
import { BookmarkGlyph } from "../cardGlyphs";
import { HoverRatingStars } from "../../rating/HoverRatingStars";
import { useExternalTitleActions } from "./useExternalTitleActions";
import type { ExternalTitle } from "./useTitleProvider";

interface ExternalHoverOverlayProps {
  variant: ExternalCardVariant;
  /** L'identité TMDB du titre. */
  title: ExternalTitle;
  /** Le nom du titre, lu par les lecteurs d'écran. */
  name: string;
  /** Cible du fondu : vrai pendant le survol, faux pendant le sursis de sortie. */
  visible: boolean;
  /** Extra « Ne plus me proposer » d'une recommandation. */
  onDismiss?: () => void;
}

/**
 * LE survol d'une carte hors bibliothèque — un titre qu'une extension de
 * demandes (Vigie) sait obtenir. Le même dessin que toutes les cartes
 * (`CardHoverShell`) et la même grammaire (`externalCardOverlay.ts`), sur la
 * page de recherche comme sur les recommandations, et comme dans l'extension :
 *
 *   • au centre, « Demander », seule action en couleur, à la place de
 *     « Lire » : un film se demande d'un geste, une série ouvre ses saisons ;
 *   • en bas, les étoiles, puis la capsule : « Ma liste à l'arrivée », et
 *     « Ne plus me proposer » sur une recommandation.
 *
 * MONTÉ au survol seulement, par l'appelant (`useMountWhile`) : la liste des
 * notes, celle des titres mis de côté et la mutation n'existent que le temps
 * du survol.
 */
export function ExternalHoverOverlay({ variant, title, name, visible, onDismiss }: ExternalHoverOverlayProps) {
  const { t } = useTranslation("cards");
  const actions = useExternalTitleActions(title);
  const overlay = resolveExternalCardOverlay({ variant, request: actions.state?.request ?? null, identified: true });
  const { box, icon } = TRAY_SIZE.sm;
  const dismiss = overlay.extras.includes("dismiss") && onDismiss ? onDismiss : null;

  const onRequest = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    actions.request();
  };

  return (
    <CardHoverShell
      variant={variant}
      visible={visible}
      play={overlay.request ? {
        label: `${overlay.request.label} — ${name}`,
        onPlay: onRequest,
        busy: actions.requesting,
        glyph: actions.requesting
          ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          : <Plus className="h-6 w-6" strokeWidth={2.5} aria-hidden />,
      } : null}
    >
      {overlay.rate && (
        <div className="flex justify-center">
          <HoverRatingStars identity={actions.ratingIdentity} />
        </div>
      )}
      {(overlay.watchlist || dismiss) && (
        // Pas de bascules de bibliothèque : la capsule épouse son contenu, au centre.
        <div className="flex justify-center">
          <CardTrayCapsule label={name}>
            {overlay.watchlist && (
              <CardTrayButton
                box={box}
                active={actions.pending}
                label={t(externalWatchlistLabelKey(actions.pending))}
                onPress={actions.toggleWatchlist}
              >
                <BookmarkGlyph className={icon} filled={actions.pending} />
              </CardTrayButton>
            )}
            {dismiss && (
              <CardTrayButton box={box} pressable={false} label={t("dismiss")} onPress={dismiss}>
                <EyeOff className={icon} aria-hidden />
              </CardTrayButton>
            )}
          </CardTrayCapsule>
        </div>
      )}
    </CardHoverShell>
  );
}
