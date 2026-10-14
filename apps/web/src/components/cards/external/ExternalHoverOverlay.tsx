import { useTranslation } from "react-i18next";
import { EyeOff, Info, Plus } from "lucide-react";
import {
  externalCardActionEntries,
  resolveExternalCardOverlay,
  type ExternalCardActionEntry,
  type ExternalCardVariant,
} from "@tentacle-tv/shared";
import { CardHoverShell, type CardHoverSurface } from "../CardHoverShell";
import { CardTrayButton, CardTrayCapsule, TRAY_SIZE } from "../CardActionTray";
import { CardTrayPrimaryButton } from "../CardTrayPrimaryButton";
import { BookmarkGlyph, HeartGlyph } from "../cardGlyphs";
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
  /** `preview` : le même survol, dans la mini-carte d'aperçu — en ronds, « Plus d'infos » au bout (`externalCardOverlay.ts`). */
  surface?: CardHoverSurface;
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
 *   • puis « Ma liste à l'arrivée » et « J'aime » — le signet et le cœur de
 *     la pastille —, et « Ne plus me proposer » sur une recommandation —
 *     l'ordre de la feuille d'appui long (`externalCardActionEntries`).
 *
 * MONTÉ au survol seulement, par l'appelant (`useMountWhile`) : la liste des
 * notes, celles des titres mis de côté et aimés, et les mutations n'existent
 * que le temps du survol.
 */
export function ExternalHoverOverlay({ variant, title, name, visible, onDismiss, surface = "card" }: ExternalHoverOverlayProps) {
  const actions = useExternalTitleActions(title);
  const preview = surface === "preview";
  const overlay = resolveExternalCardOverlay({
    variant, request: actions.state?.request ?? null, identified: true, likes: actions.likes, surface,
  });
  // « Ne plus me proposer » n'existe que si l'appelant sait le faire.
  const entries = externalCardActionEntries(overlay, { watchlist: actions.pending, favorite: actions.favorite })
    .filter((entry) => entry.kind !== "dismiss" || onDismiss);

  const stars = overlay.rate ? <HoverRatingStars identity={actions.ratingIdentity} size={preview ? "preview" : "sm"} /> : null;
  const tray = entries.length > 0
    ? (
      <CardTrayCapsule label={name} bare={preview}>
        {entries.map((entry) => (
          <TrayEntry key={entry.kind} entry={entry} actions={actions} name={name} onDismiss={onDismiss} size={preview ? "preview" : "sm"} />
        ))}
      </CardTrayCapsule>
    )
    : null;

  return (
    <CardHoverShell variant={variant} visible={visible} surface={surface}>
      {preview ? (
        // La mini-carte : le plateau d'abord, les étoiles ensuite (cf. `CardHoverOverlay`).
        <>
          <div data-preview-slot="tray">{tray}</div>
          {stars && <div data-preview-slot="rating">{stars}</div>}
        </>
      ) : (
        <>
          {stars && <div className="flex justify-center">{stars}</div>}
          {/* Pas de bascules de bibliothèque : la capsule épouse son contenu, au centre. */}
          {tray && <div className="flex justify-center">{tray}</div>}
        </>
      )}
    </CardHoverShell>
  );
}

/** Un bouton de la capsule, selon l'action que le modèle y range. */
function TrayEntry({ entry, actions, name, onDismiss, size }: {
  entry: ExternalCardActionEntry;
  actions: ExternalTitleActions;
  name: string;
  onDismiss?: () => void;
  size: keyof typeof TRAY_SIZE;
}) {
  const { t } = useTranslation("cards");
  const { box, icon } = TRAY_SIZE[size];

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
        <Plus className={icon} strokeWidth={2.5} aria-hidden />
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
  if (entry.kind === "favorite") {
    return (
      // Le cœur actif prend l'accent de marque, comme sur le plateau des titres de la bibliothèque.
      <CardTrayButton box={box} active={entry.active} accent label={t(entry.labelKey ?? "")} onPress={actions.toggleFavorite}>
        <HeartGlyph className={icon} filled={entry.active === true} />
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
  if (entry.kind === "details") {
    // La mini-carte : « Plus d'infos » rend son clic à la carte, qui ouvre la
    // page du titre — le geste même du clic sur la vidéo.
    return (
      <CardTrayButton box={box} pressable={false} extra="details" label={t(entry.labelKey ?? "")}>
        <Info className={icon} aria-hidden />
      </CardTrayButton>
    );
  }
  return null;
}
