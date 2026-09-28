import { useEffect, useRef, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { EyeOff, Info } from "lucide-react";
import { useCardFace, useCardRatingTarget, useCardToggles, useJellyfinClient, useSeriesWatchState } from "@tentacle-tv/api-client";
import {
  cardActionEntries,
  formatEpisodeCode,
  resolveCardOverlay,
  resolvePosterImage,
  type CardActionEntry,
  type CardOverlayVariant,
  type CardToggleKind,
  type MediaItem,
} from "@tentacle-tv/shared";
import { BookmarkGlyph, HeartGlyph, PlayGlyph, WatchedGlyph } from "@/components/cards/cardGlyphs";
import { registerBack } from "../../focus/back";
import { CardRatingRowTv } from "./CardRatingRowTv";

interface CardActionSheetTvProps {
  item: MediaItem;
  variant: CardOverlayVariant;
  onClose: () => void;
  /** « Ne plus me proposer » d'une recommandation. */
  onDismiss?: () => void;
}

/**
 * Les actions d'une carte, à la télécommande — l'équivalent du survol du web.
 *
 * Sur un téléviseur, le focus tient lieu de survol, mais il ne peut pas entrer
 * DANS une carte : un niveau de navigation de plus rendrait chaque déplacement
 * ambigu. L'appui long (OK maintenu) ouvre donc cette feuille, qui présente
 * exactement ce que le survol offre ailleurs, dans le même ordre
 * (`cardActionEntries`) : Lire / Reprendre, Ma liste, favori, vu, puis la
 * fiche (vignette 16:9) ou le refus (recommandation), et la note.
 *
 * `role="dialog"` confine le D-pad (`focus/candidates.ts`), Retour la ferme
 * (`focus/back.ts`). Les bascules laissent la feuille ouverte — on voit leur
 * libellé changer ; lire, ouvrir la fiche ou refuser la referment.
 */
export function CardActionSheetTv({ item, variant, onClose, onDismiss }: CardActionSheetTvProps) {
  const { t } = useTranslation("cards");
  const navigate = useNavigate();
  const client = useJellyfinClient();
  // Une carte de reco ou de recherche n'a qu'un résumé : la fiche complète
  // donne l'état juste et le tmdb des étoiles.
  const { face } = useCardFace(item, { enabled: true });
  const card = face ?? item;
  const toggles = useCardToggles(card);
  const target = useCardRatingTarget(card, { scope: variant === "landscape" ? "item" : "series", enabled: true });
  const play = usePlayTarget(card);
  const overlay = resolveCardOverlay({
    variant,
    inLibrary: true,
    playable: play !== null,
    resume: play?.resume,
    rateable: target.identity !== null,
  });
  const entries = cardActionEntries(overlay, toggles.states);
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    first.current?.focus();
  }, []);
  useEffect(() => registerBack(() => {
    onClose();
    return true;
  }), [onClose]);

  const run = (entry: CardActionEntry) => {
    if (entry.kind === "play" && play) {
      onClose();
      navigate(play.path);
    } else if (entry.kind === "details") {
      onClose();
      navigate(`/media/${card.Id}`);
    } else if (entry.kind === "dismiss") {
      onClose();
      onDismiss?.();
    } else if (entry.kind !== "offline" && entry.kind !== "play") {
      toggles.toggle(entry.kind);
    }
  };

  const isEpisode = card.Type === "Episode";
  const title = isEpisode ? (card.SeriesName ?? card.Name) : card.Name;
  // L'affiche du titre en tête, comme la feuille de tvOS et d'Android TV : on
  // sait sur quoi l'on agit sans relire la carte restée sous le voile. Celle de
  // la SÉRIE pour un épisode — c'est son visage.
  const poster = resolvePosterImage(card, "series");
  const posterUrl = poster
    ? client.getImageUrl(poster.id, poster.type, { height: 240, quality: 85, ...(poster.tag ? { tag: poster.tag } : {}) })
    : null;
  const subtitle = isEpisode
    ? [formatEpisodeCode(card.ParentIndexNumber, card.IndexNumber), card.Name].filter(Boolean).join(" · ")
    : card.ProductionYear
      ? String(card.ProductionYear)
      : null;

  // Rendue en portail, la feuille reste ENFANT React de la carte : ses touches
  // et ses focus remonteraient jusqu'à la machine d'appui de la carte, qui
  // rejouait son action courte (lancer la lecture) sur un OK donné dans la
  // feuille. Le moteur de navigation écoute en capture sur `document` : couper
  // la remontée React ne lui retire rien.
  const stop = (event: SyntheticEvent) => event.stopPropagation();

  return createPortal(
    <div
      className="actions-carte-tv"
      role="dialog"
      aria-label={title}
      onKeyDown={stop}
      onKeyUp={stop}
      onFocus={stop}
      onBlur={stop}
    >
      <div className="actions-carte-tv-boite">
        <div className="actions-carte-tv-entete">
          {posterUrl && <img className="actions-carte-tv-affiche" src={posterUrl} alt="" />}
          <div className="actions-carte-tv-entete-texte">
            <p className="actions-carte-tv-titre">{title}</p>
            {subtitle && <p className="actions-carte-tv-sous-titre">{subtitle}</p>}
          </div>
        </div>
        <ul className="actions-carte-tv-liste">
          {entries.map((entry, index) => (
            <li key={entry.kind}>
              <button
                ref={index === 0 ? first : undefined}
                type="button"
                className="actions-carte-tv-entree"
                data-kind={entry.kind}
                data-principal={entry.kind === "play"}
                data-actif={entry.active === true}
                aria-pressed={entry.active}
                onClick={() => run(entry)}
              >
                <EntryGlyph kind={entry.kind} active={entry.active === true} />
                <span>{t(entry.labelKey)}</span>
              </button>
            </li>
          ))}
        </ul>
        {overlay.rate && target.identity && (
          <CardRatingRowTv identity={target.identity} jellyfinItemId={target.jellyfinItemId} />
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Où mène « Lire » : le film ou l'épisode, ou l'épisode que la série reprend. */
function usePlayTarget(card: MediaItem): { path: string; resume: boolean } | null {
  const isSeries = card.Type === "Series";
  const { data: state } = useSeriesWatchState(isSeries ? card.Id : undefined);
  if (isSeries) {
    const episode = state && state.type !== "completed" ? state.episode : null;
    return episode ? { path: `/watch/${episode.Id}`, resume: state?.type === "continue" } : null;
  }
  if (card.Type !== "Movie" && card.Type !== "Episode") return null;
  const progress = card.UserData?.PlayedPercentage ?? 0;
  return { path: `/watch/${card.Id}`, resume: progress > 0 && card.UserData?.Played !== true };
}

function EntryGlyph({ kind, active }: { kind: CardActionEntry["kind"]; active: boolean }) {
  const cls = "actions-carte-tv-glyphe";
  if (kind === "play") return <PlayGlyph className={cls} />;
  const toggle = kind as CardToggleKind;
  if (toggle === "watchlist") return <BookmarkGlyph className={cls} filled={active} />;
  if (toggle === "favorite") return <HeartGlyph className={cls} filled={active} />;
  if (toggle === "watched") return <WatchedGlyph className={cls} filled={active} />;
  // Les extras gardent les icônes du plateau du web : la fiche, le refus.
  if (kind === "details") return <Info className={cls} aria-hidden />;
  if (kind === "dismiss") return <EyeOff className={cls} aria-hidden />;
  return <span className={cls} aria-hidden />;
}
