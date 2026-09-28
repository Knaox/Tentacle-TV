import type { CardStatusKind } from "@tentacle-tv/shared";
import { CardFrame } from "../../../components/cards/CardFrame";
import { CardImage } from "../../../components/cards/CardImage";
import { CardRatingBadge } from "../../../components/cards/CardRatingBadge";
import { CardStatusMarkers } from "../../../components/cards/CardStatusMarkers";
import { CardHoverShell } from "../../../components/cards/CardHoverShell";
import { BookmarkGlyph, HeartGlyph, WatchedGlyph } from "../../../components/cards/cardGlyphs";
import { StarRating } from "../../../components/rating/StarRating";
import type { ScenePoster } from "../../sceneMedia";
import { CARD_TONES } from "../FauxCard";
import { Place, type Placed } from "../Place";

interface FauxMarkedCardProps extends Placed {
  poster: ScenePoster | null;
  tone: number;
  userScore: number | null;
  statuses: readonly CardStatusKind[];
  /** La scène la survole : la coque de survol se révèle, les marqueurs du repos s'effacent. */
  hovered?: boolean;
  /** Porte-t-elle la coque de survol ? Seule la carte visée la monte, comme l'app. */
  hoverable?: boolean;
}

const noop = () => {};
/** Le gabarit `sm` du plateau (`TRAY_SIZE.sm` de `CardActionTray`). */
const BOX = { box: "h-7 w-7", icon: "h-3.5 w-3.5" } as const;

/**
 * Une affiche de bibliothèque, faite des VRAIES pièces : au repos la note
 * (globale + la vôtre) et la pastille d'états ; au survol la coque partagée
 * (`CardHoverShell`, variante `poster`) — voile, Lecture au centre, étoiles,
 * plateau d'actions.
 * Inerte : c'est la scène qui survole, note et bascule.
 */
export function FauxMarkedCard({ poster, tone, userScore, statuses, hovered = false, hoverable = false, ...place }: FauxMarkedCardProps) {
  return (
    <Place {...place}>
      <div className="group/card">
        <CardFrame hovered={hovered} aspect="aspect-[2/3]">
          {poster ? <CardImage src={poster.url} alt="" /> : <div className="h-full w-full" style={{ background: CARD_TONES[tone % CARD_TONES.length] }} />}
          <CardRatingBadge rating={poster?.rating ?? null} userScore={userScore} shown={!hovered} />
          <CardStatusMarkers statuses={statuses} shown={!hovered} />
          {hoverable && (
            <CardHoverShell variant="poster" visible={hovered} play={{ label: poster?.title ?? "", onPlay: noop }}>
              <div className="flex justify-center">
                <StarRating value={userScore} onRate={noop} onClear={noop} size="sm" tone="onMedia" />
              </div>
              <FauxTray statuses={statuses} />
            </CardHoverShell>
          )}
        </CardFrame>
      </div>
    </Place>
  );
}

/**
 * Le plateau d'actions (`CardTrayCapsule` + `CardTrayButton`), au balisage
 * recopié : importer `CardActionTray` tirerait le bouton hors ligne et, avec
 * lui, tout le démarrage de l'app — ce qu'aucune scène ni aucun test ne veut.
 */
function FauxTray({ statuses }: { statuses: readonly CardStatusKind[] }) {
  const items = [
    { kind: "watchlist", Glyph: BookmarkGlyph, accent: false },
    { kind: "favorite", Glyph: HeartGlyph, accent: true },
    { kind: "watched", Glyph: WatchedGlyph, accent: false },
  ] as const;
  return (
    <div className="flex w-full items-center justify-between gap-0.5 rounded-full border border-white/15 bg-white/[0.12] p-0.5 shadow-[0_4px_14px_rgba(0,0,0,0.35)]">
      {items.map(({ kind, Glyph, accent }) => {
        const active = statuses.includes(kind);
        const tone = active ? (accent ? "bg-white/15 text-[var(--brand-accent)]" : "bg-white/15 text-white") : "text-white/80";
        return (
          <span key={kind} className={`${BOX.box} flex shrink-0 items-center justify-center rounded-full ${tone}`}>
            <Glyph className={BOX.icon} filled={active} />
          </span>
        );
      })}
    </div>
  );
}
