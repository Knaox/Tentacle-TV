import { useTranslation } from "react-i18next";
import { EyeOff, Plus } from "lucide-react";
import {
  externalCardActionEntries,
  resolveExternalCardOverlay,
  type ExternalCardActionEntry,
  type ExternalCardVariant,
} from "@tentacle-tv/shared";
import { CardHoverShell } from "../CardHoverShell";
import { CardTrayButton, CardTrayCapsule, TRAY_SIZE } from "../CardActionTray";
import { CardTrayPrimaryButton } from "../CardTrayPrimaryButton";
import { BookmarkGlyph } from "../cardGlyphs";
import { HoverRatingStars } from "../../rating/HoverRatingStars";
import { useExternalTitleActions, type ExternalTitleActions } from "./useExternalTitleActions";
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
 * recherche, la filmographie, la saga comme sur les recommandations, et comme
 * dans l'extension :
 *
 *   • en bas, les étoiles, puis la capsule ;
 *   • EN TÊTE de la capsule, « Demander », seule action en couleur : un film
 *     se demande d'un geste, une série ouvre ses saisons. Rien au centre de
 *     l'affiche ;
 *   • puis « Ma liste à l'arrivée », et « Ne plus me proposer » sur une
 *     recommandation — l'ordre de la feuille d'appui long (`externalCardActionEntries`).
 *
 * MONTÉ au survol seulement, par l'appelant (`useMountWhile`) : la liste des
 * notes, celle des titres mis de côté et la mutation n'existent que le temps
 * du survol.
 */
export function ExternalHoverOverlay({ variant, title, name, visible, onDismiss }: ExternalHoverOverlayProps) {
  const actions = useExternalTitleActions(title);
  const overlay = resolveExternalCardOverlay({ variant, request: actions.state?.request ?? null, identified: true });
  // « Ne plus me proposer » n'existe que si l'appelant sait le faire.
  const entries = externalCardActionEntries(overlay, { watchlist: actions.pending })
    .filter((entry) => entry.kind !== "dismiss" || onDismiss);

  return (
    <CardHoverShell variant={variant} visible={visible}>
      {overlay.rate && (
        <div className="flex justify-center">
          <HoverRatingStars identity={actions.ratingIdentity} />
        </div>
      )}
      {entries.length > 0 && (
        // Pas de bascules de bibliothèque : la capsule épouse son contenu, au centre.
        <div className="flex justify-center">
          <CardTrayCapsule label={name}>
            {entries.map((entry) => (
              <TrayEntry key={entry.kind} entry={entry} actions={actions} name={name} onDismiss={onDismiss} />
            ))}
          </CardTrayCapsule>
        </div>
      )}
    </CardHoverShell>
  );
}

/** Un bouton de la capsule, selon l'action que le modèle y range. */
function TrayEntry({ entry, actions, name, onDismiss }: {
  entry: ExternalCardActionEntry;
  actions: ExternalTitleActions;
  name: string;
  onDismiss?: () => void;
}) {
  const { t } = useTranslation("cards");
  const { box, icon } = TRAY_SIZE.sm;

  if (entry.kind === "request") {
    return (
      <CardTrayPrimaryButton
        box={box}
        icon={icon}
        tone="brand"
        label={`${entry.label} — ${name}`}
        busy={actions.requesting}
        onPress={actions.request}
      >
        <Plus className={icon} strokeWidth={2.75} aria-hidden />
      </CardTrayPrimaryButton>
    );
  }
  if (entry.kind === "watchlist") {
    return (
      <CardTrayButton box={box} active={entry.active} label={t(entry.labelKey ?? "")} onPress={actions.toggleWatchlist}>
        <BookmarkGlyph className={icon} filled={entry.active === true} />
      </CardTrayButton>
    );
  }
  if (entry.kind === "dismiss" && onDismiss) {
    return (
      <CardTrayButton box={box} pressable={false} label={t(entry.labelKey ?? "")} onPress={onDismiss}>
        <EyeOff className={icon} aria-hidden />
      </CardTrayButton>
    );
  }
  return null;
}
